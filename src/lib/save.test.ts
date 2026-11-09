import { describe, expect, it } from 'vitest';
import type { Floor } from './data';
import { newRun } from './run';
import { readSave, writeSave } from './save';

const floor: Floor = {
  id: 1,
  name: 'Test',
  recommendedGrade: 'F',
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

  it('round-trips the run', () => {
    const storage = fakeStorage();
    const run = { ...newRun(floor), hp: 40, memoriesLost: 2, bonds: { keeper: 30 }, lastBond: 'keeper' };
    writeSave(storage, run);
    expect(readSave(storage, floor)).toEqual(run);
  });

  const saved = (over: object) => JSON.stringify({ version: 4, run: { ...newRun(floor), ...over } });

  it.each([
    ['corrupt JSON', '{oops'],
    ['JSON null', 'null'],
    ['another version', '{"version":1,"locationId":"a"}'],
    ['a location that no longer exists', saved({ locationId: 'gone' })],
    ['an unknown safe point', saved({ safePoint: 'gone' })],
    ['HP of zero', saved({ hp: 0 })],
    ['HP above the maximum', saved({ hp: 99999 })],
    ['a level below 1', saved({ level: 0 })],
    ['a negative counter', saved({ memoriesLost: -1 })],
    ['bonds that are a list', saved({ bonds: [] })],
    ['a last bond with no points', saved({ lastBond: 'ghost' })],
  ])('ignores %s', (_name, raw) => {
    expect(readSave(fakeStorage(raw), floor)).toBeNull();
  });
});
