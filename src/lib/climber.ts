import balance from '../../data/balance.json';
import climberData from '../../data/climber.json';
import { climberCombatant, type ClimberStats } from './combat';

const CORE = ['vitality', 'power', 'agility', 'mind'] as const;

export const expToNext = (level: number): number => balance.expPerLevel * level;

export function statsAt(level: number): ClimberStats {
  const total = CORE.reduce((sum, stat) => sum + climberData[stat], 0);
  const statPoints = (level - 1) * balance.statPointsPerLevel;
  const shares = CORE.map((stat) => (statPoints * climberData[stat]) / total);
  const gains = shares.map(Math.floor);

  // Whole points only: leftovers go to the largest remainders, earlier stats first on ties.
  const leftover = statPoints - gains.reduce((a, b) => a + b, 0);
  shares
    .map((share, index) => ({ index, remainder: share - gains[index] }))
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, leftover)
    .forEach(({ index }) => (gains[index] += 1));

  const [vitality, power, agility, mind] = CORE.map((stat, index) => climberData[stat] + gains[index]);
  return { level, vitality, power, agility, mind, weaponAttack: climberData.weaponAttack };
}

export const maxHp = (level: number): number => climberCombatant(statsAt(level)).maxHp;

export interface HeroParts {
  stats: number;
  skills: number;
  gear: number;
}

export function heroParts(level: number): HeroParts {
  const { vitality, power, agility, mind } = statsAt(level);
  const gear = balance.gearGradePoints[climberData.weaponGrade as keyof typeof balance.gearGradePoints];
  return { stats: vitality + power + agility + mind, skills: 0, gear }; // skills arrive with the Skills ticket
}

export function heroPower(parts: HeroParts) {
  const counted = (needed: number) =>
    Object.values(parts).reduce((sum, part) => sum + Math.min(part, needed * balance.heroPartCap), 0);
  const grades = balance.heroGrades;
  const reached = grades.findLastIndex(({ score }) => counted(score) >= score);
  const needed = grades[Math.min(reached + 1, grades.length - 1)].score;
  return { grade: grades[reached].grade, score: counted(needed), needed, cap: needed * balance.heroPartCap };
}
