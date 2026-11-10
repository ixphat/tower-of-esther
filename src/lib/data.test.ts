import { describe, expect, it } from 'vitest';
import { floors, validateFloor, validateGameData, type Floor } from './data';

const floor = (over: Partial<Floor> = {}): Floor => ({
  id: 1,
  name: 'Test',
  recommendedGrade: 'F',
  recommendedLevel: 1,
  rule: { label: 'None', text: '' },
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

  it('reports an enemy that does not exist', () => {
    const broken = floor();
    broken.locations[0].enemies = ['ghost'];
    expect(validateFloor(broken)).toEqual(['a: enemy "ghost" does not exist']);
  });

  it('reports a stall item that does not exist', () => {
    const broken = floor();
    broken.locations[0].shop = ['ghost'];
    expect(validateFloor(broken)).toEqual(['a: shop item "ghost" does not exist']);
  });

  it('reports a stall item with no price', () => {
    const broken = floor();
    broken.locations[0].shop = ['straw-thread'];
    expect(validateFloor(broken)).toEqual(['a: shop item "straw-thread" has no price']);
  });

  it('reports an NPC that does not exist', () => {
    const broken = floor();
    broken.locations[0].npcs = ['ghost'];
    expect(validateFloor(broken)).toEqual(['a: npc "ghost" does not exist']);
  });

  it('resolves every enemy drop, starting item and worn piece', () => {
    expect(validateGameData()).toEqual([]);
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
