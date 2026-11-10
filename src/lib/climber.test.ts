import { describe, expect, it } from 'vitest';
import { compareGear, expToNext, fightLoadout, heroParts, heroPower, maxHp, skillScore, statsAt } from './climber';

const core = (level: number) => {
  const { vitality, power, agility, mind } = statsAt(level, {}, 'vanguard');
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
    expect(maxHp(1, 'vanguard')).toBe(151); // 50 + 96 + 5
    expect(maxHp(2, 'vanguard')).toBe(168); // 50 + 108 + 10
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

describe('worn gear', () => {
  it('feeds weapon attack, armor and gear points', () => {
    const worn = { weapon: 'worn-sword', body: 'plain-coat', head: 'plain-cap' };
    expect(statsAt(1, worn, 'vanguard')).toMatchObject({ weaponAttack: 8, armorGuard: 4, armorWard: 4 });
    expect(heroParts(1, worn, {}, 'vanguard').gear).toBe(3);
  });

  it('compares a piece with what is worn in that slot', () => {
    expect(compareGear('plain-coat', {})).toEqual([
      { stat: 'Guard', delta: 2 },
      { stat: 'Ward', delta: 2 },
    ]);
    expect(compareGear('plain-coat', { body: 'plain-coat' })).toEqual([]);
  });

  it('shows a minus when the worn piece is better', () => {
    expect(compareGear('plain-cap', { head: 'worn-sword' })).toEqual([
      { stat: 'Attack', delta: -8 },
      { stat: 'Guard', delta: 2 },
      { stat: 'Ward', delta: 2 },
    ]);
  });
});

describe('owned skills', () => {
  const owned = (stage: number, level: number) => ({ stage, level, proficiency: 0 });

  it('scores Novice Lv 1 at 55% of 2 points', () => {
    expect(skillScore({ whistle: owned(0, 1), 'sweep-up': owned(0, 1) })).toBeCloseTo(2.2);
  });

  it('scores a full level at the whole stage value', () => {
    expect(skillScore({ whistle: owned(1, 10) })).toBeCloseTo(5);
  });

  it('builds fight skills scaled by level and stage', () => {
    const { skills, stance } = fightLoadout({ 'straw-toss': owned(0, 10) }, null);
    expect(skills[0]).toMatchObject({ id: 'straw-toss', cooldown: 2, damage: 0.7 });
    expect(skills[0].scale).toBeCloseTo(1.09);
    expect(stance).toBeNull();
  });
});
