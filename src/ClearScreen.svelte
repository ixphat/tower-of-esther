<script lang="ts">
  import type { ClearRecord } from './lib/run';

  import { onMount } from 'svelte';

  const { floorName, endText, record, onClose }: { floorName: string; endText: string; record: ClearRecord; onClose: () => void } =
    $props();
  let heading = $state<HTMLHeadingElement>();
  onMount(() => heading?.focus()); // announce the result to keyboard and screen-reader users
</script>

<section class="clear" aria-label="Floor cleared">
  <h2 bind:this={heading} tabindex="-1">{floorName} cleared</h2>
  <p class="grade">Grade {record.grade} · {record.total} points</p>
  <dl>
    <dt>Path</dt><dd>{record.factors.path}</dd>
    <dt>Content</dt><dd>{record.factors.content}</dd>
    <dt>Secrets</dt><dd>{record.factors.secrets}/{record.factors.secretsMax}</dd>
    <dt>Style</dt><dd>{record.factors.style}</dd>
  </dl>
  {#each [...record.missing.path, ...record.missing.content, ...record.missing.style] as line (line)}
    <p class="missing">{line}</p>
  {/each}
  <p>{endText}</p>
  <button onclick={onClose}>Continue</button>
</section>

<style>
  .clear {
    animation: clear-flash 1200ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.5rem;
    background: var(--navy);
    border: 1px solid var(--gold);
  }

  @keyframes clear-flash {
    from { box-shadow: 0 0 0 100vmax rgb(179 154 99 / 0.35); }
    to { box-shadow: 0 0 0 100vmax transparent; }
  }

  @media (prefers-reduced-motion: reduce) {
    .clear {
      animation: none;
    }
  }

  .grade {
    font-family: var(--heading-font);
    font-size: 1.5rem;
    color: var(--gold);
  }

  dl {
    display: grid;
    grid-template-columns: max-content max-content;
    gap: 0.25rem 1rem;
    margin: 0;
  }

  dd {
    margin: 0;
  }

  .missing {
    margin: 0;
    font-size: 0.9rem;
  }
</style>
