<script lang="ts">
  import { tick } from 'svelte';
  import Fight from './Fight.svelte';
  import { enemies, floors, type Enemy } from './lib/data';
  import { applyAction, maxHp, newRun, type RunAction, type RunState } from './lib/run';
  import { readSave, writeSave } from './lib/save';

  const floor = floors.find((f) => f.id === 1)!; // the slice has only Floor 1
  const menu = ['Status', 'Bag', 'Skills', 'Quests', 'Journal'];
  const save = readSave(localStorage, floor);

  let run = $state.raw<RunState | null>(null);
  let windowTitle = $state('');
  let foes = $state<Enemy[] | null>(null);
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

  function commit(action: RunAction) {
    run = applyAction(run!, floor, action);
    writeSave(localStorage, run);
  }

  function move(to: string) {
    commit({ type: 'move', to });
    return focusScene();
  }

  function foesAt(ids: string[]) {
    return ids.map((id) => enemies.find((e) => e.id === id)!); // the data check guarantees it exists
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
  <Fight {floor} {foes} hp={run!.hp} onFinish={(outcome, hp) => commit({ type: 'fightEnd', outcome, hp })} onReturn={endFight} />
{:else if location && run}
  <div class="screen">
    <header><h1>Floor {floor.id} · {floor.name}</h1></header>

    <section class="vitals" role="status" aria-label="Climber">
      <span>HP {run.hp} / {maxHp()}</span>
      <progress max={maxHp()} value={run.hp} aria-hidden="true"></progress>
    </section>

    <main class="scene">
      <h2 bind:this={heading} tabindex="-1">{location.name}</h2>
      <p>{location.description}</p>
      {#if location.enemies}
        {@const here = foesAt(location.enemies)}
        <button onclick={() => (foes = here)}>Fight {here.map((e) => e.name).join(', ')}</button>
      {/if}
    </main>

    <nav aria-label="Go to" class="row">
      <span aria-hidden="true">Go to</span>
      {#each location.exits.map(locationById) as exit (exit.id)}
        <button onclick={() => move(exit.id)} aria-label={exit.enemies ? `${exit.name}, monsters here` : undefined}>
          {exit.name}{#if exit.enemies}&nbsp;⚔&#xFE0E;{/if}
        </button>
      {/each}
    </nav>

    {#if location.rest}
      <div class="row"><button onclick={() => commit({ type: 'rest' })}>Rest</button></div>
    {/if}

    <nav aria-label="Menu" class="row menu">
      {#each menu as item (item)}
        <button onclick={() => openWindow(item)}>{item}</button>
      {/each}
    </nav>
  </div>

  <dialog bind:this={dialog} aria-labelledby="window-title">
    <h2 id="window-title">{windowTitle}</h2>
    <p>Nothing here yet.</p>
    <form method="dialog"><button>Close</button></form>
  </dialog>
{:else}
  <main class="title">
    <h1>Tower of Esther</h1>
    {#if save}
      <button onclick={() => begin(save)}>Continue</button>
    {/if}
    <button onclick={() => begin(newRun(floor))}>New game</button>
  </main>
{/if}

<style>
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
