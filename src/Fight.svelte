<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { statsAt } from './lib/climber';
  import { act, climberCombatant, createRng, enemyCombatant, startFight, type Action, type FightEvent, type FightState } from './lib/combat';
  import { itemById, type Enemy, type Floor, type Item } from './lib/data';
  import { fightRewards, type Rewards } from './lib/run';
  import balance from '../data/balance.json';
  import type { Worn } from './lib/climber';

  interface Props {
    floor: Floor;
    foes: Enemy[];
    hp: number;
    level: number;
    worn: Worn;
    items: Record<string, number>;
    onSpendItem: (item: string) => void; // saved at once, a used item stays used
    onFinish: (outcome: 'won' | 'lost', hp: number, rewards: Rewards) => void; // the moment the fight ends, so a reload on the result screen cannot undo it
    onReturn: () => void;
  }

  const { floor, foes, hp, level, worn, items, onSpendItem, onFinish, onReturn }: Props = $props();

  const LOG_LINES = 5;

  function describe(event: FightEvent): string {
    if (event.type === 'miss') return `${event.target} evades ${event.attacker}.`;
    if (event.type === 'heal') return `${event.target} recovers ${event.amount} HP.`;
    if (event.type === 'end') return event.outcome === 'won' ? 'Victory.' : 'Defeated.';
    return `${event.crit ? 'Critical. ' : ''}${event.attacker} hits ${event.target} for ${event.damage}.`;
  }

  const rng = createRng(crypto.getRandomValues(new Uint32Array(1))[0]);
  // svelte-ignore state_referenced_locally -- foes are fixed for the life of this fight
  const start = startFight({ ...climberCombatant(statsAt(level, worn)), hp }, foes.map(enemyCombatant), rng);

  let fight = $state(start.state);
  let log = $state(start.events.map(describe));
  let back = $state<HTMLButtonElement>();

  const everyone = $derived([fight.climber, ...fight.enemies]);
  const order = $derived(fight.turnOrder.map((id) => everyone.find((c) => c.id === id)!).filter((c) => c.hp > 0));

  function reportEnd(state: FightState) {
    if (state.outcome === 'ongoing') return;
    const rewards = fightRewards(foes);
    if (state.outcome === 'won') {
      const drops = Object.entries(rewards.drops).map(([id, amount]) => `${itemById(id)!.name} ×${amount}`);
      log = [...log, `Gained ${[`${rewards.exp} EXP`, ...drops].join(', ')}.`];
    }
    onFinish(state.outcome, state.climber.hp, rewards);
  }

  onMount(() => reportEnd(start.state)); // a faster enemy can end the fight before the first action

  const healingItems = $derived(
    Object.entries(items)
      .map(([id, count]) => ({ item: itemById(id)!, count }))
      .filter(({ item, count }) => count > 0 && item.heal && !item.outsideFightOnly),
  );
  const healLimitReached = $derived(fight.healsUsed >= balance.healItemsPerFight);

  function attack() {
    return perform({ type: 'attack', target: fight.enemies.findIndex((e) => e.hp > 0) });
  }

  function heal(item: Item) {
    const done = perform({ type: 'heal', fraction: item.heal! }); // throws first if refused, so nothing is spent
    onSpendItem(item.id);
    return done;
  }

  async function perform(action: Action) {
    const step = act($state.snapshot(fight), action, rng);
    fight = step.state;
    log = [...log, ...step.events.map(describe)];
    reportEnd(step.state);
    await tick();
    back?.focus(); // the attack button is gone once the fight ends
  }
</script>

<div class="screen">
  <header>
    <h1>Floor {floor.id} · Round {fight.round}</h1>
    <ol class="order" aria-label="Turn order">
      {#each order as combatant (combatant.id)}
        <li class:current={combatant.id === fight.turnOrder[fight.turn]}>{combatant.name}</li>
      {/each}
    </ol>
  </header>

  <main class="scene">
    {#each everyone as combatant (combatant.id)}
      <section>
        <h2>{combatant.name}</h2>
        <progress max={combatant.maxHp} value={combatant.hp} aria-label="{combatant.name} HP"></progress>
        <p>{combatant.hp} / {combatant.maxHp}</p>
      </section>
    {/each}
  </main>

  <div role="log" aria-label="Combat log" class="log">
    {#each log.slice(-LOG_LINES) as line, index (log.length - LOG_LINES + index)}
      <p>{line}</p>
    {/each}
  </div>

  <div class="actions">
    {#if fight.outcome === 'ongoing'}
      <button onclick={attack}>Weapon attack</button>
      {#each healingItems as { item, count } (item.id)}
        <button disabled={healLimitReached} onclick={() => heal(item)}>{item.name} ×{count}</button>
      {/each}
      {#if healLimitReached}<span>Healing items used up for this fight.</span>{/if}
    {:else}
      <button bind:this={back} onclick={onReturn}>Return</button>
    {/if}
  </div>
</div>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
  }

  h1 {
    font-size: 1.1rem;
  }

  .order {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .order li {
    padding: 0 0.5rem;
    border: 1px solid transparent;
  }

  .order .current {
    border-color: var(--gold);
  }

  .scene {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    align-content: center;
    gap: 1.5rem;
    padding: 1.5rem;
    background: var(--navy);
    border: 1px solid var(--gold);
  }

  .scene p,
  .log p {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .log {
    min-height: 7.5rem;
  }
</style>
