import { describe, expect, it } from 'vitest';
import type { Floor } from './data';
import { readSave, writeSave } from './save';

const floor: Floor = {
  id: 1,
  name: 'Test',
  start: 'a',
  locations: [{ id: 'a', name: 'A', description: '', exits: [] }],
};

function fakeStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => void (value = next),
  };
}

describe('save', () => {
  it('has no save on a new device', () => {
    expect(readSave(fakeStorage(), floor)).toBeNull();
  });

  it('round-trips the location', () => {
    const storage = fakeStorage();
    writeSave(storage, { locationId: 'a' });
    expect(readSave(storage, floor)).toEqual({ locationId: 'a' });
  });

  it.each([
    ['corrupt JSON', '{oops'],
    ['JSON null', 'null'],
    ['another version', '{"version":0,"locationId":"a"}'],
    ['a location that no longer exists', '{"version":1,"locationId":"gone"}'],
  ])('ignores %s', (_name, raw) => {
    expect(readSave(fakeStorage(raw), floor)).toBeNull();
  });
});
