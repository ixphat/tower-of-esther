import balance from '../../data/balance.json';
import climberData from '../../data/climber.json';
import enemyData from '../../data/enemies.json';
import itemData from '../../data/items.json';
import npcData from '../../data/npcs.json';
import questData from '../../data/quests.json';
import sceneData from '../../data/scenes.json';
import skillData from '../../data/skills.json';
import type { EnemyMove, FightSkill, ScriptedMove, Tier } from './combat';

export const SLOTS = ['weapon', 'head', 'body', 'gloves', 'boots', 'accessory'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Item {
  id: string;
  name: string;
  kind: 'consumable' | 'material' | 'equipment' | 'gift' | 'key';
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
  tier: Tier;
  moves: EnemyMove[];
  scripted?: ScriptedMove[];
  hp: number;
  attack: number;
  def: number;
  agility: number;
  exp: number;
  monsterPoints: number; // earns skill proficiency
  mind: number;
  drops: Record<string, number>;
}

export type SkillData = Omit<FightSkill, 'scale'> & { type: string; description: string };

export interface Location {
  id: string;
  name: string;
  description: string;
  exits: string[];
  enemies?: string[];
  rest?: boolean;
  shop?: string[];
  npcs?: string[];
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
export const enemies = enemyData as Enemy[];
export const items = itemData as Item[];

export interface Npc {
  id: string;
  name: string;
  likes: string[]; // item ids worth a liked gift
}

export interface Condition {
  flag?: string;
  notFlag?: string;
  bondAtLeast?: number; // bond level with the scene's NPC
}

export interface SceneNode {
  speaker: string;
  text: string;
  next?: string;
  choices?: { text: string; next?: string; liked?: boolean; condition?: Condition }[];
  effects?: { setFlag?: string; firstTalk?: boolean }; // firstTalk raises the scene NPC's bond
}

export interface Scene {
  id: string;
  npc?: string; // none for the Tower's voice and found writing
  condition?: Condition;
  start: string;
  nodes: Record<string, SceneNode>;
}

export const npcs = npcData as Npc[];
export const scenes = sceneData as unknown as Scene[]; // JSON infers each scene's own node keys
export interface Quest {
  id: string;
  kind: 'main' | 'side';
  giver?: string;
  title: string;
  steps: { id: string; text: string }[]; // directions in words, no markers
}

export const quests = questData as Quest[];
export const npcById = (id: string): Npc | undefined => npcs.find((npc) => npc.id === id);
export const sceneById = (id: string): Scene | undefined => scenes.find((scene) => scene.id === id);
export const skills = skillData as SkillData[];
export const skillById = (id: string): SkillData | undefined => skills.find((skill) => skill.id === id);

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
    for (const npc of location.npcs ?? []) {
      if (!npcById(npc)) errors.push(`${location.id}: npc "${npc}" does not exist`);
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
  const missingSkills = climberData.startingSkills
    .filter((id) => !skillById(id))
    .map((id) => `starting skill: "${id}" does not exist`);
  const npcLikes = npcs.flatMap((npc) => npc.likes.map((id) => [`${npc.id} likes`, id]));
  const sceneErrors = scenes.flatMap((scene) => {
    const nodes = Object.entries(scene.nodes);
    const targets = [scene.start, ...nodes.flatMap(([, node]) => [node.next, ...(node.choices ?? []).map((c) => c.next)])];
    return [
      ...(!scene.npc || npcById(scene.npc) ? [] : [`${scene.id}: npc "${scene.npc}" does not exist`]),
      ...targets.filter((id) => id && !scene.nodes[id]).map((id) => `${scene.id}: node "${id}" does not exist`),
      ...nodes
        .filter(([, node]) => (node.choices?.length ?? 0) > balance.maxChoices)
        .map(([id]) => `${scene.id}:${id}: more than ${balance.maxChoices} choices`),
    ];
  });
  return [
    ...[...refs, ...npcLikes].filter(([, id]) => !itemById(id)).map(([owner, id]) => `${owner}: "${id}" does not exist`),
    ...missingSkills,
    ...sceneErrors,
  ];
}

// "Crow ×3, Straw Remnant"
export function groupName(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ');
}
