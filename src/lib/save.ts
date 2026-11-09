import type { Floor } from './data';

const KEY = 'tower-of-esther.save';
const VERSION = 1;

export interface Save {
  locationId: string;
}

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function writeSave(storage: Writer, save: Save): void {
  storage.setItem(KEY, JSON.stringify({ version: VERSION, ...save }));
}

// Device storage can be edited or stale, so anything unusable counts as no save.
export function readSave(storage: Reader, floor: Floor): Save | null {
  let parsed: { version?: unknown; locationId?: unknown } | null;
  try {
    parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  if (parsed?.version !== VERSION) return null;
  const { locationId } = parsed;
  return floor.locations.some((l) => l.id === locationId) ? { locationId: locationId as string } : null;
}
