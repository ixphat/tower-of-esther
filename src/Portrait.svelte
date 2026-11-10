<script lang="ts">
  // Placeholder portraits until art exists.
  const GLYPHS = ['◆', '●', '▲', '■'];
  const { index }: { index: number } = $props();
</script>

<span class="portrait" role="img" aria-label="Portrait {index}">{GLYPHS[index - 1]}</span>

<style>
  .portrait {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--gold);
    color: var(--gold);
  }
</style>
