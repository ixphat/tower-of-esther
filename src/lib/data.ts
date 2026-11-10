import balance from '../../data/balance.json';
import classData from '../../data/classes.json';
import climberData from '../../data/climber.json';
import enemyData from '../../data/enemies.json';
import itemData from '../../data/items.json';
import npcData from '../../data/npcs.json';
import journalData from '../../data/journal.json';
import questData from '../../data/quests.json';
import sceneData from '../../data/scenes.json';
import skillData from '../../data/skills.json';
import type { EnemyMove, FightSkill, ScriptedMove, Tier } from './combat';

export interface ClassData {
  id: string;
  name: string;
  hidden?: boolean; // not offered as the gift
  vitality: number;
  power: number;
  agility: number;
  mind: number;
  weapon: string; // class-style F weapon given with the class
}

export const classes = classData as ClassData[];
export const classById = (id: string): ClassData | undefined => classes.find((c) => c.id === id);

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
  yieldBelow?: number;
  spare?: boolean;
  hp: number;
  attack: number;
  def: number;
  agility: number;
  description: string;
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
  enterFlag?: string; // noticed on arrival
  winFlag?: string; // set when this place's fight is won
  condition?: Condition; // hidden until it holds, like a secret path
  shop?: string[];
  npcs?: string[];
}

export interface Floor {
  id: number;
  name: string;
  recommendedGrade: string;
  recommendedLevel: number;
  rule: { label: string; text: string }; // shown as the rule chip
  secrets?: { flag: string; points: number }[]; // Secrets factor of the clear grade
  exit?: string; // where the climber leaves the floor
  clear?: ClearRules;
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

export interface ClearRules {
  requires: string; // flag needed to leave, such as passing the floor master
  path: { when: Condition; points: number }[]; // first match wins, best path first
  content: { quests: Record<string, number>; bond: { npc: string; points: number } };
  style: { points: number; full: number; half: number }; // floor master fight turns
  sss: Condition & { npc: string };
  exp: number; // floor clear EXP at grade F
  coinsPerFloor: number; // floor clear coins at grade F = this x floor number
  endText: string;
}

export interface ItemCount {
  id: string;
  count: number;
}

export interface Condition {
  flag?: string;
  notFlag?: string;
  anyFlag?: string[];
  allFlags?: string[];
  hasItems?: ItemCount[];
  bondAtLeast?: number; // bond level with the scene's NPC
}

export interface SceneNode {
  speaker: string;
  text: string;
  next?: string;
  choices?: { text: string; next?: string; liked?: boolean; condition?: Condition }[];
  effects?: {
    setFlag?: string;
    firstTalk?: boolean; // raises the scene NPC's bond by the first-talk amount
    bond?: number; // quest reward to the scene NPC
    exp?: number;
    coins?: number;
    take?: ItemCount[];
    give?: ItemCount[];
    learn?: string[];
    acceptGift?: boolean;
    setClass?: string;
    refuseGift?: boolean;
  };
}

export interface Scene {
  id: string;
  npc?: string; // none for the Tower's voice and found writing
  location?: string; // offered by Look around there
  followedBy?: string; // scene that opens when this one is left
  prompt?: string; // button text for a place scene, instead of Look around
  auto?: boolean; // a place scene that plays on arrival
  fight?: { enemies: string[]; winFlag: string; trial: boolean; after: string }; // starts when the scene is left
  condition?: Condition;
  start: string;
  nodes: Record<string, SceneNode>;
}

export const npcs = npcData as Npc[];
export const scenes = sceneData as unknown as Scene[]; // JSON infers each scene's own node keys
export interface Quest {
  id: string;
  kind: 'main' | 'side' | 'secret';
  giver?: string;
  title: string;
  startWhen: Condition;
  steps: { text: string; doneWhen: Condition }[]; // directions in words, no markers
}

export interface JournalEntry {
  id: string;
  section: 'notes' | 'order';
  flag: string;
  title: string;
  text: string;
}

export const journal = journalData as JournalEntry[];

export const quests = questData as unknown as Quest[];
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
    ...classes.map((c) => [`${c.id} weapon`, c.weapon]),
  ];
  const missingSkills = scenes
    .flatMap((scene) => Object.values(scene.nodes).flatMap((node) => node.effects?.learn ?? []))
    .filter((id) => !skillById(id))
    .map((id) => `learned skill: "${id}" does not exist`);
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
