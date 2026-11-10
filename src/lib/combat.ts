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
  mind: number;
  statuses: ActiveStatus[];
  tier?: Tier;
  moves?: EnemyMove[];
  scripted?: ScriptedMove[];
  triggered?: number[]; // scripted moves already used
  turns?: number; // own turns taken, for move cooldowns
  readyOn?: Record<string, number>;
  planned?: EnemyMove; // committed early by Scan, shown to the climber
  scanned?: boolean;
  yieldBelow?: number; // gives up the fight at this share of max HP
  yielded?: boolean;
  spare?: boolean; // never takes the climber below 1 HP
}

export const TIERS = ['normal', 'tough', 'elite', 'miniBoss', 'floorMaster'] as const;
export type Tier = (typeof TIERS)[number];

export interface EnemyMove {
  name: string;
  type: 'attack' | 'guard' | 'status' | 'charge';
  weight: number;
  cooldown: number;
  power?: number; // share of Attack for attack, or the released hit for charge
  value?: number; // extra Guard share for guard
  status?: { id: string; chance: number; turns?: number; value?: number };
}

export interface ScriptedMove extends EnemyMove {
  belowHp: number; // share of max HP that triggers it once
}

export interface ActiveStatus {
  id: string;
  turns: number;
  value?: number;
}

export interface FightSkill {
  id: string;
  name: string;
  cooldown: number;
  scale: number; // from the skill's level and stage
  tag?: string;
  damage?: number;
  enemyStatus?: ActiveStatus;
  guardBonus?: number;
  damageBonus?: number;
  cleanse?: boolean;
  scan?: boolean;
  scannedBonus?: number; // extra damage share against a scanned target
  outsideFight?: boolean;
}

export interface Loadout {
  skills: FightSkill[];
  stance: string | null;
}

export interface ClimberStats {
  level: number;
  vitality: number;
  power: number;
  agility: number;
  mind: number;
  weaponAttack: number;
  armorGuard: number;
  armorWard: number;
}

export type Outcome = 'ongoing' | 'won' | 'lost' | 'fled';

export interface FightState {
  climber: Combatant;
  enemies: Combatant[];
  round: number;
  turnOrder: string[];
  turn: number;
  outcome: Outcome;
  healsUsed: number;
  skills: FightSkill[];
  readyOn: Record<string, number>; // the climber turn each skill is usable again
  climberTurn: number;
  stance: string | null;
  used: string[]; // skills that earn proficiency from this fight
  hitsTaken: number; // hits that landed on the climber
}

export type Action =
  | { type: 'attack'; target: number }
  | { type: 'heal'; fraction: number }
  | { type: 'flee' }
  | { type: 'skill'; skill: string; target: number };

export type FightEvent =
  | { type: 'hit'; attacker: string; target: string; damage: number; crit: boolean }
  | { type: 'miss'; attacker: string; target: string }
  | { type: 'heal'; target: string; amount: number }
  | { type: 'skill'; actor: string; skill: string }
  | { type: 'status'; target: string; status: string }
  | { type: 'cleanse'; target: string; status: string }
  | { type: 'tick'; target: string; status: string; damage: number }
  | { type: 'stunned'; actor: string }
  | { type: 'fail'; actor: string }
  | { type: 'charge'; actor: string }
  | { type: 'fleeFailed'; actor: string }
  | { type: 'yield'; actor: string }
  | { type: 'end'; outcome: 'won' | 'lost' | 'fled' };

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
    guard: stats.vitality + stats.armorGuard,
    agility: stats.agility,
    mind: stats.mind,
    statuses: [],
  };
}

export function enemyCombatant(enemy: Enemy, index: number): Combatant {
  const { id, name, hp, attack, def, agility, mind, tier, moves, scripted, yieldBelow, spare } = enemy;
  return { id: `${id}-${index}`, name, hp, maxHp: hp, attack, guard: def, agility, mind, statuses: [], tier, moves, scripted, yieldBelow, spare };
}

// Each enemy hits softer in a pair or a three.
export function enemyGroup(foes: Combatant[]): Combatant[] {
  const share = balance.groupAttack[foes.length - 1];
  return foes.map((foe) => ({ ...foe, attack: foe.attack * share }));
}

export const fleeChance = (agility: number): number =>
  Math.min(balance.fleeBase + agility * balance.fleePerAgility, balance.fleeCap);

export const isStrong = (c: Combatant) => c.tier === 'elite' || c.tier === 'miniBoss' || c.tier === 'floorMaster';

export function fleeBlock(state: FightState): string | null {
  return state.enemies.some((e) => e.tier === 'miniBoss' || e.tier === 'floorMaster') ? 'Cannot flee this fight' : null;
}

export const evasionChance = (agility: number): number =>
  Math.min(agility * balance.evasionPerAgility, balance.evasionCap);

const STUN_IMMUNE = 'stunImmune';
const has = (c: Combatant, id: string) => c.statuses.find((status) => status.id === id);

export function skillScale(stage: number, level: number): number {
  return (1 + balance.skillPerLevel * (level - 1)) * (1 + balance.skillPerStage * stage);
}

function effectiveAgility(c: Combatant): number {
  return has(c, 'slow') ? c.agility * balance.statuses.slow.agility : c.agility;
}

const activeStance = (state: FightState) => state.skills.find((skill) => skill.id === state.stance);

export function applyStatus(
  target: Combatant,
  id: string,
  options: { turns?: number; value?: number; attempt?: { chance: number; roll: number } } = {},
): FightEvent | null {
  if (id === 'stun' && has(target, STUN_IMMUNE)) return null;
  const halved = id === 'stun' && isStrong(target) ? balance.strongEnemyShare : 1;
  if (options.attempt && options.attempt.roll >= options.attempt.chance * halved - target.mind * balance.statusResistPerMind) {
    return null;
  }
  const turns = options.turns ?? balance.statuses[id as keyof typeof balance.statuses]?.turns;
  const status: ActiveStatus = options.value === undefined ? { id, turns } : { id, turns, value: options.value };
  target.statuses = [...target.statuses.filter((s) => s.id !== id), status];
  return { type: 'status', target: target.name, status: id };
}

function strike(state: FightState, attacker: Combatant, target: Combatant, rng: Rng, percent = 1): FightEvent {
  const names = { attacker: attacker.name, target: target.name };
  const evasion = has(target, 'restrain') ? 0 : evasionChance(effectiveAgility(target));
  if (rng() < evasion + (has(attacker, 'accuracyDown')?.value ?? 0)) return { type: 'miss', ...names };

  const stance = activeStance(state);
  const stanceOn = (c: Combatant, bonus?: number) =>
    c === state.climber && stance && bonus ? 1 + (bonus > 0 ? bonus * stance.scale : bonus) : 1;
  const guard = target.guard * stanceOn(target, stance?.guardBonus) * (1 + (has(target, 'guarding')?.value ?? 0));
  const dealt = stanceOn(attacker, stance?.damageBonus) * (has(attacker, 'fear') ? balance.statuses.fear.damage : 1);

  const critChance = Math.min(balance.critBase + effectiveAgility(attacker) * balance.critPerAgility, balance.critCap);
  const crit = rng() < critChance;
  const roll = balance.damageRollMin + rng() * (balance.damageRollMax - balance.damageRollMin);
  const raw =
    ((attacker.attack * percent * balance.guardScale) / (balance.guardScale + guard)) *
    (crit ? balance.critMultiplier : 1) *
    dealt *
    roll;
  const rolled = Math.max(balance.minDamage, Math.round(raw));
  // a sparing attacker never kills the climber, and a yielding enemy gives up before it falls
  const holdsOn = (attacker.spare && target === state.climber) || target.yieldBelow !== undefined;
  const damage = holdsOn ? Math.min(rolled, Math.max(0, target.hp - 1)) : rolled;
  target.hp = Math.max(0, target.hp - damage);
  if (target === state.climber) state.hitsTaken += 1;
  return { type: 'hit', ...names, damage, crit };
}

// Damage over time, then a stun check. False means the combatant cannot act this turn.
function startTurn(state: FightState, c: Combatant, events: FightEvent[]): boolean {
  for (const id of ['poison', 'burn'] as const) {
    if (!has(c, id)) continue;
    const share = balance.statuses[id].hpShare * (isStrong(c) ? balance.strongEnemyShare : 1);
    const damage = Math.max(balance.minDamage, Math.round(c.maxHp * share));
    c.hp = Math.max(0, c.hp - damage);
    events.push({ type: 'tick', target: c.name, status: id, damage });
  }
  checkEnd(state, events);
  if (state.outcome !== 'ongoing' || c.hp === 0) return false;
  if (has(c, 'stun')) {
    events.push({ type: 'stunned', actor: c.name });
    endTurn(c);
    return false;
  }
  return true;
}

function endTurn(c: Combatant): void {
  const expired = has(c, 'stun')?.turns === 1;
  c.statuses = c.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
  if (expired) c.statuses.push({ id: STUN_IMMUNE, turns: balance.stunImmuneTurns });
}

const moveFails = (c: Combatant, rng: Rng) => has(c, 'confuse') !== undefined && rng() < balance.statuses.confuse.failChance;

function roundOrder(state: FightState): string[] {
  // Stable sort with the climber listed first, so ties go to the climber.
  return [state.climber, ...state.enemies.filter((e) => e.hp > 0)]
    .sort((a, b) => effectiveAgility(b) - effectiveAgility(a))
    .map((c) => c.id);
}

function checkEnd(state: FightState, events: FightEvent[]): void {
  if (events.some((event) => event.type === 'end')) return; // already ended in this step
  if (state.outcome === 'fled') {
    events.push({ type: 'end', outcome: 'fled' });
    return;
  }
  for (const e of state.enemies) {
    if (e.yieldBelow && !e.yielded && e.hp > 0 && e.hp / e.maxHp <= e.yieldBelow) {
      e.yielded = true;
      events.push({ type: 'yield', actor: e.name });
    }
  }
  if (state.climber.hp === 0) state.outcome = 'lost';
  else if (state.enemies.every((e) => e.hp === 0 || e.yielded)) state.outcome = 'won';
  if (state.outcome !== 'ongoing') events.push({ type: 'end', outcome: state.outcome });
}

function pickMove(enemy: Combatant, rng: Rng): EnemyMove {
  const triggered = enemy.triggered ?? [];
  const due = (enemy.scripted ?? []).findIndex(
    (move, index) => !triggered.includes(index) && enemy.hp / enemy.maxHp < move.belowHp,
  );
  if (due !== -1) {
    enemy.triggered = [...triggered, due];
    return enemy.scripted![due];
  }
  const upcoming = (enemy.turns ?? 0) + 1; // picks are for the enemy's next turn, also when Scan picks early
  const ready = enemy.moves!.filter((move) => (enemy.readyOn?.[move.name] ?? 0) <= upcoming);
  let roll = rng() * ready.reduce((sum, move) => sum + move.weight, 0);
  return ready.find((move) => (roll -= move.weight) < 0) ?? ready[ready.length - 1];
}

function enemyMove(state: FightState, enemy: Combatant, rng: Rng, events: FightEvent[]): void {
  actEnemy(state, enemy, rng, events);
  // a scanned enemy commits its next move now, so the climber can read it
  if (enemy.scanned && enemy.moves && enemy.hp > 0 && !has(enemy, 'charging')) enemy.planned = pickMove(enemy, rng);
}

function actEnemy(state: FightState, enemy: Combatant, rng: Rng, events: FightEvent[]): void {
  const charging = has(enemy, 'charging');
  if (charging) {
    enemy.statuses = enemy.statuses.filter((s) => s !== charging);
    events.push(strike(state, enemy, state.climber, rng, charging.value));
    return checkEnd(state, events);
  }
  if (!enemy.moves) {
    events.push(strike(state, enemy, state.climber, rng));
    return checkEnd(state, events);
  }
  const move = enemy.planned ?? pickMove(enemy, rng);
  enemy.planned = undefined;
  enemy.turns = (enemy.turns ?? 0) + 1;
  enemy.readyOn = { ...enemy.readyOn, [move.name]: enemy.turns + move.cooldown };
  events.push({ type: 'skill', actor: enemy.name, skill: move.name });

  if (move.type === 'attack') events.push(strike(state, enemy, state.climber, rng, move.power));
  if (move.type === 'guard') applyStatus(enemy, 'guarding', { turns: balance.enemyMoveTurns, value: move.value }); // lasts through the climber's turn
  if (move.type === 'charge') {
    applyStatus(enemy, 'charging', { turns: balance.enemyMoveTurns, value: move.power });
    events.push({ type: 'charge', actor: enemy.name });
  }
  if (move.type === 'status' && move.status) {
    const { id, chance, turns, value } = move.status;
    const event = applyStatus(state.climber, id, { turns, value, attempt: { chance, roll: rng() } });
    if (event) events.push(event);
  }
  checkEnd(state, events);
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
    const isClimber = id === state.climber.id;
    const actor = isClimber ? state.climber : state.enemies.find((e) => e.id === id)!;
    if (isClimber) state.climberTurn += 1;

    if (actor.hp > 0 && startTurn(state, actor, events)) {
      if (isClimber) return;
      if (moveFails(actor, rng)) events.push({ type: 'fail', actor: actor.name });
      else enemyMove(state, actor, rng, events);
      checkEnd(state, events);
      endTurn(actor);
    }
    state.turn += 1;
  }
}

export function startFight(
  climber: Combatant,
  enemies: Combatant[],
  rng: Rng,
  loadout: Loadout = { skills: [], stance: null },
): FightStep {
  const state: FightState = {
    climber: { ...climber, statuses: [...climber.statuses] },
    enemies: enemies.map((e) => ({ ...e, statuses: [...e.statuses] })),
    round: 1,
    turnOrder: [],
    turn: 0,
    outcome: 'ongoing',
    healsUsed: 0,
    skills: loadout.skills,
    readyOn: {},
    climberTurn: 0,
    stance: loadout.stance,
    used: loadout.stance ? [loadout.stance] : [],
    hitsTaken: 0,
  };
  state.turnOrder = roundOrder(state);
  const events: FightEvent[] = [];
  runEnemies(state, rng, events);
  return { state, events };
}

const removableStatus = (c: Combatant) => c.statuses.find((status) => balance.weakStatuses.includes(status.id));

// Why a skill cannot be used right now, or null when it can.
export function skillBlock(state: FightState, id: string): string | null {
  const skill = state.skills.find((s) => s.id === id);
  if (!skill) return 'Not learned';
  if (skill.outsideFight) return 'Not for fights';
  const wait = (state.readyOn[id] ?? 0) - state.climberTurn;
  if (wait > 0) return `Cooldown ${wait}`;
  if (skill.tag === 'Stance' && state.stance === id) return 'Stance active';
  if (skill.cleanse && !removableStatus(state.climber)) return 'No status to remove';
  return null;
}

function useSkill(state: FightState, id: string, targetIndex: number, rng: Rng, events: FightEvent[]): void {
  const block = skillBlock(state, id);
  if (block) throw new Error(block);
  const skill = state.skills.find((s) => s.id === id)!;
  const reduced = state.climber.mind >= balance.cooldownMindThreshold && skill.cooldown > 1;
  state.readyOn[id] = state.climberTurn + skill.cooldown - (reduced ? balance.cooldownMindCut : 0);
  if (!state.used.includes(id)) state.used.push(id);
  events.push({ type: 'skill', actor: state.climber.name, skill: skill.name });

  if (skill.tag === 'Stance') state.stance = id;
  if (skill.cleanse) {
    const status = removableStatus(state.climber)!;
    state.climber.statuses = state.climber.statuses.filter((s) => s !== status);
    events.push({ type: 'cleanse', target: state.climber.name, status: status.id });
  }
  const target = state.enemies[targetIndex];
  if (skill.damage !== undefined) {
    if (!target || target.hp === 0) throw new Error(`Invalid target ${targetIndex}`);
    const bonus = target.scanned ? 1 + (skill.scannedBonus ?? 0) : 1;
    events.push(strike(state, state.climber, target, rng, skill.damage * skill.scale * bonus));
  }
  if (skill.scan) {
    if (!target || target.hp === 0) throw new Error(`Invalid target ${targetIndex}`);
    target.scanned = true;
    if (target.moves && !has(target, 'charging')) target.planned = pickMove(target, rng);
  }
  if (skill.enemyStatus && target?.hp > 0) {
    const { id: status, turns, value } = skill.enemyStatus;
    const event = applyStatus(target, status, { turns, value: value === undefined ? undefined : value * skill.scale });
    if (event) events.push(event);
  }
}

function perform(state: FightState, action: Action, rng: Rng, events: FightEvent[]): void {
  if (action.type === 'skill') return useSkill(state, action.skill, action.target, rng, events);
  if (action.type === 'flee') {
    const block = fleeBlock(state);
    if (block) throw new Error(block);
    if (rng() < fleeChance(effectiveAgility(state.climber))) state.outcome = 'fled';
    else events.push({ type: 'fleeFailed', actor: state.climber.name });
    return;
  }
  if (action.type === 'heal') {
    if (state.healsUsed >= balance.healItemsPerFight) throw new Error('Healing item limit reached');
    state.healsUsed += 1;
    const { climber } = state;
    const amount = Math.min(Math.round(climber.maxHp * action.fraction), climber.maxHp - climber.hp);
    climber.hp += amount;
    events.push({ type: 'heal', target: climber.name, amount });
    return;
  }
  const target = state.enemies[action.target];
  if (!target || target.hp === 0) throw new Error(`Invalid target ${action.target}`);
  events.push(strike(state, state.climber, target, rng));
}

export function act(current: FightState, action: Action, rng: Rng): FightStep {
  if (current.outcome !== 'ongoing') throw new Error('The fight is over');
  const state = structuredClone(current);
  const events: FightEvent[] = [];
  if (moveFails(state.climber, rng)) events.push({ type: 'fail', actor: state.climber.name });
  else perform(state, action, rng, events);
  checkEnd(state, events);
  endTurn(state.climber);
  state.turn += 1;
  runEnemies(state, rng, events);
  return { state, events };
}
