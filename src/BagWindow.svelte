<script lang="ts">
  import { compareGear, maxHp } from './lib/climber';
  import { itemById, SLOTS, type Item } from './lib/data';
  import type { RunAction, RunState } from './lib/run';

  const { run, onAction }: { run: RunState; onAction: (action: RunAction) => void } = $props();

  const tabs = ['Equipment', 'Items', 'Materials'];
  let tab = $state('Equipment');

  const held = $derived(
    Object.entries(run.items)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ item: itemById(id)!, count })),
  );
  const ofKind = (kind: Item['kind']) => held.filter(({ item }) => item.kind === kind);

  function compareText(id: string): string {
    const lines = compareGear(id, run.worn).map(({ stat, delta }) => `${delta > 0 ? '+' : ''}${delta} ${stat}`);
    return lines.length ? lines.join(', ') : 'No change';
  }
</script>

<div class="tabs">
  {#each tabs as name (name)}
    <button aria-pressed={tab === name} onclick={() => (tab = name)}>{name}</button>
  {/each}
</div>

{#if tab === 'Equipment'}
  <h3>Worn</h3>
  <ul>
    {#each SLOTS as slot (slot)}
      <li>{slot}: {run.worn[slot] ? itemById(run.worn[slot])!.name : '-'}</li>
    {/each}
  </ul>
  <h3>Carried</h3>
  {#if ofKind('equipment').length === 0}<p>Nothing carried.</p>{/if}
  <ul>
    {#each ofKind('equipment') as { item, count } (item.id)}
      <li>
        {item.name} ×{count} · {item.grade} · {compareText(item.id)}
        <button aria-label="Equip {item.name}" onclick={() => onAction({ type: 'equip', item: item.id })}>Equip</button>
      </li>
    {/each}
  </ul>
{:else if tab === 'Items'}
  {#if ofKind('consumable').length === 0}<p>No items.</p>{/if}
  <ul>
    {#each ofKind('consumable') as { item, count } (item.id)}
      <li>
        {item.name} ×{count} · heals {item.heal! * 100}% of max HP
        <button
          aria-label="Use {item.name}"
          disabled={run.hp >= maxHp(run.level, run.classId)}
          onclick={() => onAction({ type: 'useItem', item: item.id })}>Use</button
        >
      </li>
    {/each}
  </ul>
{:else}
  {#if ofKind('material').length === 0}<p>No materials.</p>{/if}
  <ul>
    {#each ofKind('material') as { item, count } (item.id)}
      <li>Floor {item.floor} · {item.name} ×{count}</li>
    {/each}
  </ul>
{/if}

<style>
  ul {
    margin: 0.5rem 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin-bottom: 0.25rem;
  }
</style>
