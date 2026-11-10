import balance from '../../data/balance.json';
import { npcById, quests, type Floor } from './data';
import { meets } from './dialogue';
import { questBoard, secretsScore } from './quests';
import { bondLevel, type RunState } from './run';

export interface ClearGrade {
  path: number;
  content: number;
  secrets: number; // shown only as a score: what is missing stays hidden
  secretsMax: number;
  style: number;
  total: number;
  grade: string;
  missing: { path: string[]; content: string[]; style: string[] };
}

const MAX_BOND_LEVEL = balance.bondLevels.length - 1;

export function gradeClear(run: RunState, floor: Floor): ClearGrade {
  const rules = floor.clear!;
  const missing: ClearGrade['missing'] = { path: [], content: [], style: [] };

  const taken = rules.path.findIndex(({ when }) => meets(when, run));
  const path = taken === -1 ? 0 : rules.path[taken].points;
  if (taken !== 0) missing.path.push('A harder way through this floor');

  const done = questBoard(run).done;
  let content = 0;
  for (const [id, points] of Object.entries(rules.content.quests)) {
    const quest = done.find((q) => q.id === id);
    if (quest) content += points;
    else missing.content.push(`${quests.find((q) => q.id === id)!.title} not finished`);
  }
  const level = bondLevel(run.bonds[rules.content.bond.npc]);
  content += Math.round((rules.content.bond.points * level) / MAX_BOND_LEVEL);
  if (level < MAX_BOND_LEVEL) {
    missing.content.push(`Bond with ${npcById(rules.content.bond.npc)!.name} not yet ${balance.bondLevels[MAX_BOND_LEVEL]}`);
  }

  const turns = run.trial?.turns ?? Infinity;
  const style = turns <= rules.style.full ? rules.style.points : turns <= rules.style.half ? rules.style.points / 2 : 0;
  if (turns > rules.style.full) missing.style.push(`Win the floor master fight in ${rules.style.full} turns or fewer`);

  const secrets = secretsScore(run, floor);
  const total = path + content + secrets + style;
  const { npc, ...sss } = rules.sss;
  const bands = balance.clearGrades.filter((band) => band.grade !== 'SSS');
  const grade =
    total >= balance.clearGrades[balance.clearGrades.length - 1].min && meets(sss, run, npc)
      ? 'SSS'
      : bands.findLast((band) => total >= band.min)!.grade;
  const secretsMax = (floor.secrets ?? []).reduce((sum, s) => sum + s.points, 0);
  return { path, content, secrets, secretsMax, style, total, grade, missing };
}

const gradeRank = (grade: string) => balance.clearGrades.findIndex((band) => band.grade === grade);

// Only the best clear is kept: higher grade first, then more points.
export const isBetter = (a: { grade: string; total: number }, b: { grade: string; total: number }) =>
  gradeRank(a.grade) > gradeRank(b.grade) || (a.grade === b.grade && a.total > b.total);

export const gradeMultiplier = (grade: string) => balance.clearGrades.find((band) => band.grade === grade)!.multiplier;
