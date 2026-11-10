import { describe, expect, it } from 'vitest';
import { floors } from './data';
import { sceneAt } from './dialogue';
import { questBoard, secretsScore } from './quests';
import { maxHp } from './climber';
import { applyAction, newRun, type RunState } from './run';

const START = { name: 'Ash', portrait: 1, giftClass: 'vanguard' };
const VANGUARD = { classId: 'vanguard', hp: 151, worn: { weapon: 'worn-sword' }, items: { 'basic-salve': 3 }, skills: Object.fromEntries(['whistle', 'stubborn-lean', 'straw-toss', 'sweep-up'].map((id) => [id, { stage: 0, level: 1, proficiency: 0 }])), pins: ['whistle', 'stubborn-lean', 'straw-toss', 'sweep-up', null, null] };

const floor = floors.find((f) => f.id === 1)!;
const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun(floor, START), ...VANGUARD, ...over });
const see = (scene: string, node: string) => ({ type: 'seeLine', scene, node }) as const;

describe('quests from data', () => {
  it('always shows the main quest at its current step, with directions in words', () => {
    const board = questBoard(run());
    expect(board.main).toMatchObject({ id: 'first-trial', step: 'The Tower is waiting for an answer about its gift.' });
    expect(questBoard(run({ flags: ['gift-refused'] })).main?.step).toMatch(/^Learn how things work here/);
  });

  it('starts a side quest only once offered, and advances on held items', () => {
    expect(questBoard(run()).side).toEqual([]);
    const offered = run({ flags: ['offered-tidy'] });
    expect(questBoard(offered).side[0]).toMatchObject({ id: 'tidy-village', step: expect.stringMatching(/^Gather five/) });
    expect(questBoard({ ...offered, items: { 'straw-thread': 5 } }).side[0].step).toMatch(/^Bring the straw/);
  });

  it('never lists a secret before it is found', () => {
    expect(questBoard(run()).secrets).toEqual([]);
    expect(questBoard(run({ flags: ['found-school-clue'] })).secrets.map((s) => s.title)).toEqual([
      'Chalk on the schoolhouse board',
    ]);
  });

  it('moves a finished quest to Done', () => {
    const board = questBoard(run({ flags: ['offered-tidy', 'tidy-done'] }));
    expect(board.side).toEqual([]);
    expect(board.done.map((q) => q.id)).toEqual(['tidy-village']);
  });

  it('tracks up to 3 side quests besides the main one', () => {
    const open = ['offered-tidy', 'offered-belongings', 'offered-table'];
    let state = run({ flags: open });
    for (const id of ['tidy-village', 'belongings', 'set-the-table']) state = applyAction(state, floor, { type: 'toggleTrack', quest: id });
    expect(() => applyAction(state, floor, { type: 'toggleTrack', quest: 'other' })).toThrow('Track up to 3');
    expect(applyAction(state, floor, { type: 'toggleTrack', quest: 'belongings' }).tracked).toEqual(['tidy-village', 'set-the-table']);
  });

  it('frees the slot of a finished quest', () => {
    const state = run({ flags: ['offered-tidy', 'tidy-done', 'offered-belongings'], tracked: ['tidy-village', 'x', 'y'] });
    expect(applyAction(state, floor, { type: 'toggleTrack', quest: 'belongings' }).tracked).toEqual(['belongings']);
  });
});

describe('scene effects that pay quests', () => {
  it('turning in the straw takes it and pays bond, EXP and 50 coins once', () => {
    const before = run({ flags: ['offered-tidy'], items: { 'straw-thread': 7 }, coins: 0 });
    const after = applyAction(before, floor, see('keeper-tidy-done', 'b'));
    expect(after).toMatchObject({ items: { 'straw-thread': 2 }, coins: 50, exp: 18, bonds: { keeper: 15 } });
    expect(applyAction(after, floor, see('keeper-tidy-done', 'b'))).toEqual(after);
  });

  it('the Keeper Trusted quest gives the lamp oil and his clue', () => {
    const before = run({ flags: ['offered-table'], items: { plate: 3 }, bonds: { keeper: 60 } });
    const after = applyAction(before, floor, see('keeper-table-done', 'e'));
    expect(after.items).toMatchObject({ plate: 0, 'lamp-oil': 1 });
    expect(after.flags).toContain('table-set');
    expect(after.bonds.keeper).toBe(80);
  });

  it('the Close choice gives either the Tidy Up skill or the spare key', () => {
    const skill = applyAction(run(), floor, see('keeper-close', 'skill'));
    expect(skill.skills['tidy-up']).toEqual({ stage: 0, level: 1, proficiency: 0 });
    const key = applyAction(run(), floor, see('keeper-close', 'key'));
    expect(key.items['keepers-spare-key']).toBe(1);
    expect(key.skills['tidy-up']).toBeUndefined();
  });

  it('a level-up from quest EXP restores HP', () => {
    const after = applyAction(run({ exp: 90, hp: 10 }), floor, see('tower-master', 'a'));
    expect(after).toMatchObject({ level: 2, exp: 17, hp: 168 });
  });
});

describe('looking around', () => {
  it('offers a place scene only while its condition holds', () => {
    expect(sceneAt('fields', run())?.id).toBe('look-fields-flower');
    expect(sceneAt('schoolhouse', run())?.id).toBe('school-board');
    expect(sceneAt('schoolhouse', run({ flags: ['found-school-clue'] }))).toBeUndefined();
  });

  it('entering the gate notes the mark', () => {
    const at = applyAction(run(), floor, { type: 'move', to: 'gate' });
    expect(at.flags).toContain('seen-gate-mark');
  });

  it('records each enemy met once', () => {
    let state = applyAction(run(), floor, { type: 'fightStart', foes: ['crow', 'crow'] });
    state = applyAction(state, floor, { type: 'fightStart', foes: ['crow', 'straw-remnant'] });
    expect(state.met).toEqual(['crow', 'straw-remnant']);
  });
});

describe('refusal path and secrets', () => {
  it('the Back Lane is only there after refusing', () => {
    expect(() => applyAction(run({ locationId: 'houses' }), floor, { type: 'move', to: 'back-lane' })).toThrow();
    const refused = run({ locationId: 'houses', flags: ['gift-refused'] });
    expect(applyAction(refused, floor, { type: 'move', to: 'back-lane' }).locationId).toBe('back-lane');
  });

  it("the letter makes a refuser a Seeker with its first skills", () => {
    const refused = run({ classId: 'none', flags: ['gift-refused'], skills: {} , pins: [null, null, null, null, null, null] });
    expect(sceneAt('back-lane', refused)?.id).toBe('seeker-letter');
    const after = applyAction(refused, floor, see('seeker-letter', 'b'));
    expect(after.classId).toBe('seeker');
    expect(Object.keys(after.skills)).toEqual(['scan', 'read-the-room', 'keen-strike']);
    expect(questBoard(after).secrets.map((s) => s.title)).toContain('The gift you refused');
  });

  it('finding the schoolhouse clue adds its Secrets points', () => {
    expect(secretsScore(run(), floor)).toBe(0);
    expect(secretsScore(run({ flags: ['found-school-clue'] }), floor)).toBe(25);
  });
});
