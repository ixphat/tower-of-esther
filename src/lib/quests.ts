import { npcById, quests, type Quest } from './data';
import { meets } from './dialogue';
import type { RunState } from './run';

export interface QuestEntry {
  id: string;
  title: string;
  giver?: string;
  step: string; // the current direction, or the last one once done
}

// The last step closes the quest, even when an earlier one no longer holds (turned-in items).
const isDone = (quest: Quest, run: RunState) => meets(quest.steps[quest.steps.length - 1].doneWhen, run);

function entry(quest: Quest, run: RunState): QuestEntry {
  const last = quest.steps[quest.steps.length - 1];
  const current = isDone(quest, run) ? last : quest.steps.find((step) => !meets(step.doneWhen, run))!;
  return { id: quest.id, title: quest.title, giver: quest.giver && npcById(quest.giver)?.name, step: current.text };
}


// Secrets only appear once found, so nothing hints that they exist.
export function questBoard(run: RunState) {
  const started = quests.filter((quest) => meets(quest.startWhen, run));
  const open = started.filter((quest) => !isDone(quest, run));
  const main = open.find((quest) => quest.kind === 'main');
  return {
    main: main && entry(main, run),
    side: open.filter((quest) => quest.kind === 'side').map((quest) => entry(quest, run)),
    secrets: started.filter((quest) => quest.kind === 'secret').map((quest) => entry(quest, run)),
    done: started.filter((quest) => quest.kind !== 'secret' && isDone(quest, run)).map((quest) => entry(quest, run)),
  };
}
