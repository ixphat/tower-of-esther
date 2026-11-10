<script lang="ts">
  import balance from '../data/balance.json';
  import { questBoard } from './lib/quests';
  import type { RunAction, RunState } from './lib/run';

  const { run, onAction }: { run: RunState; onAction: (action: RunAction) => RunState } = $props();

  const tabs = ['Main', 'Side', 'Found secrets', 'Done'];
  let tab = $state('Main');
  const board = $derived(questBoard(run));
  const trackFull = $derived(board.side.filter((quest) => run.tracked.includes(quest.id)).length >= balance.trackedQuests);
</script>

<div class="tabs">
  {#each tabs as name (name)}
    <button aria-pressed={tab === name} onclick={() => (tab = name)}>{name}</button>
  {/each}
</div>

{#if tab === 'Main'}
  {#if board.main}
    <h3>{board.main.title}</h3>
    <p>{board.main.step}</p>
  {:else}
    <p>Nothing left to do here.</p>
  {/if}
{:else if tab === 'Side'}
  {#if board.side.length === 0}<p>No side quests yet.</p>{/if}
  <ul>
    {#each board.side as quest (quest.id)}
      {@const tracked = run.tracked.includes(quest.id)}
      <li>
        <strong>{quest.title}</strong>{quest.giver ? ` · ${quest.giver}` : ''}
        <br />{quest.step}
        <br />
        <button aria-pressed={tracked} disabled={!tracked && trackFull} onclick={() => onAction({ type: 'toggleTrack', quest: quest.id })}>
          {tracked ? 'Tracked' : 'Track'} {quest.title}
        </button>
        {#if !tracked && trackFull}<span>Tracker full</span>{/if}
      </li>
    {/each}
  </ul>
{:else if tab === 'Found secrets'}
  {#if board.secrets.length === 0}<p>Nothing found yet.</p>{/if}
  <ul>
    {#each board.secrets as secret (secret.id)}<li><strong>{secret.title}</strong><br />{secret.step}</li>{/each}
  </ul>
{:else}
  {#if board.done.length === 0}<p>Nothing finished yet.</p>{/if}
  <ul>
    {#each board.done as quest (quest.id)}<li><strong>{quest.title}</strong></li>{/each}
  </ul>
{/if}

<style>
  ul {
    margin: 0.5rem 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin-bottom: 0.75rem;
  }
</style>
