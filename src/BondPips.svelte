<script lang="ts">
  import balance from '../data/balance.json';
  import { bondLevel } from './lib/run';

  const { points }: { points: number | undefined } = $props();
  const level = $derived(bondLevel(points));
</script>

<span role="img" aria-label="Bond {balance.bondLevels[level]}">
  {#each balance.bondLevels as name, index (name)}{index <= level ? '●' : '○'}{/each}
</span>
