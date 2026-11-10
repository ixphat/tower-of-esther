<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { fightLoadout, statsAt, type OwnedSkills } from './lib/climber';
  import { act, climberCombatant, createRng, enemyCombatant, enemyGroup, fleeBlock, isStrong, skillBlock, startFight, type Action, type Combatant, type EnemyMove, type FightEvent, type FightSkill, type FightState } from './lib/combat';
  import { itemById, type Enemy, type Floor, type Item } from './lib/data';
  import { fightRewards, type Rewards } from './lib/run';
  import balance from '../data/balance.json';
  import Bar from './Bar.svelte';
  import type { Worn } from './lib/climber';

  interface Props {
    floor: Floor;
    foes: Enemy[];
    hp: number;
    level: number;
    classId: string;
    name: string;
    worn: Worn;
    items: Record<string, number>;
    skills: OwnedSkills;
    pins: (string | null)[];
    stance: string | null;
    onSpendItem: (item: string) => void; // saved at once, a used item stays used
    onFinish: (outcome: 'won' | 'lost' | 'fled', hp: number, rewards: Rewards, used: string[], trial: { turns: number; hitsTaken: number }) => void; // the moment the fight ends, so a reload on the result screen cannot undo it
    onReturn: () => void;
  }

  const { floor, foes, hp, level, classId, name, worn, items, skills, pins, stance, onSpendItem, onFinish, onReturn }: Props = $props();

  const LOG_LINES = 5;
  const TAGS = ['Stance', 'Charge', 'Form', 'Aura'];
  const MOVE_TYPES: Record<EnemyMove['type'], string> = { attack: 'Attack', guard: 'Guard', status: 'Status', charge: 'Charge' };
  const STATUS_NAMES: Record<string, string> = {
    poison: 'Poison',
    burn: 'Burn',
    stun: 'Stun',
    confuse: 'Confuse',
    restrain: 'Restrain',
    fear: 'Fear',
    slow: 'Slow',
    accuracyDown: 'Accuracy down',
  };

  function describe(event: FightEvent): string {
    if (event.type === 'miss') return `${event.target} evades ${event.attacker}.`;
    if (event.type === 'skill') return `${event.actor} uses ${event.skill}.`;
    if (event.type === 'status') return `${event.target}: ${STATUS_NAMES[event.status]}.`;
    if (event.type === 'cleanse') return `${event.target} is rid of ${STATUS_NAMES[event.status]}.`;
    if (event.type === 'tick') return `${event.target} takes ${event.damage} from ${STATUS_NAMES[event.status]}.`;
    if (event.type === 'stunned') return `${event.actor} is stunned.`;
    if (event.type === 'charge') return `${event.actor} winds up.`;
    if (event.type === 'yield') return `${event.actor} yields.`;
    if (event.type === 'fleeFailed') return `${event.actor} fails to flee.`;
    if (event.type === 'fail') return `${event.actor}'s move fails.`;
    if (event.type === 'heal') return `${event.target} recovers ${event.amount} HP.`;
    if (event.type === 'end') return { won: 'Victory.', lost: 'Defeated.', fled: 'Fled.' }[event.outcome];
    return `${event.crit ? 'Critical. ' : ''}${event.attacker} hits ${event.target} for ${event.damage}.`;
  }

  const rng = createRng(crypto.getRandomValues(new Uint32Array(1))[0]);
  // svelte-ignore state_referenced_locally -- foes are fixed for the life of this fight
  const start = startFight({ ...climberCombatant(statsAt(level, worn, classId)), name, hp }, enemyGroup(foes.map(enemyCombatant)), rng, fightLoadout(skills, stance));

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
    onFinish(state.outcome, state.climber.hp, rewards, state.used, { turns: state.climberTurn, hitsTaken: state.hitsTaken });
  }

  onMount(() => reportEnd(start.state)); // a faster enemy can end the fight before the first action

  const healingItems = $derived(
    Object.entries(items)
      .map(([id, count]) => ({ item: itemById(id)!, count }))
      .filter(({ item, count }) => count > 0 && item.heal && !item.outsideFightOnly),
  );
  const healLimitReached = $derived(fight.healsUsed >= balance.healItemsPerFight);

  let showSkills = $state(false);
  const pinned = $derived(pins.map((id) => fight.skills.find((skill) => skill.id === id) ?? null));
  const visibleStatuses = (c: Combatant) => c.statuses.filter((status) => STATUS_NAMES[status.id]);
  const tagValue = (tag: string) =>
    tag === 'Stance' ? (fight.skills.find((skill) => skill.id === fight.stance)?.name ?? '-') : '-';

  let chosen = $state(0);
  const target = $derived(fight.enemies[chosen]?.hp > 0 ? chosen : fight.enemies.findIndex((e) => e.hp > 0));
  const fleeReason = $derived(fleeBlock(fight));

  function useSkill(id: string) {
    return perform({ type: 'skill', skill: id, target });
  }

  function attack() {
    return perform({ type: 'attack', target });
  }

  function heal(item: Item) {
    const done = perform({ type: 'heal', fraction: item.heal! }); // throws first if refused, so nothing is spent
    onSpendItem(item.id);
    return done;
  }

  // Short-lived effects: floating numbers, a shake on whoever was hit, a flash on a critical.
  let floats = $state<{ key: number; target: string; text: string; crit: boolean }[]>([]);
  let shaking = $state<string[]>([]);
  let flash = $state(false);
  let nextKey = 0;
  let fullLog = $state(false);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(run: () => void, ms: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  }
  onDestroy(() => timers.forEach(clearTimeout));
  const EFFECT_MS = 900;

  function showEffects(events: FightEvent[]) {
    for (const event of events) {
      if (event.type === 'hit' || event.type === 'heal') {
        const target = event.targetId;
        const key = nextKey++;
        const text = event.type === 'hit' ? `-${event.damage}` : `+${event.amount}`;
        const crit = event.type === 'hit' && event.crit;
        floats = [...floats, { key, target, text, crit }];
        later(() => (floats = floats.filter((f) => f.key !== key)), EFFECT_MS);
        if (event.type === 'hit') {
          shaking = [...shaking, target];
          later(() => (shaking = shaking.filter((id) => id !== target)), EFFECT_MS / 3);
        }
        if (crit) {
          flash = true;
          later(() => (flash = false), EFFECT_MS / 3);
        }
      }
    }
  }

  async function perform(action: Action) {
    const step = act($state.snapshot(fight), action, rng);
    showEffects(step.events);
    fight = step.state;
    log = [...log, ...step.events.map(describe)];
    reportEnd(step.state);
    await tick();
    back?.focus(); // the attack button is gone once the fight ends
  }
</script>

{#snippet skillButton(skill: FightSkill)}
  {@const block = skillBlock(fight, skill.id)}
  <button disabled={block !== null} onclick={() => useSkill(skill.id)}>{skill.name}{block ? ` (${block})` : ''}</button>
{/snippet}

{#if flash}<div class="flash" aria-hidden="true"></div>{/if}

<div class="screen fight">
  <header>
    <h1>Floor {floor.id} · Round {fight.round}</h1>
    <details class="chip"><summary>{floor.rule.label}</summary>{floor.rule.text}</details>
    <ol class="order" aria-label="Turn order">
      {#each order as combatant (combatant.id)}
        <li class:current={combatant.id === fight.turnOrder[fight.turn]}>{combatant.name}</li>
      {/each}
    </ol>
  </header>

  <main class="scene">
    {#each everyone as combatant, index (combatant.id)}
      <section class:strong={isStrong(combatant)} class:shake={shaking.includes(combatant.id)}>
        <h2>{combatant.name}</h2>
        {#if index > 0 && combatant.hp > 0 && fight.outcome === 'ongoing'}
          <button aria-pressed={target === index - 1} onclick={() => (chosen = index - 1)}>
            Target {combatant.name} {index}
          </button>
        {/if}
        <Bar value={combatant.hp} max={combatant.maxHp} label="{combatant.name} HP" />
        {#each floats.filter((f) => f.target === combatant.id) as f (f.key)}
          <span class="float" class:crit={f.crit} aria-hidden="true">{f.text}</span>
        {/each}
        <p>{combatant.hp} / {combatant.maxHp}</p>
        {#if combatant.planned}<p>Next: {MOVE_TYPES[combatant.planned.type]}</p>{/if}
        <p>
          Statuses:
          {visibleStatuses(combatant).map((s) => `${STATUS_NAMES[s.id]} ${s.turns}`).join(', ') || '-'}
        </p>
      </section>
    {/each}
  </main>

  <ul class="tags" aria-label="Tag slots">
    {#each TAGS as tag (tag)}
      <li>{tag}: {tagValue(tag)}</li>
    {/each}
  </ul>

  <button aria-expanded={fullLog} onclick={() => (fullLog = !fullLog)}>{fullLog ? 'Short log' : 'Full log'}</button>
  <div role="log" aria-label="Combat log" class="log" class:collapsed={!fullLog}>
    {#each fullLog ? log : log.slice(-LOG_LINES) as line, index (index)}
      <p>{line}</p>
    {/each}
  </div>

  {#if fight.outcome === 'ongoing'}
    <div class="actions">
      <button onclick={attack}>Weapon attack</button>
      {#each healingItems as { item, count } (item.id)}
        <button disabled={healLimitReached} onclick={() => heal(item)}>{item.name} ×{count}</button>
      {/each}
      {#if healLimitReached}<span>Healing items used up for this fight.</span>{/if}
      <button disabled={fleeReason !== null} onclick={() => perform({ type: 'flee' })}>
        Flee{fleeReason ? ` (${fleeReason})` : ''}
      </button>
      <button aria-expanded={showSkills} onclick={() => (showSkills = !showSkills)}>Skills</button>
    </div>
    <div class="actions" role="group" aria-label="Pinned skills">
      {#each pinned as skill, slot (slot)}
        {#if skill}
          {@render skillButton(skill)}
        {:else}
          <button disabled aria-label="Empty pin {slot + 1}">-</button>
        {/if}
      {/each}
    </div>
    {#if showSkills}
      <div class="actions" role="group" aria-label="All skills">
        {#each fight.skills as skill (skill.id)}
          {@render skillButton(skill)}
        {/each}
      </div>
    {/if}
  {:else}
    <div class="actions"><button bind:this={back} onclick={onReturn}>Return</button></div>
  {/if}
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

  section {
    position: relative;
  }

  .float {
    position: absolute;
    top: 0;
    right: 0;
    color: var(--text);
    font-weight: 700;
    animation: rise 900ms ease-out forwards;
  }

  .float.crit {
    color: var(--gold);
    font-size: 1.4rem;
  }

  .shake {
    animation: shake 300ms;
  }

  .flash {
    position: fixed;
    inset: 0;
    background: var(--gold);
    opacity: 0;
    pointer-events: none;
    animation: flash 300ms;
  }

  .chip {
    padding: 0 0.5rem;
    border: 1px solid var(--gold);
    font-size: 0.85rem;
  }

  @keyframes rise {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(-2rem); opacity: 0; }
  }

  @keyframes shake {
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }

  @keyframes flash {
    50% { opacity: 0.25; }
  }

  @media (prefers-reduced-motion: reduce) {
    .float, .shake, .flash {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .fight .scene {
      padding: 0.75rem;
      gap: 0.75rem;
      min-height: auto;
    }

    .log {
      min-height: auto;
    }

    .log.collapsed p:not(:last-child) {
      /* one line on a phone, still read by screen readers */
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .actions {
      position: sticky;
      bottom: 0;
      padding: 0.5rem 0;
      background: var(--ink);
    }
  }

  .strong {
    outline: 1px solid var(--gold);
    outline-offset: 0.5rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
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
