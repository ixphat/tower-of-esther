export interface Location {
  id: string;
  name: string;
  description: string;
  exits: string[];
}

export interface Floor {
  id: number;
  name: string;
  start: string;
  locations: Location[];
}

const modules = import.meta.glob<Floor>('/data/floors/*.json', { eager: true, import: 'default' });

export const floors: Floor[] = Object.values(modules);

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
  }
  return errors;
}
