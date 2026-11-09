import balance from '../../data/balance.json';
import climberData from '../../data/climber.json';
import { climberCombatant, skillScale, type ClimberStats, type Loadout } from './combat';
import { itemById, skillById, type Slot } from './data';

export interface OwnedSkill {
  stage: number;
  level: number;
  proficiency: number; // toward the next skill level
}

export type OwnedSkills = Record<string, OwnedSkill>;

export type Worn = Partial<Record<Slot, string>>;

const wornItems = (worn: Worn) => Object.values(worn).map((id) => itemById(id)!); // save and data checks guarantee they exist
const sumOf = (worn: Worn, stat: 'attack' | 'guard' | 'ward') => wornItems(worn).reduce((sum, item) => sum + (item[stat] ?? 0), 0);

const CORE = ['vitality', 'power', 'agility', 'mind'] as const;

export const expToNext = (level: number): number => balance.expPerLevel * level;

export function statsAt(level: number, worn: Worn): ClimberStats {
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
  return {
    level,
    vitality,
    power,
    agility,
    mind,
    weaponAttack: sumOf(worn, 'attack'),
    armorGuard: sumOf(worn, 'guard'),
    armorWard: sumOf(worn, 'ward'),
  };
}

export const maxHp = (level: number): number => climberCombatant(statsAt(level, {})).maxHp;

export interface HeroParts {
  stats: number;
  skills: number;
  gear: number;
}

export function skillScore(owned: OwnedSkills): number {
  const scores = Object.values(owned)
    .map(({ stage, level }) => balance.skillStageScore[stage] * (balance.skillScoreBase + balance.skillScorePerLevel * (level - 1)))
    .sort((a, b) => b - a)
    .slice(0, balance.countedSkills);
  return Math.round(scores.reduce((a, b) => a + b, 0) * 10) / 10;
}

export function fightLoadout(owned: OwnedSkills, stance: string | null): Loadout {
  const skills = Object.entries(owned).map(([id, { stage, level }]) => ({ ...skillById(id)!, scale: skillScale(stage, level) }));
  return { skills, stance };
}

export function heroParts(level: number, worn: Worn, owned: OwnedSkills): HeroParts {
  const { vitality, power, agility, mind } = statsAt(level, worn);
  const gear = wornItems(worn).reduce(
    (sum, item) => sum + balance.gearGradePoints[item.grade as keyof typeof balance.gearGradePoints],
    0,
  );
  return { stats: vitality + power + agility + mind, skills: skillScore(owned), gear };
}

export function heroPower(parts: HeroParts) {
  const counted = (needed: number) =>
    Object.values(parts).reduce((sum, part) => sum + Math.min(part, needed * balance.heroPartCap), 0);
  const grades = balance.heroGrades;
  const reached = grades.findLastIndex(({ score }) => counted(score) >= score);
  const needed = grades[Math.min(reached + 1, grades.length - 1)].score;
  return { grade: grades[reached].grade, score: counted(needed), needed, cap: needed * balance.heroPartCap };
}

export function compareGear(candidate: string, worn: Worn): { stat: string; delta: number }[] {
  const piece = itemById(candidate)!;
  const current = piece.slot && worn[piece.slot] ? itemById(worn[piece.slot]!) : undefined;
  return (
    [
      ['Attack', 'attack'],
      ['Guard', 'guard'],
      ['Ward', 'ward'],
    ] as const
  )
    .map(([stat, key]) => ({ stat, delta: (piece[key] ?? 0) - (current?.[key] ?? 0) }))
    .filter(({ delta }) => delta !== 0);
}
