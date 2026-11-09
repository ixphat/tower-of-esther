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
    const run = { ...newRun(floor), hp: 40, coins: 7, cleared: ['a'], memoriesLost: 2, bonds: { keeper: 30 }, lastBond: 'keeper' };
    writeSave(storage, run);
    expect(readSave(storage, floor)).toEqual(run);
  });

  const saved = (over: object) => JSON.stringify({ version: 6, run: { ...newRun(floor), ...over } });

  it.each([
    ['corrupt JSON', '{oops'],
    ['JSON null', 'null'],
    ['another version', '{"version":1,"locationId":"a"}'],
    ['a location that no longer exists', saved({ locationId: 'gone' })],
    ['an unknown safe point', saved({ safePoint: 'gone' })],
    ['HP of zero', saved({ hp: 0 })],
    ['HP above the maximum', saved({ hp: 99999 })],
    ['negative coins', saved({ coins: -1 })],
    ['an unknown item', saved({ items: { ghost: 1 } })],
    ['a piece worn in the wrong slot', saved({ worn: { head: 'plain-coat' } })],
    ['an unknown cleared location', saved({ cleared: ['gone'] })],
    ['an unknown skill', saved({ skills: { ghost: { stage: 0, level: 1, proficiency: 0 } } })],
    ['a skill level above 10', saved({ skills: { whistle: { stage: 0, level: 11, proficiency: 0 } } })],
    ['too few pin slots', saved({ pins: [null] })],
    ['a pin of an unowned skill', saved({ pins: ['ghost', null, null, null, null, null] })],
    ['a Stance that is not one', saved({ stance: 'whistle' })],
    ['a level below 1', saved({ level: 0 })],
    ['a negative counter', saved({ memoriesLost: -1 })],
    ['bonds that are a list', saved({ bonds: [] })],
    ['a last bond with no points', saved({ lastBond: 'ghost' })],
  ])('ignores %s', (_name, raw) => {
    expect(readSave(fakeStorage(raw), floor)).toBeNull();
  });
});
