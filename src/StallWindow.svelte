<script lang="ts">
  import { itemById, type Location } from './lib/data';
  import type { RunAction, RunState } from './lib/run';

  const { run, location, onAction }: { run: RunState; location: Location; onAction: (action: RunAction) => void } = $props();

  const stock = $derived((location.shop ?? []).map((id) => itemById(id)!));
</script>

<p>Coins {run.coins}</p>
<ul>
  {#each stock as item (item.id)}
    <li>
      {item.name} · {item.price} coins
      <button aria-label="Buy {item.name}" disabled={run.coins < item.price!} onclick={() => onAction({ type: 'buy', item: item.id })}>
        Buy
      </button>
    </li>
  {/each}
</ul>

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
