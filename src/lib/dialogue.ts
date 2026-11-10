import type { Condition, Scene, SceneNode } from './data';
import { sceneById, scenes } from './data';
import type { RunState } from './run';

export const lineId = (scene: string, node: string) => `${scene}:${node}`;

export function meets(condition: Condition | undefined, run: RunState): boolean {
  if (!condition) return true;
  if (condition.flag && !run.flags.includes(condition.flag)) return false;
  if (condition.notFlag && run.flags.includes(condition.notFlag)) return false;
  return true;
}

// The first scene of the NPC whose condition holds.
export function sceneFor(npc: string, run: RunState): Scene {
  const scene = scenes.find((s) => s.npc === npc && meets(s.condition, run));
  if (!scene) throw new Error(`No scene for ${npc}`);
  return scene;
}

export function nodeAt(scene: string, node: string): SceneNode {
  const found = sceneById(scene)?.nodes[node];
  if (!found) throw new Error(`No node ${scene}:${node}`);
  return found;
}

// Liked choices are deliberately left out: the player learns from the reaction.
export function visibleChoices(node: SceneNode, run: RunState): { text: string; index: number }[] {
  return (node.choices ?? [])
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => meets(choice.condition, run))
    .map(({ choice, index }) => ({ text: choice.text, index }));
}

export const canSkip = (scene: string, node: string, run: RunState) => run.seen.includes(lineId(scene, node));

// Follows seen lines until an unseen line, a choice or the scene's end.
export function skipTarget(scene: string, node: string, run: RunState): string {
  let current = node;
  while (canSkip(scene, current, run)) {
    const { next, choices } = nodeAt(scene, current);
    if (choices || !next) return current;
    current = next;
  }
  return current;
}
