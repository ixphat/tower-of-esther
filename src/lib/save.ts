import climberData from '../../data/climber.json';
import { classById, itemById, skillById, SLOTS, type Floor, type Slot } from './data';
import balance from '../../data/balance.json';
import { maxHp } from './climber';
import type { RunState } from './run';

const KEY = 'tower-of-esther.save';
const VERSION = 10;

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function writeSave(storage: Writer, run: RunState): void {
  storage.setItem(KEY, JSON.stringify({ version: VERSION, run }));
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isPlainObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isOwnedSkill(value: unknown): boolean {
  const skill = value as { stage?: unknown; level?: unknown; proficiency?: unknown } | null;
  return (
    isCount(skill?.stage) &&
    skill.stage < balance.skillStages.length &&
    isCount(skill.level) &&
    skill.level >= 1 &&
    skill.level <= balance.skillMaxLevel &&
    isCount(skill.proficiency)
  );
}

function isRun(value: unknown, floor: Floor): value is RunState {
  const run = value as Partial<RunState> | null | undefined;
  const isPlace = (id: unknown) => floor.locations.some((l) => l.id === id);
  return (
    typeof run?.name === 'string' &&
    run.name.trim().length > 0 &&
    run.name.length <= climberData.nameMaxLength &&
    isCount(run.portrait) &&
    run.portrait >= 1 &&
    run.portrait <= climberData.portraits &&
    typeof run.classId === 'string' &&
    classById(run.classId) !== undefined &&
    typeof run.giftClass === 'string' &&
    [false, undefined].includes(classById(run.giftClass)?.hidden) &&
    classById(run.giftClass) !== undefined &&
    isPlace(run.locationId) &&
    isPlace(run.safePoint) &&
    isCount(run.level) &&
    run.level >= 1 &&
    isCount(run.hp) &&
    run.hp > 0 &&
    run.hp <= maxHp(run.level, run.classId!) &&
    isCount(run.exp) &&
    isCount(run.memoriesLost) &&
    typeof run.inFight === 'boolean' &&
    isCount(run.coins) &&
    isPlainObject(run.items) &&
    Object.entries(run.items).every(([id, count]) => itemById(id) && isCount(count)) &&
    isPlainObject(run.worn) &&
    Object.entries(run.worn).every(([slot, id]) => SLOTS.includes(slot as Slot) && itemById(id as string)?.slot === slot) &&
    Array.isArray(run.cleared) &&
    run.cleared.every(isPlace) &&
    isStringList(run.flags) &&
    isStringList(run.seen) &&
    isStringList(run.giftedThisVisit) &&
    isStringList(run.tracked) &&
    isStringList(run.met) &&
    (run.trial === null || (isPlainObject(run.trial) && isCount(run.trial.turns) && typeof run.trial.unhit === 'boolean')) &&
    isPlainObject(run.clears) &&
    isPlainObject(run.skills) &&
    Object.entries(run.skills).every(([id, skill]) => skillById(id) && isOwnedSkill(skill)) &&
    Array.isArray(run.pins) &&
    run.pins.length === balance.pinnedSlots &&
    run.pins.every((pin) => pin === null || (typeof pin === 'string' && pin in run.skills!)) &&
    (run.stance === null || (typeof run.stance === 'string' && run.stance in run.skills && skillById(run.stance)?.tag === 'Stance')) &&
    isPlainObject(run.bonds) &&
    Object.values(run.bonds).every(isCount) &&
    (run.lastBond === null || (typeof run.lastBond === 'string' && isCount(run.bonds[run.lastBond])))
  );
}

// Device storage can be edited or stale, so anything unusable counts as no save.
export function readSave(storage: Reader, floor: Floor): RunState | null {
  let parsed: { version?: unknown; run?: unknown } | null;
  try {
    parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  return parsed?.version === VERSION && isRun(parsed.run, floor) ? parsed.run : null;
}
