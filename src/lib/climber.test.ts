import { describe, expect, it } from 'vitest';
import { expToNext, heroPower, maxHp, statsAt } from './climber';

const core = (level: number) => {
  const { vitality, power, agility, mind } = statsAt(level);
  return [vitality, power, agility, mind];
};

describe('growth (04 Systems, placeholder Vanguard start 8/5/3/4)', () => {
  it('EXP to level up costs 100 x level', () => {
    expect(expToNext(1)).toBe(100);
    expect(expToNext(10)).toBe(1000);
  });

  it('starts at the class stats', () => {
    expect(core(1)).toEqual([8, 5, 3, 4]);
  });

  it('shares 3 points a level in proportion to the starting stats', () => {
    // +3 of 20: 1.2, 0.75, 0.45, 0.6
    expect(core(2)).toEqual([9, 6, 3, 5]);
    // +30 of 20: 12, 7.5, 4.5, 6
    expect(core(11)).toEqual([20, 13, 7, 10]);
  });

  it('gains exactly 3 points every level', () => {
    for (let level = 1; level <= 100; level++) {
      expect(core(level).reduce((a, b) => a + b)).toBe(20 + 3 * (level - 1));
    }
  });

  it('raises max HP with level', () => {
    expect(maxHp(1)).toBe(151); // 50 + 96 + 5
    expect(maxHp(2)).toBe(168); // 50 + 108 + 10
  });
});

describe('Hero power cap rule', () => {
  it('measures against the next grade, capping each part at half of it', () => {
    expect(heroPower({ stats: 18, skills: 2, gear: 3 })).toEqual({ grade: 'F', score: 23, needed: 36, cap: 18 });
  });

  it('does not let one part raise the grade', () => {
    expect(heroPower({ stats: 500, skills: 0, gear: 0 })).toMatchObject({ grade: 'F', score: 18 });
  });

  it('reaches a grade when the capped parts cover it', () => {
    expect(heroPower({ stats: 18, skills: 10, gear: 8 })).toMatchObject({ grade: 'E', needed: 60 });
    expect(heroPower({ stats: 75, skills: 15, gear: 15 })).toMatchObject({ grade: 'D', needed: 90 });
  });

  it('stops at the top grade', () => {
    expect(heroPower({ stats: 999, skills: 999, gear: 999 })).toMatchObject({ grade: 'SSS', needed: 650, cap: 325 });
  });
});
