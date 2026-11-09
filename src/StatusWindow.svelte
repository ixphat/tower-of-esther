<script lang="ts">
  import { expToNext, heroParts, heroPower, statsAt } from './lib/climber';
  import { climberCombatant, evasionChance } from './lib/combat';
  import type { Floor } from './lib/data';
  import type { RunState } from './lib/run';

  const { run, floor }: { run: RunState; floor: Floor } = $props();

  const tabs = ['Overview', 'Titles', 'Bonds', 'Floor clears'];
  let tab = $state('Overview');

  const stats = $derived(statsAt(run.level));
  const parts = $derived(heroParts(run.level));
  const hero = $derived(heroPower(parts));
  const bars = $derived([
    ['Stats', parts.stats],
    ['Skills', parts.skills],
    ['Gear', parts.gear],
  ] as const);
</script>

<div class="tabs">
  {#each tabs as name (name)}
    <button aria-pressed={tab === name} onclick={() => (tab = name)}>{name}</button>
  {/each}
</div>

{#if tab === 'Overview'}
  <p>Lv {run.level} · EXP {run.exp} / {expToNext(run.level)}</p>
  <progress max={expToNext(run.level)} value={run.exp} aria-hidden="true"></progress>
  <ul>
    <li>Vitality {stats.vitality}</li>
    <li>Power {stats.power}</li>
    <li>Agility {stats.agility}</li>
    <li>Mind {stats.mind}</li>
    <li>Evasion {(evasionChance(stats.agility) * 100).toFixed(1)}%</li>
    <li>Guard {climberCombatant(stats).guard}</li>
    <li>Ward {stats.mind}</li>
  </ul>
  <p>Hero power {hero.grade} · score {hero.score} · recommended grade {floor.recommendedGrade}</p>
  {#each bars as [label, value] (label)}
    <div class="bar">
      <span>{label} {Math.min(value, hero.cap)} / {hero.cap}</span>
      <span class="track" style="--cap: {(hero.cap / hero.needed) * 100}%">
        <progress max={hero.needed} value={value} aria-label="{label}, cap {hero.cap}"></progress>
      </span>
    </div>
  {/each}
{:else if tab === 'Titles'}
  <p>No titles yet.</p>
{:else if tab === 'Bonds'}
  <p>No bonds yet.</p>
{:else}
  <p>No floor cleared yet.</p>
{/if}

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  [aria-pressed='true'] {
    background: var(--gold);
    color: var(--ink);
  }

  ul {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    margin: 1rem 0;
    padding: 0;
    list-style: none;
  }

  .track {
    position: relative;
    display: block;
  }

  .track::after {
    content: '';
    position: absolute;
    inset: 0 auto 0 var(--cap);
    border-left: 1px solid var(--text);
  }
</style>
