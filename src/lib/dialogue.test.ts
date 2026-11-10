import { describe, expect, it } from 'vitest';
import type { Floor } from './data';
import { canSkip, nodeAt, sceneFor, skipTarget, visibleChoices } from './dialogue';
import { applyAction, newRun, type RunState } from './run';

const floor: Floor = {
  id: 1,
  name: 'Test',
  recommendedGrade: 'F',
  start: 'house',
  locations: [
    { id: 'house', name: 'House', description: '', exits: ['yard'], npcs: ['keeper'] },
    { id: 'yard', name: 'Yard', description: '', exits: ['house'] },
  ],
};
const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun(floor), ...over });

describe('scenes from data', () => {
  it('opens the first meeting until the flag is set, then the chat', () => {
    expect(sceneFor('keeper', run()).id).toBe('keeper-first');
    expect(sceneFor('keeper', run({ flags: ['met-keeper'] })).id).toBe('keeper-chat');
  });

  it('shows up to 4 choices without revealing which one is liked', () => {
    const choices = visibleChoices(nodeAt('keeper-first', 'c'), run());
    expect(choices.map((c) => c.text)).toEqual(["Who lives here?", "It's a good house.", "There's no one left."]);
    for (const choice of choices) expect(Object.keys(choice).sort()).toEqual(['index', 'text']);
  });
});

describe('bonds (04 Systems)', () => {
  const see = (node: string) => ({ type: 'seeLine', scene: 'keeper-first', node }) as const;

  it('a first conversation gives 10 and reaches Acquaintance, once', () => {
    let state = applyAction(run(), floor, see('g'));
    expect(state).toMatchObject({ bonds: { keeper: 10 }, lastBond: 'keeper', flags: ['met-keeper'] });
    state = applyAction(state, floor, see('g'));
    expect(state.bonds.keeper).toBe(10);
  });

  it('a liked choice gives 5, once, and another choice gives nothing', () => {
    const choose = (choice: number) => ({ type: 'choose', scene: 'keeper-first', node: 'c', choice }) as const;
    let state = applyAction(run(), floor, choose(1));
    expect(state.bonds.keeper).toBe(5);
    state = applyAction(state, floor, choose(1));
    expect(state.bonds.keeper).toBe(5);
    expect(applyAction(run(), floor, choose(0)).bonds.keeper).toBeUndefined();
  });

  it('a liked gift gives 10, any other 5, one per visit', () => {
    const gift = (item: string) => ({ type: 'gift', npc: 'keeper', item }) as const;
    const held = run({ items: { wildflower: 2, 'basic-salve': 1 } });
    let state = applyAction(held, floor, gift('wildflower'));
    expect(state).toMatchObject({ bonds: { keeper: 10 }, items: { wildflower: 1 } });
    expect(() => applyAction(state, floor, gift('basic-salve'))).toThrow('Gift limit reached');
    state = applyAction(applyAction(state, floor, { type: 'move', to: 'yard' }), floor, { type: 'move', to: 'house' });
    expect(applyAction(state, floor, gift('basic-salve')).bonds.keeper).toBe(15);
  });

  it('refuses a gift to someone who is not here, or of worn gear', () => {
    const away = run({ locationId: 'yard', items: { wildflower: 1 } });
    expect(() => applyAction(away, floor, { type: 'gift', npc: 'keeper', item: 'wildflower' })).toThrow();
    const gear = run({ items: { 'plain-coat': 1 } });
    expect(() => applyAction(gear, floor, { type: 'gift', npc: 'keeper', item: 'plain-coat' })).toThrow();
  });

  it('caps bond points at Close', () => {
    const state = applyAction(run({ bonds: { keeper: 98 }, items: { wildflower: 1 } }), floor, {
      type: 'gift',
      npc: 'keeper',
      item: 'wildflower',
    });
    expect(state.bonds.keeper).toBe(100);
  });
});

describe('skip', () => {
  it('works only on lines already seen', () => {
    expect(canSkip('keeper-first', 'a', run())).toBe(false);
    expect(canSkip('keeper-first', 'a', run({ seen: ['keeper-first:a'] }))).toBe(true);
  });

  it('jumps over seen lines to the first unseen line or choice', () => {
    expect(skipTarget('keeper-first', 'a', run({ seen: ['keeper-first:a', 'keeper-first:b'] }))).toBe('c');
    expect(skipTarget('keeper-first', 'd', run({ seen: ['keeper-first:d'] }))).toBe('g');
  });
});
