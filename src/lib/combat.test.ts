import { describe, expect, it } from 'vitest';
import { act, climberCombatant, createRng, startFight, type Combatant } from './combat';

const fighter = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x',
  name: 'X',
  hp: 1000,
  maxHp: 1000,
  attack: 18,
  guard: 3,
  agility: 0,
  ...over,
});
const climber = (over: Partial<Combatant> = {}) => fighter({ id: 'climber', name: 'Climber', ...over });
const enemy = (over: Partial<Combatant> = {}) => fighter({ id: 'e', name: 'E', ...over });

// Scripted random source: hit, crit, damage roll, in draw order. Defaults keep the enemy's reply harmless to assert around.
const script = (...values: number[]) => () => values.shift() ?? 0.99;

function firstHit(values: number[], c = climber(), e = enemy()) {
  const start = startFight(c, [e], () => 0.99);
  return act(start.state, { type: 'attack', target: 0 }, script(...values)).events[0];
}

describe('strike formulas (04 Systems)', () => {
  it('reduces attack by Guard at a neutral roll', () => {
    // 18 * 100 / 103 = 17.48
    expect(firstHit([0.99, 0.99, 0.5])).toMatchObject({ type: 'hit', damage: 17, crit: false });
  });

  it('applies the x0.9 and x1.1 damage roll ends', () => {
    expect(firstHit([0.99, 0.99, 0])).toMatchObject({ damage: 16 }); // 15.73
    expect(firstHit([0.99, 0.99, 0.9999])).toMatchObject({ damage: 19 }); // 19.22
  });

  it('crits for x1.5 at 5% + 0.5% per Agility', () => {
    const c = climber({ agility: 7 }); // 8.5%
    expect(firstHit([0.99, 0.08, 0.5], c)).toMatchObject({ crit: true, damage: 26 }); // 26.21
    expect(firstHit([0.99, 0.09, 0.5], c)).toMatchObject({ crit: false });
  });

  it('caps crit chance at 50%', () => {
    const c = climber({ agility: 500 });
    expect(firstHit([0.99, 0.49, 0.5], c)).toMatchObject({ crit: true });
    expect(firstHit([0.99, 0.51, 0.5], c)).toMatchObject({ crit: false });
  });

  it('dodges at 0.3% per Agility, capped at 40%', () => {
    expect(firstHit([0.008], climber(), enemy({ agility: 3 }))).toMatchObject({ type: 'miss' }); // 0.9%
    expect(firstHit([0.01, 0.99, 0.5], climber(), enemy({ agility: 3 }))).toMatchObject({ type: 'hit' });
    const fast = enemy({ agility: 500 });
    expect(firstHit([0.39], climber({ agility: 500 }), fast)).toMatchObject({ type: 'miss' });
    expect(firstHit([0.41, 0.99, 0.5], climber({ agility: 500 }), fast)).toMatchObject({ type: 'hit' });
  });

  it('deals at least 1 on a hit that lands', () => {
    expect(firstHit([0.99, 0.99, 0], climber({ attack: 1 }), enemy({ guard: 5000 }))).toMatchObject({ damage: 1 });
  });

  it('derives the climber from core stats', () => {
    const stats = { level: 1, vitality: 8, power: 5, agility: 3, mind: 4, weaponAttack: 8 };
    expect(climberCombatant(stats)).toMatchObject({ maxHp: 151, hp: 151, attack: 18, guard: 8, agility: 3 });
  });
});

describe('fight flow', () => {
  const attack = { type: 'attack', target: 0 } as const;
  const miss = () => 0.99;

  it('lets a faster enemy act before the climber, and gives ties to the climber', () => {
    const faster = startFight(climber({ agility: 3 }), [enemy({ agility: 4 })], miss);
    expect(faster.events[0]).toMatchObject({ type: 'hit', attacker: 'E' });
    expect(faster.state.turnOrder).toEqual(['e', 'climber']);

    const tied = startFight(climber({ agility: 3 }), [enemy({ agility: 3 })], miss);
    expect(tied.events).toEqual([]);
    expect(tied.state.turnOrder).toEqual(['climber', 'e']);
  });

  it('runs the enemy reply and starts the next round', () => {
    const { state, events } = act(startFight(climber(), [enemy()], miss).state, attack, miss);
    expect(events.map((e) => e.type)).toEqual(['hit', 'hit']);
    expect(state.round).toBe(2);
  });

  it('wins when the last enemy falls, and the dead enemy does not reply', () => {
    const start = startFight(climber(), [enemy({ hp: 1 })], miss);
    const { state, events } = act(start.state, attack, miss);
    expect(state.outcome).toBe('won');
    expect(events.map((e) => e.type)).toEqual(['hit', 'end']);
  });

  it('loses when the climber falls', () => {
    const start = startFight(climber({ hp: 1 }), [enemy()], miss);
    const { state, events } = act(start.state, attack, miss);
    expect(state.outcome).toBe('lost');
    expect(state.climber.hp).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'end', outcome: 'lost' });
  });

  it('refuses actions after the fight ends and leaves the old state unchanged', () => {
    const start = startFight(climber(), [enemy({ hp: 1 })], miss);
    const hp = start.state.enemies[0].hp;
    const { state } = act(start.state, attack, miss);
    expect(start.state.enemies[0].hp).toBe(hp);
    expect(() => act(state, attack, miss)).toThrow('The fight is over');
  });

  it('plays the same fight from the same seed', () => {
    const play = (seed: number) => {
      const rng = createRng(seed);
      let step = startFight(climber({ agility: 5 }), [enemy({ hp: 70, agility: 3 })], rng);
      const log = [...step.events];
      while (step.state.outcome === 'ongoing') {
        step = act(step.state, attack, rng);
        log.push(...step.events);
      }
      return log;
    };
    expect(play(42)).toEqual(play(42));
    expect(play(42)).not.toEqual(play(43));
  });
});
