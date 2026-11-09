<script lang="ts">
  import { tick } from 'svelte';
  import { floors } from './lib/data';
  import { readSave, writeSave } from './lib/save';

  const floor = floors.find((f) => f.id === 1)!; // the slice has only Floor 1
  const menu = ['Status', 'Bag', 'Skills', 'Quests', 'Journal'];
  const save = readSave(localStorage, floor);

  let locationId = $state<string | null>(null);
  let windowTitle = $state('');
  let heading = $state<HTMLHeadingElement>();
  let dialog = $state<HTMLDialogElement>();

  const location = $derived(floor.locations.find((l) => l.id === locationId));

  function locationById(id: string) {
    return floor.locations.find((l) => l.id === id)!; // the data check guarantees it exists
  }

  async function enter(id: string) {
    locationId = id;
    await tick();
    heading?.focus(); // the pressed button is gone, keep keyboard users in the scene
  }

  function move(id: string) {
    writeSave(localStorage, { locationId: id });
    return enter(id);
  }

  function openWindow(title: string) {
    windowTitle = title;
    dialog?.showModal();
  }
</script>

{#if location}
  <div class="screen">
    <header><h1>Floor {floor.id} · {floor.name}</h1></header>

    <main class="scene">
      <h2 bind:this={heading} tabindex="-1">{location.name}</h2>
      <p>{location.description}</p>
    </main>

    <nav aria-label="Go to" class="row">
      <span aria-hidden="true">Go to</span>
      {#each location.exits.map(locationById) as exit (exit.id)}
        <button onclick={() => move(exit.id)}>{exit.name}</button>
      {/each}
    </nav>

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
      <button onclick={() => enter(save.locationId)}>Continue</button>
    {/if}
    <button onclick={() => enter(floor.start)}>New game</button>
  </main>
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 100dvh;
    max-width: 960px;
    margin: 0 auto;
    padding: 0.75rem;
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
