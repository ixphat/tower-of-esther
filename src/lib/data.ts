import enemyData from '../../data/enemies.json';

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  attack: number;
  def: number;
  agility: number;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  exits: string[];
  enemies?: string[];
}

export interface Floor {
  id: number;
  name: string;
  start: string;
  locations: Location[];
}

const modules = import.meta.glob<Floor>('/data/floors/*.json', { eager: true, import: 'default' });

export const floors: Floor[] = Object.values(modules);
export const enemies: Enemy[] = enemyData;

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
  }
  return errors;
}
