import { describe, expect, it } from 'vitest';
import { floors, validateFloor, type Floor } from './data';

const floor = (over: Partial<Floor> = {}): Floor => ({
  id: 1,
  name: 'Test',
  start: 'a',
  locations: [
    { id: 'a', name: 'A', description: '', exits: ['b'] },
    { id: 'b', name: 'B', description: '', exits: ['a'] },
  ],
  ...over,
});

describe('floor data', () => {
  it('loads at least one floor and every shipped reference resolves', () => {
    expect(floors.length).toBeGreaterThan(0);
    for (const f of floors) expect(validateFloor(f)).toEqual([]);
  });

  it('reports an exit to a missing location', () => {
    const broken = floor();
    broken.locations[1].exits = ['nowhere'];
    expect(validateFloor(broken)).toEqual(['b: exit "nowhere" does not exist']);
  });

  it('reports a missing start location', () => {
    expect(validateFloor(floor({ start: 'nowhere' }))).toEqual(['start "nowhere" does not exist']);
  });

  it('reports duplicate location ids', () => {
    const dup = floor();
    dup.locations[1].id = 'a';
    expect(validateFloor(dup)).toContain('duplicate location "a"');
  });
});
