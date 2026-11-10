<script lang="ts">
  // An HP bar that moves smoothly between values.
  const { value, max, label }: { value: number; max: number; label: string } = $props();
</script>

<div class="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
  <div class="fill" style="width: {(value / max) * 100}%"></div>
</div>

<style>
  .bar {
    width: 100%;
    height: 0.6rem;
    border: 1px solid var(--gold);
    background: var(--ink);
  }

  .fill {
    height: 100%;
    background: var(--gold);
    transition: width 400ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
