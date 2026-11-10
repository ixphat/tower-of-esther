import { describe, expect, it } from 'vitest';
import { gradeClear, isBetter } from './clear';
import { floors } from './data';
import { applyAction, newRun, type RunState } from './run';

const floor = floors.find((f) => f.id === 1)!;
const run = (over: Partial<RunState> = {}): RunState => ({
  ...newRun(floor, { name: 'Ash', portrait: 1, giftClass: 'vanguard' }),
  classId: 'vanguard',
  hp: 151,
  ...over,
});
const passed = (over: Partial<RunState> = {}) => run({ trial: { turns: 10, unhit: false }, ...over, flags: ['trial-passed', ...(over.flags ?? [])] });

describe('clear grade (Floor 1 criteria)', () => {
  it('scores a bare accepted clear', () => {
    const grade = gradeClear(passed({ flags: ['gift-accepted'] }), floor);
    expect(grade).toMatchObject({ path: 15, content: 0, secrets: 0, style: 10, total: 25, grade: 'E' });
  });

  it('pays 30 for refusing and finding the hidden path, 15 for refusing only', () => {
    expect(gradeClear(passed({ flags: ['gift-refused', 'read-seeker-letter'] }), floor).path).toBe(30);
    expect(gradeClear(passed({ flags: ['gift-refused'] }), floor).path).toBe(15);
  });

  it('counts both side quests and the Keeper bond toward Content', () => {
    const flags = ['gift-accepted', 'tidy-done', 'offered-tidy', 'belongings-done', 'offered-belongings'];
    expect(gradeClear(passed({ flags, bonds: { keeper: 100 } }), floor).content).toBe(25);
    expect(gradeClear(passed({ flags, bonds: { keeper: 30 } }), floor).content).toBe(18); // Friendly = 2 of 4 levels
  });

  it('gives full Style at 8 turns, half at 12, none beyond', () => {
    expect(gradeClear(passed({ flags: ['gift-accepted'], trial: { turns: 8, unhit: false } }), floor).style).toBe(20);
    expect(gradeClear(passed({ flags: ['gift-accepted'], trial: { turns: 12, unhit: false } }), floor).style).toBe(10);
    expect(gradeClear(passed({ flags: ['gift-accepted'], trial: { turns: 13, unhit: false } }), floor).style).toBe(0);
  });

  it('lists what is missing for Path, Content and Style but only a score for Secrets', () => {
    const grade = gradeClear(passed({ flags: ['gift-accepted'] }), floor);
    expect(grade.missing.content.length).toBeGreaterThan(0);
    expect(grade).not.toHaveProperty('missing.secrets');
  });

  it('SSS needs 95 points and the hidden condition', () => {
    const flags = ['gift-refused', 'read-seeker-letter', 'found-school-clue', 'tidy-done', 'offered-tidy', 'belongings-done', 'offered-belongings'];
    const best = { flags, bonds: { keeper: 100 }, trial: { turns: 8, unhit: true } };
    expect(gradeClear(passed({ ...best, flags: [...flags, 'trial-unhit'] }), floor).grade).toBe('SSS');
    expect(gradeClear(passed(best), floor).grade).toBe('SS');
  });
});

describe('leaving through the gate', () => {
  const leave = { type: 'leaveGate' } as const;
  const atGate = (over: Partial<RunState> = {}) => passed({ locationId: 'gate', flags: ['gift-accepted'], ...over });

  it('records the grade and pays clear EXP and coins by its multiplier', () => {
    const after = applyAction(atGate({ coins: 0 }), floor, leave);
    expect(after.clears[1]).toMatchObject({ grade: 'E', exp: 38, coins: 125 }); // 30 x 1.25, 100 x 1.25
    expect(after.coins).toBe(125);
    expect(after.flags).toContain('floor-cleared');
  });

  it('a better clear later pays only the difference, a worse one nothing', () => {
    const first = applyAction(atGate({ coins: 0 }), floor, leave);
    const better = applyAction({ ...first, trial: { turns: 8, unhit: false }, flags: [...first.flags, 'found-school-clue'] }, floor, leave);
    expect(better.clears[1].grade).toBe('C'); // 15 + 25 + 20 = 60
    expect(better.coins).toBe(175); // 100 x 1.75 in all, 125 already paid
    const again = applyAction(better, floor, leave);
    expect(again.coins).toBe(175);
  });

  it('keeps the higher grade even with fewer points', () => {
    expect(isBetter({ grade: 'SSS', total: 96 }, { grade: 'SS', total: 100 })).toBe(true);
    expect(isBetter({ grade: 'SS', total: 100 }, { grade: 'SSS', total: 96 })).toBe(false);
  });

  it('is refused before the trial or away from the gate', () => {
    expect(() => applyAction(run({ locationId: 'gate' }), floor, leave)).toThrow();
    expect(() => applyAction(passed({ locationId: 'square' }), floor, leave)).toThrow();
  });
});
