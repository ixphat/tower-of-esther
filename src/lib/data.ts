import climberData from '../../data/climber.json';
import enemyData from '../../data/enemies.json';
import itemData from '../../data/items.json';

export const SLOTS = ['weapon', 'head', 'body', 'gloves', 'boots', 'accessory'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Item {
  id: string;
  name: string;
  kind: 'consumable' | 'material' | 'equipment';
  price?: number;
  heal?: number; // share of max HP
  outsideFightOnly?: boolean;
  floor?: number;
  slot?: Slot;
  grade?: string;
  attack?: number;
  guard?: number;
  ward?: number;
}

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  attack: number;
  def: number;
  agility: number;
  exp: number;
  drops: Record<string, number>;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  exits: string[];
  enemies?: string[];
  rest?: boolean;
  shop?: string[];
}

export interface Floor {
  id: number;
  name: string;
  recommendedGrade: string;
  start: string;
  locations: Location[];
}

const modules = import.meta.glob<Floor>('/data/floors/*.json', { eager: true, import: 'default' });

export const floors: Floor[] = Object.values(modules);
export const enemies: Enemy[] = enemyData;
export const items = itemData as Item[];

export const itemById = (id: string): Item | undefined => items.find((item) => item.id === id);

export function validateFloor(floor: Floor): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const { id } of floor.locations) {
    if (ids.has(id)) errors.push(`duplicate location "${id}"`);
    ids.add(id);
  }
  if (!ids.has(floor.start)) errors.push(`start "${floor.start}" does not exist`);
  for (const location of floor.locations) {
    for (const exit of location.exits) {
      if (!ids.has(exit)) errors.push(`${location.id}: exit "${exit}" does not exist`);
    }
    for (const enemy of location.enemies ?? []) {
      if (!enemies.some((e) => e.id === enemy)) errors.push(`${location.id}: enemy "${enemy}" does not exist`);
    }
    for (const item of location.shop ?? []) {
      if (!itemById(item)) errors.push(`${location.id}: shop item "${item}" does not exist`);
      else if (itemById(item)!.price === undefined) errors.push(`${location.id}: shop item "${item}" has no price`);
    }
  }
  return errors;
}

export function validateGameData(): string[] {
  const refs = [
    ...enemies.flatMap((enemy) => Object.keys(enemy.drops).map((id) => [`${enemy.id} drop`, id])),
    ...Object.keys(climberData.startingItems).map((id) => ['starting item', id]),
    ['starting weapon', climberData.startingWeapon],
  ];
  return refs.filter(([, id]) => !itemById(id)).map(([owner, id]) => `${owner}: "${id}" does not exist`);
}
