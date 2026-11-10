<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import balance from '../data/balance.json';
  import BondPips from './BondPips.svelte';
  import { canSkip, nodeAt, skipTarget, visibleChoices } from './lib/dialogue';
  import { itemById, npcById, sceneById } from './lib/data';
  import { bondLevel, type RunAction, type RunState } from './lib/run';
  import type { TextSpeed } from './lib/settings';

  interface Props {
    run: RunState;
    npc?: string; // none for the Tower's voice and found writing
    scene: string;
    textSpeed: TextSpeed;
    onAction: (action: RunAction) => RunState;
    onLeave: () => void;
  }

  const { run, npc, scene, textSpeed, onAction, onLeave }: Props = $props();
  const MS_PER_CHAR: Record<TextSpeed, number> = { Normal: 30, Fast: 10, Instant: 0 };

  // svelte-ignore state_referenced_locally -- the scene is fixed while this box is open
  const person = npc ? npcById(npc) : undefined;
  // svelte-ignore state_referenced_locally
  const sceneStart = sceneById(scene)!.start;
  let nodeId = $state('');
  let shown = $state(0);
  let wasSeen = $state(false);
  let log = $state<string[]>([]);
  let showLog = $state(false);
  let giving = $state(false);
  let note = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;
  let box = $state<HTMLElement>();

  const node = $derived(nodeId ? nodeAt(scene, nodeId) : null);
  const typing = $derived(node !== null && shown < node.text.length);
  const choices = $derived(node && !typing ? visibleChoices(node, run) : []);
  const ended = $derived(node !== null && !typing && !node.next && !node.choices);
  const gifts = $derived(
    Object.entries(run.items).filter(([id, count]) => count > 0 && itemById(id)!.kind !== 'equipment'),
  );
  const giftedHere = $derived(run.giftedThisVisit.filter((id) => id === npc).length >= balance.giftsPerVisit);
  const speaker = $derived(node?.speaker ?? person?.name ?? '');

  // Every action that can change the bond goes through here, so the note reflects it.
  function act(action: RunAction) {
    const before = npc ? (run.bonds[npc] ?? 0) : 0; // read before the action changes the run
    const next = onAction(action);
    if (!npc || !person) return;
    const after = next.bonds[npc] ?? 0;
    if (after > before) {
      const level = bondLevel(after);
      note = `${person.name}: bond +${after - before}${level > bondLevel(before) ? `, now ${balance.bondLevels[level]}` : ''}`;
    }
  }

  async function enter(id: string) {
    clearInterval(timer);
    wasSeen = canSkip(scene, id, run);
    nodeId = id;
    act({ type: 'seeLine', scene, node: id });
    const { text } = nodeAt(scene, id);
    log = [...log, text];
    shown = MS_PER_CHAR[textSpeed] ? 0 : text.length;
    if (shown < text.length) timer = setInterval(() => (shown < text.length ? (shown += 1) : clearInterval(timer)), MS_PER_CHAR[textSpeed]);
    await focusFirst();
  }

  // Next, the first choice, or Leave at the end.
  async function focusFirst() {
    await tick();
    box?.querySelector<HTMLButtonElement>('.talk button:not([disabled]), .leave')?.focus();
  }

  function next() {
    if (typing) {
      shown = node!.text.length; // a press finishes the line
      clearInterval(timer);
      focusFirst();
    } else if (node?.next) enter(node.next);
  }

  function choose(index: number) {
    act({ type: 'choose', scene, node: nodeId, choice: index });
    const target = node!.choices![index].next;
    if (target) enter(target);
    else onLeave();
  }

  onMount(() => enter(sceneStart));
  onDestroy(() => clearInterval(timer));
</script>

<section bind:this={box} class="box" aria-label={person ? `Talking with ${person.name}` : 'Scene'}>
  <header>
    <strong>{speaker}</strong>
    {#if npc}<BondPips points={run.bonds[npc]} />{/if}
    <button aria-pressed={showLog} onclick={() => (showLog = !showLog)}>Log</button>
  </header>

  {#if showLog}
    <ol class="log" aria-label="Earlier lines">
      {#each log.slice(0, -1) as line, index (index)}<li>{line}</li>{/each}
    </ol>
  {/if}

  <p aria-hidden="true">{node?.text.slice(0, shown)}</p>
  <p class="sr-only" aria-live="polite">{node?.text}</p>
  {#if note}<p class="note" role="status">{note}</p>{/if}

  <div class="row talk">
    {#each choices as choice (choice.index)}
      <button onclick={() => choose(choice.index)}>{choice.text}</button>
    {/each}
    {#if typing || node?.next}
      <button onclick={next}>Next</button>
    {/if}
    {#if node?.next && !node.choices}
      <button disabled={!wasSeen} onclick={() => enter(skipTarget(scene, nodeId, run))}>Skip</button>
    {/if}
  </div>

  <div class="row">
    {#if npc}
    <button aria-expanded={giving} disabled={giftedHere} onclick={() => (giving = !giving)}>
      Give gift{giftedHere ? ' (gift limit reached)' : ''}
    </button>
    {/if}
    <button class="leave" onclick={onLeave}>Leave{ended ? '' : ' now'}</button>
  </div>

  {#if npc && giving && !giftedHere}
    <div class="row" role="group" aria-label="Gifts">
      {#if gifts.length === 0}<span>Nothing to give.</span>{/if}
      {#each gifts as [id, count] (id)}
        <button onclick={() => { act({ type: 'gift', npc: npc!, item: id }); giving = false; }}>
          Give {itemById(id)!.name} ×{count}
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--navy);
    border: 1px solid var(--gold);
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  p {
    margin: 0;
    min-height: 1.5em;
  }

  .note {
    color: var(--gold);
    font-size: 0.9rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .log {
    margin: 0;
    padding-left: 1.25rem;
    opacity: 0.8;
  }
</style>
