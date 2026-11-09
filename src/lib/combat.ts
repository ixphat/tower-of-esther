import balance from '../../data/balance.json';
import type { Enemy } from './data';

export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  guard: number;
  agility: number;
}

export interface ClimberStats {
  level: number;
  vitality: number;
  power: number;
  agility: number;
  mind: number;
  weaponAttack: number;
}

export type Outcome = 'ongoing' | 'won' | 'lost';

export interface FightState {
  climber: Combatant;
  enemies: Combatant[];
  round: number;
  turnOrder: string[];
  turn: number;
  outcome: Outcome;
}

export type Action = { type: 'attack'; target: number };

export type FightEvent =
  | { type: 'hit'; attacker: string; target: string; damage: number; crit: boolean }
  | { type: 'miss'; attacker: string; target: string }
  | { type: 'end'; outcome: 'won' | 'lost' };

export type Rng = () => number;

export interface FightStep {
  state: FightState;
  events: FightEvent[];
}

// mulberry32: small, seedable, fine for game rolls
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function climberCombatant(stats: ClimberStats): Combatant {
  const maxHp = balance.hpBase + balance.hpPerVitality * stats.vitality + balance.hpPerLevel * stats.level;
  return {
    id: 'climber',
    name: 'Climber',
    hp: maxHp,
    maxHp,
    attack: stats.power * balance.attackPerPower + stats.weaponAttack,
    guard: stats.vitality,
    agility: stats.agility,
  };
}

export function enemyCombatant({ id, name, hp, attack, def, agility }: Enemy, index: number): Combatant {
  return { id: `${id}-${index}`, name, hp, maxHp: hp, attack, guard: def, agility };
}

export const evasionChance = (agility: number): number =>
  Math.min(agility * balance.evasionPerAgility, balance.evasionCap);

function strike(attacker: Combatant, target: Combatant, rng: Rng): FightEvent {
  const names = { attacker: attacker.name, target: target.name };
  if (rng() < evasionChance(target.agility)) return { type: 'miss', ...names };

  const critChance = Math.min(balance.critBase + attacker.agility * balance.critPerAgility, balance.critCap);
  const crit = rng() < critChance;
  const roll = balance.damageRollMin + rng() * (balance.damageRollMax - balance.damageRollMin);
  const raw = ((attacker.attack * balance.guardScale) / (balance.guardScale + target.guard)) * (crit ? balance.critMultiplier : 1) * roll;
  const damage = Math.max(balance.minDamage, Math.round(raw));
  target.hp = Math.max(0, target.hp - damage);
  return { type: 'hit', ...names, damage, crit };
}

function roundOrder(state: FightState): string[] {
  // Stable sort with the climber listed first, so ties go to the climber.
  return [state.climber, ...state.enemies.filter((e) => e.hp > 0)]
    .sort((a, b) => b.agility - a.agility)
    .map((c) => c.id);
}

function checkEnd(state: FightState, events: FightEvent[]): void {
  if (state.climber.hp === 0) state.outcome = 'lost';
  else if (state.enemies.every((e) => e.hp === 0)) state.outcome = 'won';
  if (state.outcome !== 'ongoing') events.push({ type: 'end', outcome: state.outcome });
}

// Enemies choose only when they act, so no upcoming move exists in the state to reveal.
function runEnemies(state: FightState, rng: Rng, events: FightEvent[]): void {
  while (state.outcome === 'ongoing') {
    if (state.turn >= state.turnOrder.length) {
      state.round += 1;
      state.turn = 0;
      state.turnOrder = roundOrder(state);
    }
    const id = state.turnOrder[state.turn];
    if (id === state.climber.id) return;
    const enemy = state.enemies.find((e) => e.id === id)!;
    if (enemy.hp > 0) {
      events.push(strike(enemy, state.climber, rng));
      checkEnd(state, events);
    }
    state.turn += 1;
  }
}

export function startFight(climber: Combatant, enemies: Combatant[], rng: Rng): FightStep {
  const state: FightState = {
    climber: { ...climber },
    enemies: enemies.map((e) => ({ ...e })),
    round: 1,
    turnOrder: [],
    turn: 0,
    outcome: 'ongoing',
  };
  state.turnOrder = roundOrder(state);
  const events: FightEvent[] = [];
  runEnemies(state, rng, events);
  return { state, events };
}

export function act(current: FightState, action: Action, rng: Rng): FightStep {
  if (current.outcome !== 'ongoing') throw new Error('The fight is over');
  const state = structuredClone(current);
  const target = state.enemies[action.target];
  if (!target || target.hp === 0) throw new Error(`Invalid target ${action.target}`);

  const events = [strike(state.climber, target, rng)];
  checkEnd(state, events);
  state.turn += 1;
  runEnemies(state, rng, events);
  return { state, events };
}
