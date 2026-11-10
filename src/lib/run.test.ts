import { describe, expect, it } from 'vitest';
import type { Floor } from './data';
import { applyAction, fightRewards, newRun, resumeRun, type RunState } from './run';

const floor: Floor = {
  id: 1,
  name: 'Test',
  recommendedGrade: 'F',
  start: 'gate',
  locations: [
    { id: 'gate', name: 'Gate', description: '', exits: ['inn', 'field'] },
    { id: 'inn', name: 'Inn', description: '', exits: ['gate'], rest: true, shop: ['basic-salve', 'plain-coat', 'ration'] },
    { id: 'field', name: 'Field', description: '', exits: ['gate'] },
  ],
};

const full = newRun(floor).hp;
const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun(floor), ...over });
const lose = { type: 'fightEnd', outcome: 'lost' } as const;
const rewards = (exp = 0, drops = {}) => ({ exp, monsterPoints: 0, drops });
const win = (exp: number, hp = 40) => ({ type: 'fightEnd', outcome: 'won', hp, rewards: rewards(exp), used: [] as string[] }) as const;

describe('HP between fights', () => {
  it('starts full at the floor start, with the start as safe point', () => {
    expect(newRun(floor)).toMatchObject({ locationId: 'gate', safePoint: 'gate', memoriesLost: 0 });
  });

  it('keeps the HP a won fight ended on, through moves', () => {
    let state = applyAction(run(), floor, { type: 'fightEnd', outcome: 'won', hp: 40, rewards: rewards(), used: [] as string[] });
    state = applyAction(state, floor, { type: 'move', to: 'field' });
    expect(state.hp).toBe(40);
  });

  it('restores full HP at a resting place', () => {
    const state = applyAction(run({ locationId: 'inn', hp: 1 }), floor, { type: 'rest' });
    expect(state.hp).toBe(full);
  });

  it('refuses to rest anywhere else', () => {
    expect(() => applyAction(run({ hp: 1 }), floor, { type: 'rest' })).toThrow('No resting place here');
  });

  it('refuses a move that is not an exit', () => {
    expect(() => applyAction(run({ locationId: 'inn' }), floor, { type: 'move', to: 'field' })).toThrow();
  });
});

describe('EXP from wins', () => {
  it('adds EXP below the level cost', () => {
    expect(applyAction(run({ exp: 10 }), floor, win(5))).toMatchObject({ level: 1, exp: 15 });
  });

  it('levels up at exactly 100 x level and keeps the remainder', () => {
    expect(applyAction(run({ exp: 99 }), floor, win(1))).toMatchObject({ level: 2, exp: 0 });
    expect(applyAction(run(), floor, win(350))).toMatchObject({ level: 3, exp: 50 });
  });

  it('restores full HP at the new level on level-up', () => {
    expect(applyAction(run({ exp: 99 }), floor, win(1, 40)).hp).toBe(168);
  });

  it('keeps fight-end HP when no level is gained', () => {
    expect(applyAction(run({ exp: 98 }), floor, win(1, 40)).hp).toBe(40);
  });

  it('never drops the level on defeat', () => {
    expect(applyAction(run({ level: 3, exp: 0 }), floor, lose).level).toBe(3);
  });

  it('rests to the max HP of the current level', () => {
    expect(applyAction(run({ level: 2, locationId: 'inn', hp: 1 }), floor, { type: 'rest' }).hp).toBe(168);
  });
});

describe('rewards and respawn', () => {
  const won = { type: 'fightEnd', outcome: 'won', hp: 40, rewards: rewards(1, { 'straw-thread': 2 }), used: [] as string[] } as const;

  it('puts drops in the run and pays no coins', () => {
    const state = applyAction(run({ coins: 1, items: { 'straw-thread': 3 } }), floor, won);
    expect(state).toMatchObject({ coins: 1, items: { 'straw-thread': 5 } });
  });

  it('adds up the rewards of every foe', () => {
    const foe = { id: 'a', name: 'A', tier: 'normal' as const, moves: [], hp: 1, attack: 1, def: 0, agility: 0, exp: 1, monsterPoints: 2, mind: 2, drops: { 'straw-thread': 1 } };
    expect(fightRewards([foe, foe])).toEqual({ exp: 2, monsterPoints: 4, drops: { 'straw-thread': 2 } });
  });

  it('keeps HP and gives nothing after fleeing, leaving the monsters there', () => {
    const state = applyAction(run({ locationId: 'field', inFight: true }), floor, { type: 'fightEnd', outcome: 'fled', hp: 33 });
    expect(state).toMatchObject({ hp: 33, inFight: false, exp: 0, cleared: [] });
  });

  it('clears the location on a win and respawns on re-entry', () => {
    let state = applyAction(run({ locationId: 'field' }), floor, won);
    expect(state.cleared).toEqual(['field']);
    state = applyAction(state, floor, { type: 'move', to: 'gate' });
    expect(state.cleared).toEqual(['field']);
    state = applyAction(state, floor, { type: 'move', to: 'field' });
    expect(state.cleared).toEqual([]);
  });
});

describe('items', () => {
  const inn = { locationId: 'inn' };

  it('starts with 100 coins, 3 Basic Salves and the starting weapon worn', () => {
    expect(newRun(floor)).toMatchObject({ coins: 100, items: { 'basic-salve': 3 }, worn: { weapon: 'worn-sword' } });
  });

  it('spends one item in a fight without healing here', () => {
    const state = applyAction(run({ hp: 10 }), floor, { type: 'spendItem', item: 'basic-salve' });
    expect(state).toMatchObject({ hp: 10, items: { 'basic-salve': 2 } });
  });

  it('heals when used outside a fight, capped at max HP', () => {
    expect(applyAction(run({ hp: 10 }), floor, { type: 'useItem', item: 'basic-salve' }).hp).toBe(40); // 20% of 151 = 30
    expect(applyAction(run({ hp: full - 1 }), floor, { type: 'useItem', item: 'basic-salve' }).hp).toBe(full);
  });

  it('refuses an item the climber does not hold', () => {
    expect(() => applyAction(run({ items: {} }), floor, { type: 'useItem', item: 'basic-salve' })).toThrow();
  });

  it('buys from the local stall and spends coins', () => {
    const state = applyAction(run({ ...inn, coins: 35, items: {} }), floor, { type: 'buy', item: 'basic-salve' });
    expect(state).toMatchObject({ coins: 5, items: { 'basic-salve': 1 } });
  });

  it('refuses a purchase without enough coins or away from the stall', () => {
    expect(() => applyAction(run({ ...inn, coins: 29 }), floor, { type: 'buy', item: 'basic-salve' })).toThrow();
    expect(() => applyAction(run({ coins: 99 }), floor, { type: 'buy', item: 'basic-salve' })).toThrow();
    expect(() => applyAction(run({ ...inn, coins: 999 }), floor, { type: 'buy', item: 'herb-draught' })).toThrow();
  });

  it('equips a carried piece and returns the old one to the bag', () => {
    const before = run({ items: { 'plain-coat': 1 }, worn: { weapon: 'worn-sword', body: 'plain-cap' } });
    expect(applyAction(before, floor, { type: 'equip', item: 'plain-coat' })).toMatchObject({
      items: { 'plain-coat': 0, 'plain-cap': 1 },
      worn: { weapon: 'worn-sword', body: 'plain-coat' },
    });
  });
});

describe('skills', () => {
  const after = (points: number, used: string[]) => ({ type: 'fightEnd', outcome: 'won', hp: 40, rewards: { exp: 0, monsterPoints: points, drops: {} }, used }) as const;
  const skill = (stage: number, level: number, skillPoints: number) => ({ whistle: { stage, level, proficiency: skillPoints } });

  it('starts with the four scrap skills at Novice Lv 1, pinned', () => {
    const start = newRun(floor);
    expect(start.skills.whistle).toEqual({ stage: 0, level: 1, proficiency: 0 });
    expect(start.pins).toEqual(['whistle', 'stubborn-lean', 'straw-toss', 'sweep-up', null, null]);
  });

  it('gains the fight total once per used skill, not per use', () => {
    const state = applyAction(run(), floor, after(3, ['whistle']));
    expect(state.skills.whistle.proficiency).toBe(3);
    expect(state.skills['sweep-up'].proficiency).toBe(0);
  });

  it('levels at 10 x level x stage multiplier', () => {
    expect(applyAction(run({ skills: skill(0, 1, 9) }), floor, after(1, ['whistle'])).skills.whistle).toEqual({ stage: 0, level: 2, proficiency: 0 });
    expect(applyAction(run({ skills: skill(1, 1, 19) }), floor, after(1, ['whistle'])).skills.whistle).toEqual({ stage: 1, level: 2, proficiency: 0 });
    expect(applyAction(run({ skills: skill(1, 1, 18) }), floor, after(1, ['whistle'])).skills.whistle).toEqual({ stage: 1, level: 1, proficiency: 19 });
  });

  it('stops at Lv 10 until a stage-up', () => {
    expect(applyAction(run({ skills: skill(0, 10, 0) }), floor, after(999, ['whistle'])).skills.whistle).toEqual({ stage: 0, level: 10, proficiency: 0 });
  });

  it('gains nothing from a defeat', () => {
    expect(applyAction(run(), floor, lose).skills.whistle.proficiency).toBe(0);
  });

  it('pins and unpins into the first free slot', () => {
    let state = applyAction(run(), floor, { type: 'togglePin', skill: 'whistle' });
    expect(state.pins).toEqual([null, 'stubborn-lean', 'straw-toss', 'sweep-up', null, null]);
    state = applyAction(state, floor, { type: 'togglePin', skill: 'whistle' });
    expect(state.pins[0]).toBe('whistle');
  });

  it('refuses to pin a skill not learned', () => {
    expect(() => applyAction(run({ skills: {} }), floor, { type: 'togglePin', skill: 'whistle' })).toThrow('not learned');
  });

  it('refuses a pin when all 6 slots are full', () => {
    const full = run({ pins: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(() => applyAction(full, floor, { type: 'togglePin', skill: 'whistle' })).toThrow('Pins full');
  });

  it('sets a free pre-fight Stance, only from Stance skills', () => {
    expect(applyAction(run(), floor, { type: 'setStance', skill: 'stubborn-lean' }).stance).toBe('stubborn-lean');
    expect(() => applyAction(run(), floor, { type: 'setStance', skill: 'whistle' })).toThrow();
    expect(applyAction(run({ stance: 'stubborn-lean' }), floor, { type: 'setStance', skill: null }).stance).toBeNull();
  });
});

describe('leaving a fight unfinished', () => {
  it('counts as a defeat when the run resumes', () => {
    const started = applyAction(run({ locationId: 'field', exp: 200 }), floor, { type: 'fightStart' });
    expect(resumeRun(started, floor)).toMatchObject({ locationId: 'gate', hp: full, exp: 180, memoriesLost: 1, inFight: false });
  });

  it('costs nothing once the fight has ended', () => {
    const started = applyAction(run({ hp: 90 }), floor, { type: 'fightStart' });
    const ended = applyAction(started, floor, { type: 'fightEnd', outcome: 'won', hp: 40, rewards: rewards(), used: [] as string[] });
    expect(resumeRun(ended, floor)).toEqual({ ...run(), hp: 40, cleared: ['gate'] });
  });
});

describe('defeat (04 Systems)', () => {
  it('returns to the floor start at full HP before a resting place is found', () => {
    const state = applyAction(run({ locationId: 'field', hp: 3 }), floor, lose);
    expect(state).toMatchObject({ locationId: 'gate', hp: full });
  });

  it('returns to the resting place once found, even after walking back past the start', () => {
    let state = applyAction(run(), floor, { type: 'move', to: 'inn' });
    state = applyAction(state, floor, { type: 'move', to: 'gate' });
    state = applyAction(state, floor, { type: 'move', to: 'field' });
    expect(applyAction(state, floor, lose).locationId).toBe('inn');
  });

  it('takes 10% of EXP progress, rounding the loss up', () => {
    expect(applyAction(run({ exp: 200 }), floor, lose).exp).toBe(180);
    expect(applyAction(run({ exp: 25 }), floor, lose).exp).toBe(22);
    expect(applyAction(run({ exp: 30 }), floor, lose).exp).toBe(27);
    expect(applyAction(run({ exp: 0 }), floor, lose).exp).toBe(0);
  });

  it('drops the most recently raised bond to the start of the previous level', () => {
    const state = applyAction(run({ bonds: { keeper: 45, other: 45 }, lastBond: 'keeper' }), floor, lose);
    expect(state.bonds).toEqual({ keeper: 10, other: 45 });
  });

  it('never lowers a bond below Stranger', () => {
    const state = applyAction(run({ bonds: { keeper: 5 }, lastBond: 'keeper' }), floor, lose);
    expect(state.bonds).toEqual({ keeper: 5 });
  });

  it('counts a memory lost and changes nothing else', () => {
    const before = run({ exp: 0, memoriesLost: 2, bonds: { keeper: 0 }, lastBond: 'keeper' });
    expect(applyAction(before, floor, lose)).toEqual({ ...before, memoriesLost: 3 });
  });
});
