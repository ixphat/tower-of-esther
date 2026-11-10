import { describe, expect, it } from 'vitest';
import { formatReport, simulate } from './sim';

describe('balance simulator', () => {
  it('gives the same report for the same seed', () => {
    expect(simulate(7, 200)).toEqual(simulate(7, 200));
    expect(simulate(7, 200)).not.toEqual(simulate(8, 200));
  });

  it('reports every enemy against its tier target', () => {
    const [row] = simulate(1, 200);
    expect(row).toMatchObject({ enemy: 'Straw Remnant', tier: 'normal', target: 3, runs: 200 });
    expect(row.winRate).toBeGreaterThan(0);
    expect(row.avgTurns).toBeGreaterThan(0);
    expect(row.avgHpLeft).toBeLessThanOrEqual(1);
  });

  it('prints the gap to target', () => {
    const text = formatReport([
      { enemy: 'A', tier: 'normal', runs: 10, winRate: 1, avgTurns: 4.5, target: 3, avgHpLeft: 0.9 },
    ]);
    expect(text).toContain('A');
    expect(text).toContain('+1.5');
  });
});
