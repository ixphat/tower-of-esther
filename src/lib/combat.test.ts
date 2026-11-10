import { describe, expect, it } from 'vitest';
import {
  act,
  applyStatus,
  climberCombatant,
  createRng,
  enemyGroup,
  fleeBlock,
  fleeChance,
  skillBlock,
  skillScale,
  startFight,
  type Combatant,
  type FightSkill,
} from './combat';

const fighter = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x',
  name: 'X',
  hp: 1000,
  maxHp: 1000,
  attack: 18,
  guard: 3,
  agility: 0,
  mind: 0,
  statuses: [],
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
    const stats = { level: 1, vitality: 8, power: 5, agility: 3, mind: 4, weaponAttack: 8, armorGuard: 6, armorWard: 6 };
    expect(climberCombatant(stats)).toMatchObject({ maxHp: 151, hp: 151, attack: 18, guard: 14, agility: 3 });
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

  it('heals a share of max HP, capped at max, and costs the turn', () => {
    const start = startFight(climber({ hp: 100 }), [enemy()], miss);
    const { state, events } = act(start.state, { type: 'heal', fraction: 0.2 }, miss);
    expect(events[0]).toEqual({ type: 'heal', target: 'Climber', targetId: 'climber', amount: 200 });
    expect(events[1]).toMatchObject({ type: 'hit', attacker: 'E' }); // the enemy replies
    expect(state.round).toBe(2);

    const nearFull = act(startFight(climber({ hp: 950 }), [enemy()], miss).state, { type: 'heal', fraction: 0.2 }, miss);
    expect(nearFull.events[0]).toMatchObject({ amount: 50 });
  });

  it('refuses a third healing item in one fight', () => {
    const heal = { type: 'heal', fraction: 0.2 } as const;
    let { state } = startFight(climber(), [enemy()], miss);
    ({ state } = act(state, heal, miss));
    ({ state } = act(state, heal, miss));
    expect(state.healsUsed).toBe(2);
    expect(() => act(state, heal, miss)).toThrow('Healing item limit reached');
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

describe('skills', () => {
  const miss = () => 0.99;
  const skill = (over: Partial<FightSkill> = {}): FightSkill => ({ id: 's', name: 'S', cooldown: 2, scale: 1, ...over });
  const start = (skills: FightSkill[], c = climber(), e = enemy(), stance: string | null = null) =>
    startFight(c, [e], miss, { skills, stance }).state;
  const use = (id = 's') => ({ type: 'skill', skill: id, target: 0 }) as const;
  const attack = { type: 'attack', target: 0 } as const;

  it('scales by 1% per level and 10% per stage', () => {
    expect(skillScale(0, 1)).toBeCloseTo(1);
    expect(skillScale(0, 10)).toBeCloseTo(1.09);
    expect(skillScale(1, 3)).toBeCloseTo(1.02 * 1.1);
  });

  it('deals skill % of attack, raised by the skill scale', () => {
    const hit = (scale: number) =>
      act(start([skill({ damage: 0.7, scale })]), use(), script(0.99, 0.99, 0.5)).events.find((e) => e.type === 'hit');
    expect(hit(1)).toMatchObject({ damage: 12 }); // 18 * 0.7 * 100 / 103 = 12.23
    expect(hit(2)).toMatchObject({ damage: 24 }); // 24.47
  });

  it('cooldown N is usable again after N turns', () => {
    let state = act(start([skill({ cooldown: 2 })]), use(), miss).state;
    expect(skillBlock(state, 's')).toBe('Cooldown 1');
    expect(() => act(state, use(), miss)).toThrow('Cooldown 1');
    state = act(state, attack, miss).state;
    expect(skillBlock(state, 's')).toBeNull();
  });

  it('cooldown 1 is every turn', () => {
    const state = act(start([skill({ cooldown: 1 })]), use(), miss).state;
    expect(skillBlock(state, 's')).toBeNull();
  });

  it('shortens cooldowns by 1 at Mind 30, down to 1', () => {
    const at = (cooldown: number) => act(start([skill({ cooldown })], climber({ mind: 30 })), use(), miss).state;
    expect(skillBlock(at(3), 's')).toBe('Cooldown 1');
    expect(skillBlock(at(1), 's')).toBeNull();
  });

  it('applies a guaranteed enemy status that lasts through the enemy turn', () => {
    const lowered = skill({ enemyStatus: { id: 'accuracyDown', turns: 1, value: 0.05 }, cooldown: 1 });
    const after = act(start([lowered]), use(), miss);
    expect(after.state.enemies[0].statuses).toEqual([]);
    // the enemy swung under the penalty: 0.04 is below 5%, so it misses
    const missed = act(start([lowered]), use(), script(0.04));
    expect(missed.events.find((e) => e.type === 'miss')).toMatchObject({ attacker: 'E' });
  });

  it('stance changes Guard and damage, and taking it costs the turn', () => {
    const lean = skill({ tag: 'Stance', cooldown: 0, guardBonus: 0.5, damageBonus: -0.5 });
    const { state, events } = act(start([lean]), use(), script(0.99, 0.99, 0.9999));
    expect(state.stance).toBe('s');
    // 18 * 100 / (100 + 3 * 1.5) = 17.22, enemy replied in the same step
    expect(events.find((e) => e.type === 'hit')).toMatchObject({ attacker: 'E', damage: 19 }); // 17.22 x 1.1 roll
    const hit = act(state, attack, script(0.99, 0.99, 0.5)).events.find((e) => e.type === 'hit');
    expect(hit).toMatchObject({ attacker: 'Climber', damage: 9 }); // 17.48 x 0.5
  });

  it('refuses the Stance already active', () => {
    const lean = skill({ tag: 'Stance', cooldown: 0 });
    expect(skillBlock(start([lean], climber(), enemy(), 's'), 's')).toBe('Stance active');
  });

  it('removes one status, and is dimmed with nothing to remove', () => {
    const sweep = skill({ cleanse: true });
    expect(skillBlock(start([sweep]), 's')).toBe('No status to remove');
    const poisoned = climber({ statuses: [{ id: 'poison', turns: 3 }] });
    expect(act(start([sweep], poisoned), use(), miss).state.climber.statuses).toEqual([]);
  });

  it('removes only weak statuses', () => {
    const stunnedOnly = climber({ statuses: [{ id: 'burn', turns: 2 }] });
    expect(skillBlock(start([skill({ cleanse: true })], stunnedOnly), 's')).toBe('No status to remove');
  });

  it('raises a Stance bonus with level but not its drawback', () => {
    const lean = skill({ tag: 'Stance', cooldown: 0, damageBonus: -0.5, scale: 2 });
    const state = start([lean], climber(), enemy(), 's');
    expect(act(state, attack, script(0.99, 0.99, 0.5)).events[0]).toMatchObject({ damage: 9 }); // 17.48 x 0.5, not x 0
  });

  it('tracks skills used once, plus the stance held from the start', () => {
    const lean = skill({ id: 'lean', tag: 'Stance', cooldown: 0 });
    let state = start([skill({ cooldown: 1 }), lean], climber(), enemy(), 'lean');
    expect(state.used).toEqual(['lean']);
    state = act(state, use(), miss).state;
    state = act(state, use(), miss).state;
    expect(state.used).toEqual(['lean', 's']);
  });
});

describe('statuses (04 Systems)', () => {
  const miss = () => 0.99;
  const attack = { type: 'attack', target: 0 } as const;
  const startWith = (c: Combatant, e = enemy()) => startFight(c, [e], miss).state;

  it('poison costs 3% of max HP per turn and ends after 3 turns', () => {
    let state = startWith(climber({ statuses: [{ id: 'poison', turns: 3 }] }));
    expect(state.climber.hp).toBe(970);
    state = act(state, attack, miss).state;
    expect(state.climber.hp).toBeLessThan(960);
    state = act(state, attack, miss).state;
    state = act(state, attack, miss).state;
    expect(state.climber.statuses).toEqual([]);
  });

  it('burn costs 4% of max HP', () => {
    expect(startWith(climber({ statuses: [{ id: 'burn', turns: 2 }] })).climber.hp).toBe(960);
  });

  it('a stunned enemy loses its turn, then is immune for 1 turn', () => {
    const stunned = enemy({ statuses: [{ id: 'stun', turns: 1 }] });
    const step = act(startWith(climber(), stunned), attack, miss);
    expect(step.events.map((e) => e.type)).toEqual(['hit', 'stunned']);
    expect(applyStatus(step.state.enemies[0], 'stun')).toBeNull();
  });

  it('confuse makes a move fail 30% of the time', () => {
    const c = climber({ statuses: [{ id: 'confuse', turns: 2 }] });
    expect(act(startWith(c), attack, script(0.29)).events[0]).toEqual({ type: 'fail', actor: 'Climber' });
    expect(act(startWith(c), attack, script(0.31, 0.99, 0.99, 0.5)).events[0]).toMatchObject({ type: 'hit' });
  });

  it('restrain drops Evasion to 0', () => {
    const e = enemy({ agility: 100, statuses: [{ id: 'restrain', turns: 1 }] });
    expect(act(startWith(climber({ agility: 100 }), e), attack, script(0.01, 0.99, 0.5)).events[0]).toMatchObject({ type: 'hit' });
  });

  it('fear cuts damage by 15%', () => {
    const c = climber({ statuses: [{ id: 'fear', turns: 2 }] });
    expect(act(startWith(c), attack, script(0.99, 0.99, 0.5)).events[0]).toMatchObject({ damage: 15 }); // 14.85
  });

  it('slow cuts Agility by 30% for turn order', () => {
    const state = startWith(climber({ agility: 10, statuses: [{ id: 'slow', turns: 2 }] }), enemy({ agility: 8 }));
    expect(state.turnOrder).toEqual(['e', 'climber']);
  });

  it('reapplying refreshes the duration and does not stack', () => {
    const target = enemy({ statuses: [{ id: 'poison', turns: 1 }] });
    applyStatus(target, 'poison');
    expect(target.statuses).toEqual([{ id: 'poison', turns: 3 }]);
  });

  it('reduces status chance by 0.5 points per Mind', () => {
    const target = enemy({ mind: 20 }); // 30% becomes 20%
    expect(applyStatus(target, 'fear', { attempt: { chance: 0.3, roll: 0.21 } })).toBeNull();
    expect(applyStatus(target, 'fear', { attempt: { chance: 0.3, roll: 0.19 } })).toMatchObject({ type: 'status' });
  });
});

describe('enemy moves and fleeing', () => {
  const pass = () => 0.99;
  const attack = { type: 'attack', target: 0 } as const;
  const lash = { name: 'Lash', type: 'attack', weight: 1, cooldown: 0, power: 1 } as const;
  const hide = { name: 'Hide', type: 'guard', weight: 1, cooldown: 3, value: 0.5 } as const;

  it('cuts each enemy Attack to x0.8 in a pair and x0.6 in a three', () => {
    const one = enemy({ attack: 10 });
    expect(enemyGroup([one]).map((e) => e.attack)).toEqual([10]);
    expect(enemyGroup([one, one]).map((e) => e.attack)).toEqual([8, 8]);
    expect(enemyGroup([one, one, one]).map((e) => e.attack)).toEqual([6, 6, 6]);
  });

  it('picks a move by weight and respects its cooldown', () => {
    const e = enemy({ moves: [lash, hide] });
    // a draw under 0.5 picks Lash, 0.5 or more picks Hide
    const first = act(startFight(climber(), [e], pass).state, attack, script(0.99, 0.99, 0.5, 0.6));
    expect(first.events).toContainEqual({ type: 'skill', actor: 'E', skill: 'Hide' });
    // Hide is cooling down, so the only usable move is Lash even on a high draw
    const second = act(first.state, attack, script(0.99, 0.99, 0.5, 0.9, 0.99, 0.99, 0.5));
    expect(second.events).toContainEqual({ type: 'skill', actor: 'E', skill: 'Lash' });
  });

  it('guarding raises Guard until the end of its next turn', () => {
    const e = enemy({ moves: [{ ...hide, cooldown: 0 }] });
    const { state } = act(startFight(climber(), [e], pass).state, attack, script(0.99, 0.99, 0.5, 0));
    // 18 * 100 / (100 + 3 * 1.5) = 17.22
    expect(act(state, attack, script(0.99, 0.99, 0.5)).events[0]).toMatchObject({ damage: 17 });
  });

  it('a charge winds up, then releases a stronger hit next turn', () => {
    const windUp = { name: 'Overhead', type: 'charge', weight: 1, cooldown: 0, power: 2 } as const;
    const e = enemy({ attack: 10, moves: [windUp] });
    let step = act(startFight(climber({ guard: 0 }), [e], pass).state, attack, script(0.99, 0.99, 0.5, 0));
    expect(step.events.some((ev) => ev.type === 'hit' && ev.attacker === 'E')).toBe(false);
    step = act(step.state, attack, script(0.99, 0.99, 0.5, 0.99, 0.99, 0.5));
    expect(step.events.find((ev) => ev.type === 'hit' && ev.attacker === 'E')).toMatchObject({ damage: 20 });
  });

  it('a status move rolls against the climber Mind', () => {
    const caw = { name: 'Caw', type: 'status', weight: 1, cooldown: 0, status: { id: 'fear', chance: 0.5 } } as const;
    const e = enemy({ moves: [caw] });
    const hit = act(startFight(climber({ mind: 20 }), [e], pass).state, attack, script(0.99, 0.99, 0.5, 0, 0.39));
    expect(hit.state.climber.statuses.map((s) => s.id)).toEqual(['fear']);
    const resisted = act(startFight(climber({ mind: 20 }), [e], pass).state, attack, script(0.99, 0.99, 0.5, 0, 0.41));
    expect(resisted.state.climber.statuses).toEqual([]);
  });

  it('uses a scripted move once when HP falls below its threshold', () => {
    const roar = { belowHp: 0.5, name: 'Roar', type: 'guard', weight: 0, cooldown: 0, value: 0.5 } as const;
    const e = enemy({ hp: 400, maxHp: 1000, moves: [lash], scripted: [roar] });
    let step = act(startFight(climber(), [e], pass).state, attack, pass);
    expect(step.events).toContainEqual({ type: 'skill', actor: 'E', skill: 'Roar' });
    step = act(step.state, attack, pass);
    expect(step.events).not.toContainEqual({ type: 'skill', actor: 'E', skill: 'Roar' });
  });

  it('halves damage over time on elites and stronger', () => {
    const strong = enemy({ tier: 'elite', statuses: [{ id: 'poison', turns: 3 }] });
    const step = act(startFight(climber(), [strong], pass).state, attack, pass);
    expect(step.events).toContainEqual({ type: 'tick', target: 'E', status: 'poison', damage: 15 }); // 3% of 1000, halved
  });

  it('flees at 40% + 1% per Agility, costing the turn', () => {
    const c = climber({ agility: 10 }); // 50%
    expect(act(startFight(c, [enemy()], pass).state, { type: 'flee' }, script(0.49)).state.outcome).toBe('fled');
    const failed = act(startFight(c, [enemy()], pass).state, { type: 'flee' }, script(0.51));
    expect(failed.state.outcome).toBe('ongoing');
    expect(failed.events[0]).toEqual({ type: 'fleeFailed', actor: 'Climber' });
  });

  it('logs the end of a fight once when an enemy move defeats the climber', () => {
    const e = enemy({ attack: 5000, moves: [lash] });
    const { events } = act(startFight(climber({ hp: 1 }), [e], pass).state, attack, script(0.99, 0.99, 0.5, 0, 0.99, 0.99, 0.5));
    expect(events.filter((ev) => ev.type === 'end')).toHaveLength(1);
  });

  it('caps flee chance at 90%', () => {
    expect(fleeChance(500)).toBe(0.9);
  });

  it('cannot flee a mini-boss', () => {
    const state = startFight(climber(), [enemy({ tier: 'miniBoss' })], pass).state;
    expect(fleeBlock(state)).toBe('Cannot flee this fight');
    expect(() => act(state, { type: 'flee' }, pass)).toThrow('Cannot flee this fight');
  });
});

describe('Seeker skills', () => {
  const pass = () => 0.99;
  const lash = { name: 'Lash', type: 'attack', weight: 1, cooldown: 0, power: 1 } as const;
  const hide = { name: 'Hide', type: 'guard', weight: 1, cooldown: 0, value: 0.5 } as const;
  const scan: FightSkill = { id: 'scan', name: 'Scan', cooldown: 3, scale: 1, scan: true };
  const keen: FightSkill = { id: 'keen', name: 'Keen', cooldown: 2, scale: 1, damage: 1, scannedBonus: 0.3 };

  it('Scan commits the next move, and the enemy uses it', () => {
    const e = enemy({ moves: [lash, hide] });
    const step = act(startFight(climber(), [e], pass, { skills: [scan], stance: null }).state, { type: 'skill', skill: 'scan', target: 0 }, script(0.6, 0.1));
    expect(step.events).toContainEqual({ type: 'skill', actor: 'E', skill: 'Hide' }); // 0.6 picked Hide at the scan
    expect(step.state.enemies[0].planned?.name).toBe('Lash'); // 0.1 picked its next move after it acted
  });

  it('a scanned enemy keeps showing its next move after each action', () => {
    const e = enemy({ moves: [lash, hide] });
    const scanned = act(startFight(climber(), [e], pass, { skills: [scan], stance: null }).state, { type: 'skill', skill: 'scan', target: 0 }, script(0.6, 0.1)).state;
    const next = act(scanned, { type: 'attack', target: 0 }, script(0.99, 0.99, 0.5, 0.99, 0.99, 0.5, 0.6));
    expect(next.events).toContainEqual({ type: 'skill', actor: 'E', skill: 'Lash' }); // used as planned
    expect(next.state.enemies[0].planned?.type).toBe('guard');
  });

  it('Keen Strike hits 30% harder on a scanned target', () => {
    const strikeOn = (scanned: boolean) =>
      act(startFight(climber(), [enemy({ scanned })], pass, { skills: [keen], stance: null }).state, { type: 'skill', skill: 'keen', target: 0 }, script(0.99, 0.99, 0.5)).events[1];
    expect(strikeOn(false)).toMatchObject({ damage: 17 }); // 17.48
    expect(strikeOn(true)).toMatchObject({ damage: 23 }); // 22.72
  });

  it('a skill for outside fights is dimmed in a fight', () => {
    const room: FightSkill = { id: 'room', name: 'Room', cooldown: 0, scale: 1, outsideFight: true };
    expect(skillBlock(startFight(climber(), [enemy()], pass, { skills: [room], stance: null }).state, 'room')).toBe('Not for fights');
  });
});

describe('the Keeper trial', () => {
  const pass = () => 0.99;
  const attack = { type: 'attack', target: 0 } as const;

  it('he yields at low HP, which wins the fight', () => {
    const keeper = enemy({ hp: 210, maxHp: 1000, yieldBelow: 0.2 });
    const { state, events } = act(startFight(climber({ attack: 18 }), [keeper], pass).state, attack, script(0.99, 0.99, 0.5));
    expect(events).toContainEqual({ type: 'yield', actor: 'E' });
    expect(state.outcome).toBe('won');
    expect(state.enemies[0].hp).toBeGreaterThan(0);
  });

  it('a single big hit still ends in a yield, not a kill', () => {
    const keeper = enemy({ hp: 300, maxHp: 1000, yieldBelow: 0.2 });
    const { state } = act(startFight(climber({ attack: 9000 }), [keeper], pass).state, attack, script(0.99, 0.99, 0.5));
    expect(state.enemies[0]).toMatchObject({ hp: 1, yielded: true });
  });

  it('he never takes the climber below 1 HP', () => {
    const keeper = enemy({ attack: 5000, spare: true });
    const { state } = act(startFight(climber({ hp: 10 }), [keeper], pass).state, attack, pass);
    expect(state.climber.hp).toBe(1);
    expect(state.outcome).toBe('ongoing');
  });

  it('counts hits taken by the climber', () => {
    let { state } = startFight(climber(), [enemy()], pass);
    state = act(state, attack, pass).state;
    state = act(state, attack, pass).state;
    expect(state.hitsTaken).toBe(2);
  });
});
