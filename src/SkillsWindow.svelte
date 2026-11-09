<script lang="ts">
  import balance from '../data/balance.json';
  import { skillById, skills as allSkills } from './lib/data';
  import type { RunAction, RunState } from './lib/run';

  const { run, onAction }: { run: RunState; onAction: (action: RunAction) => void } = $props();

  const filters = ['All', 'Attack', 'Defense', 'Recovery', 'Status', 'Tagged'];
  let filter = $state('All');
  let search = $state('');

  const pinsFull = $derived(!run.pins.includes(null));
  const owned = $derived(
    allSkills
      .filter((skill) => run.skills[skill.id])
      .filter((skill) => filter === 'All' || (filter === 'Tagged' ? skill.tag : skill.type === filter.toLowerCase()))
      .filter((skill) => skill.name.toLowerCase().includes(search.trim().toLowerCase())),
  );
</script>

<div class="tabs">
  {#each filters as name (name)}
    <button aria-pressed={filter === name} onclick={() => (filter = name)}>{name}</button>
  {/each}
</div>
<label>Search <input type="search" bind:value={search} /></label>

<p>Pinned: {run.pins.map((pin) => (pin ? skillById(pin)!.name : '-')).join(' | ')}</p>
<p>Active: Stance {run.stance ? skillById(run.stance)!.name : '-'} · Charge - · Form - · Aura -</p>

<ul>
  {#each owned as skill (skill.id)}
    {@const mine = run.skills[skill.id]}
    {@const pinned = run.pins.includes(skill.id)}
    <li>
      <strong>{skill.name}</strong>
      {balance.skillStages[mine.stage]} Lv {mine.level}{skill.tag ? ` · ${skill.tag}` : ''}
      <br />{skill.description}{skill.cooldown ? ` · Cooldown ${skill.cooldown}` : ''}
      <br />
      <button
        aria-label="{pinned ? 'Unpin' : 'Pin'} {skill.name}"
        disabled={!pinned && pinsFull}
        onclick={() => onAction({ type: 'togglePin', skill: skill.id })}>{pinned ? 'Unpin' : 'Pin'}</button
      >
      {#if !pinned && pinsFull}<span>Pins full</span>{/if}
      {#if skill.tag === 'Stance'}
        {@const active = run.stance === skill.id}
        <button
          aria-label="{active ? 'Drop' : 'Take'} Stance {skill.name}"
          onclick={() => onAction({ type: 'setStance', skill: active ? null : skill.id })}
          >{active ? 'Drop Stance' : 'Take Stance'}</button
        >
      {/if}
    </li>
  {/each}
</ul>

<style>
  label {
    display: block;
    margin: 0.5rem 0;
  }

  input {
    background: var(--ink);
    border: 1px solid var(--gold);
    color: var(--text);
    font: inherit;
    padding: 0.25rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin-bottom: 0.75rem;
  }
</style>
