import type { Floor } from './data';
import { maxHp, type RunState } from './run';

const KEY = 'tower-of-esther.save';
const VERSION = 3;

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function writeSave(storage: Writer, run: RunState): void {
  storage.setItem(KEY, JSON.stringify({ version: VERSION, run }));
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function isRun(value: unknown, floor: Floor): value is RunState {
  const run = value as Partial<RunState> | null | undefined;
  const isPlace = (id: unknown) => floor.locations.some((l) => l.id === id);
  return (
    isPlace(run?.locationId) &&
    isPlace(run?.safePoint) &&
    isCount(run?.hp) &&
    run.hp > 0 &&
    run.hp <= maxHp() &&
    isCount(run.exp) &&
    isCount(run.memoriesLost) &&
    typeof run.inFight === 'boolean' &&
    typeof run.bonds === 'object' &&
    run.bonds !== null &&
    !Array.isArray(run.bonds) &&
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
