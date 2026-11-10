<script lang="ts">
  import { tick } from 'svelte';
  import Fight from './Fight.svelte';
  import { enemies, floors, groupName, npcById, type Enemy } from './lib/data';
  import BagWindow from './BagWindow.svelte';
  import StallWindow from './StallWindow.svelte';
  import BondPips from './BondPips.svelte';
  import DialogueBox from './DialogueBox.svelte';
  import JournalWindow from './JournalWindow.svelte';
  import QuestsWindow from './QuestsWindow.svelte';
  import SkillsWindow from './SkillsWindow.svelte';
  import { questBoard } from './lib/quests';
  import { sceneAt, sceneFor } from './lib/dialogue';
  import { loadSettings, saveSettings, TEXT_SPEEDS, type Settings } from './lib/settings';
  import StatusWindow from './StatusWindow.svelte';
  import { expToNext, maxHp } from './lib/climber';
  import { applyAction, newRun, resumeRun, type Rewards, type RunAction, type RunState } from './lib/run';
  import { readSave, writeSave } from './lib/save';

  const floor = floors.find((f) => f.id === 1)!; // the slice has only Floor 1
  const menu = ['Status', 'Bag', 'Skills', 'Quests', 'Journal'];
  const save = readSave(localStorage, floor);

  let run = $state.raw<RunState | null>(null);
  let windowTitle = $state('');
  let foes = $state<Enemy[] | null>(null);
  let talk = $state<{ npc?: string; scene: string } | null>(null);
  let settings = $state<Settings>(loadSettings(localStorage));
  let heading = $state<HTMLHeadingElement>();
  let dialog = $state<HTMLDialogElement>();

  const location = $derived(floor.locations.find((l) => l.id === run?.locationId));

  function locationById(id: string) {
    return floor.locations.find((l) => l.id === id)!; // the data check guarantees it exists
  }

  async function focusScene() {
    await tick();
    heading?.focus(); // the pressed button is gone, keep keyboard users in the scene
  }

  function begin(state: RunState) {
    run = state;
    return focusScene();
  }

  function commit(action: RunAction): RunState {
    run = applyAction(run!, floor, action);
    writeSave(localStorage, run);
    return run;
  }

  function startTalk(npc: string) {
    talk = { npc, scene: sceneFor(npc, run!).id };
  }

  const lookScene = $derived(run && location ? sceneAt(location.id, run) : undefined);
  const board = $derived(run ? questBoard(run) : null);
  const trackedQuests = $derived(board ? board.side.filter((quest) => run!.tracked.includes(quest.id)) : []);

  function endTalk() {
    talk = null;
    return focusScene();
  }

  function setTextSpeed(textSpeed: Settings['textSpeed']) {
    settings = { textSpeed };
    saveSettings(localStorage, settings);
  }

  function continueRun(titleScreenSave: RunState) {
    // another tab may have written since the title screen loaded
    run = resumeRun(readSave(localStorage, floor) ?? titleScreenSave, floor);
    writeSave(localStorage, run);
    return focusScene();
  }

  function startFight(here: Enemy[]) {
    commit({ type: 'fightStart', foes: here.map((foe) => foe.id) });
    foes = here;
  }

  function move(to: string) {
    commit({ type: 'move', to });
    return focusScene();
  }

  function foesAt(ids: string[]) {
    return ids.map((id) => enemies.find((e) => e.id === id)!); // the data check guarantees it exists
  }

  function finishFight(outcome: 'won' | 'lost' | 'fled', hp: number, rewards: Rewards, used: string[]) {
    if (outcome === 'won') commit({ type: 'fightEnd', outcome, hp, rewards, used });
    else if (outcome === 'fled') commit({ type: 'fightEnd', outcome, hp });
    else commit({ type: 'fightEnd', outcome });
  }

  function endFight() {
    foes = null;
    return focusScene();
  }

  function openWindow(title: string) {
    windowTitle = title;
    dialog?.showModal();
  }
</script>

{#if foes}
  <Fight {floor} {foes} hp={run!.hp} level={run!.level} worn={run!.worn} items={run!.items} skills={run!.skills} pins={run!.pins} stance={run!.stance} onSpendItem={(item) => commit({ type: 'spendItem', item })} onFinish={finishFight} onReturn={endFight} />
{:else if location && run}
  <div class="screen">
    <header class="row top">
      <h1>Floor {floor.id} · {floor.name}</h1>
      <button onclick={() => openWindow('Settings')}>Settings</button>
    </header>

    <section class="vitals" role="status" aria-label="Climber">
      <span>Lv {run.level}</span>
      <span>Coins {run.coins}</span>
      <span>HP {run.hp} / {maxHp(run.level)}</span>
      <progress max={maxHp(run.level)} value={run.hp} aria-hidden="true"></progress>
      <span>EXP {run.exp} / {expToNext(run.level)}</span>
      <progress max={expToNext(run.level)} value={run.exp} aria-hidden="true"></progress>
    </section>

    <section class="tracker" aria-label="Tracked quests">
      {#if board?.main}<button class="quiet" onclick={() => openWindow('Quests')}>Main: {board.main.step}</button>{/if}
      {#each trackedQuests as quest (quest.id)}
        <button class="quiet" onclick={() => openWindow('Quests')}>{quest.title}: {quest.step}</button>
      {/each}
    </section>

    <main class="scene">
      <h2 bind:this={heading} tabindex="-1">{location.name}</h2>
      <p>{location.description}</p>
      {#if location.enemies && !run.cleared.includes(location.id)}
        {@const here = foesAt(location.enemies)}
        <button onclick={() => startFight(here)}>Fight {groupName(here.map((e) => e.name))}</button>
      {/if}
    </main>

    {#if talk}
      <DialogueBox {run} npc={talk.npc} scene={talk.scene} textSpeed={settings.textSpeed} onAction={commit} onLeave={endTalk} />
    {:else}
    <nav aria-label="Go to" class="row">
      <span aria-hidden="true">Go to</span>
      {#each location.exits.map(locationById) as exit (exit.id)}
        <button onclick={() => move(exit.id)} aria-label={exit.enemies ? `${exit.name}, monsters here` : undefined}>
          {exit.name}{#if exit.enemies}&nbsp;⚔&#xFE0E;{/if}
        </button>
      {/each}
    </nav>

    {#if location.npcs}
      <nav aria-label="Talk to" class="row">
        <span aria-hidden="true">Talk to</span>
        {#each location.npcs as id (id)}
          <button onclick={() => startTalk(id)}>{npcById(id)!.name} <BondPips points={run.bonds[id]} /></button>
        {/each}
      </nav>
    {/if}

    {#if lookScene}
      <div class="row"><button onclick={() => (talk = { scene: lookScene.id })}>Look around</button></div>
    {/if}

    {#if location.rest || location.shop}
      <div class="row">
        {#if location.rest}<button onclick={() => commit({ type: 'rest' })}>Rest</button>{/if}
        {#if location.shop}<button onclick={() => openWindow('Stall')}>Stall</button>{/if}
      </div>
    {/if}

    {/if}

    <nav aria-label="Menu" class="row menu">
      {#each menu as item (item)}
        <button onclick={() => openWindow(item)}>{item}</button>
      {/each}
    </nav>
  </div>

  <dialog bind:this={dialog} aria-labelledby="window-title">
    <h2 id="window-title">{windowTitle}</h2>
    {#if windowTitle === 'Status'}
      <StatusWindow {run} {floor} />
    {:else if windowTitle === 'Settings'}
      <fieldset>
        <legend>Text speed</legend>
        {#each TEXT_SPEEDS as speed (speed)}
          <label>
            <input type="radio" name="text-speed" checked={settings.textSpeed === speed} onchange={() => setTextSpeed(speed)} />
            {speed}
          </label>
        {/each}
      </fieldset>
    {:else if windowTitle === 'Quests'}
      <QuestsWindow {run} onAction={commit} />
    {:else if windowTitle === 'Journal'}
      <JournalWindow {run} />
    {:else if windowTitle === 'Skills'}
      <SkillsWindow {run} onAction={commit} />
    {:else if windowTitle === 'Bag'}
      <BagWindow {run} onAction={commit} />
    {:else if windowTitle === 'Stall'}
      <StallWindow {run} {location} onAction={commit} />
    {:else}
      <p>Nothing here yet.</p>
    {/if}
    <form method="dialog"><button>Close</button></form>
  </dialog>
{:else}
  <main class="title">
    <h1>Tower of Esther</h1>
    {#if save}
      <button onclick={() => continueRun(save)}>Continue</button>
    {/if}
    <button onclick={() => begin(newRun(floor))}>New game</button>
  </main>
{/if}

<style>
  .tracker {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .quiet {
    min-height: 2rem;
    border-color: transparent;
    background: none;
    font-size: 0.9rem;
    text-align: left;
  }

  .top {
    justify-content: space-between;
  }

  fieldset {
    border: 1px solid var(--gold);
  }

  .vitals {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    white-space: nowrap;
  }

  header h1 {
    font-size: 1.1rem;
  }

  .scene {
    flex: 1;
    min-height: 16rem;
    padding: 1.5rem;
    background: var(--navy); /* placeholder until location art exists */
    border: 1px solid var(--gold);
  }

  .scene h2:focus {
    outline: none; /* focused from code on arrival, not an interactive control */
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .menu {
    border-top: 1px solid var(--gold);
    padding-top: 0.75rem;
  }

  dialog {
    width: min(32rem, calc(100vw - 2rem));
    background: var(--navy);
    border: 1px solid var(--gold);
    color: var(--text);
  }

  dialog::backdrop {
    background: color-mix(in srgb, var(--ink) 70%, transparent);
  }

  .title {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 100dvh;
  }
</style>
