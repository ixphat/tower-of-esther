<script lang="ts">
  import { enemies, journal } from './lib/data';
  import type { RunState } from './lib/run';

  const { run }: { run: RunState } = $props();

  const tabs = ['Clues', 'Bestiary'];
  let tab = $state('Clues');
  const found = $derived(journal.filter((entry) => run.flags.includes(entry.flag)));
  const notes = $derived(found.filter((entry) => entry.section === 'notes'));
  const signs = $derived(found.filter((entry) => entry.section === 'order'));
  const met = $derived(enemies.filter((enemy) => run.met.includes(enemy.id)));
</script>

<div class="tabs">
  {#each tabs as name (name)}
    <button aria-pressed={tab === name} onclick={() => (tab = name)}>{name}</button>
  {/each}
</div>

{#if tab === 'Clues'}
  {#if found.length === 0}<p>Nothing noted yet.</p>{/if}
  {#if notes.length}
    <h3>Notes in one hand</h3>
    {#each notes as entry (entry.id)}<p><strong>{entry.title}.</strong> {entry.text}</p>{/each}
  {/if}
  {#if signs.length}
    <h3>Signs</h3>
    {#each signs as entry (entry.id)}<p><strong>{entry.title}.</strong> {entry.text}</p>{/each}
  {/if}
{:else}
  {#if met.length === 0}<p>No enemies met yet.</p>{/if}
  {#each met as enemy (enemy.id)}<p><strong>{enemy.name}.</strong> {enemy.description}</p>{/each}
{/if}
