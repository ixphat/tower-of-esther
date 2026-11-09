import { describe, expect, it } from 'vitest';
import type { Floor } from './data';
import { applyAction, newRun, resumeRun, type RunState } from './run';

const floor: Floor = {
  id: 1,
  name: 'Test',
  recommendedGrade: 'F',
  start: 'gate',
  locations: [
    { id: 'gate', name: 'Gate', description: '', exits: ['inn', 'field'] },
    { id: 'inn', name: 'Inn', description: '', exits: ['gate'], rest: true },
    { id: 'field', name: 'Field', description: '', exits: ['gate'] },
  ],
};

const full = newRun(floor).hp;
const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun(floor), ...over });
const lose = { type: 'fightEnd', outcome: 'lost' } as const;
const win = (exp: number, hp = 40) => ({ type: 'fightEnd', outcome: 'won', hp, exp }) as const;

describe('HP between fights', () => {
  it('starts full at the floor start, with the start as safe point', () => {
    expect(newRun(floor)).toMatchObject({ locationId: 'gate', safePoint: 'gate', memoriesLost: 0 });
  });

  it('keeps the HP a won fight ended on, through moves', () => {
    let state = applyAction(run(), floor, { type: 'fightEnd', outcome: 'won', hp: 40, exp: 0 });
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

describe('leaving a fight unfinished', () => {
  it('counts as a defeat when the run resumes', () => {
    const started = applyAction(run({ locationId: 'field', exp: 200 }), floor, { type: 'fightStart' });
    expect(resumeRun(started, floor)).toMatchObject({ locationId: 'gate', hp: full, exp: 180, memoriesLost: 1, inFight: false });
  });

  it('costs nothing once the fight has ended', () => {
    const started = applyAction(run({ hp: 90 }), floor, { type: 'fightStart' });
    const ended = applyAction(started, floor, { type: 'fightEnd', outcome: 'won', hp: 40, exp: 0 });
    expect(resumeRun(ended, floor)).toEqual({ ...run(), hp: 40 });
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
