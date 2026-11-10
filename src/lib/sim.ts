// Balance simulator: runs real fights through the game's own engine and data.
import balance from '../../data/balance.json';
import climberData from '../../data/climber.json';
import { statsAt } from './climber';
import { act, climberCombatant, createRng, enemyCombatant, enemyGroup, startFight, TIERS, type Tier } from './combat';
import { enemies, floors, groupName } from './data';

export interface SimRow {
  enemy: string;
  tier: Tier; // the strongest foe in the encounter
  runs: number;
  winRate: number;
  avgTurns: number; // climber actions per fight
  target: number;
  avgHpLeft: number; // share of max HP after a won fight
}

// The climber only uses weapon attacks; skill and item policies come when tuning needs them.
export function simulate(seed: number, runs: number, level = 1, floor = 1): SimRow[] {
  const climber = climberCombatant(statsAt(level, { weapon: climberData.startingWeapon }));

  const encounters = floors.find((f) => f.id === floor)!.locations.filter((l) => l.enemies);
  return encounters.map((location, index) => {
    const rng = createRng(seed + index * 0x9e3779b9); // own stream per encounter, so rows stay stable as data grows
    const foes = location.enemies!.map((id) => enemies.find((e) => e.id === id)!);
    const tier = foes.map((foe) => foe.tier).sort((a, b) => TIERS.indexOf(b) - TIERS.indexOf(a))[0];
    let wins = 0;
    let turns = 0;
    let hpLeft = 0;
    for (let run = 0; run < runs; run++) {
      let { state } = startFight(climber, enemyGroup(foes.map(enemyCombatant)), rng);
      while (state.outcome === 'ongoing') {
        ({ state } = act(state, { type: 'attack', target: state.enemies.findIndex((e) => e.hp > 0) }, rng));
        turns += 1;
      }
      if (state.outcome === 'won') {
        wins += 1;
        hpLeft += state.climber.hp / state.climber.maxHp;
      }
    }
    return {
      enemy: `${location.name}: ${groupName(foes.map((foe) => foe.name))}`,
      tier,
      runs,
      winRate: wins / runs,
      avgTurns: turns / runs,
      target: tier === 'floorMaster' ? balance.targetTurns.floorMaster[String(floor) as '1'] : balance.targetTurns[tier],
      avgHpLeft: wins ? hpLeft / wins : 0,
    };
  });
}

export function formatReport(rows: SimRow[]): string {
  const header = 'Enemy | Tier | Runs | Win | Turns | Target | Gap | HP left';
  const lines = rows.map((row) => {
    const gap = row.avgTurns - row.target;
    return [
      row.enemy,
      row.tier,
      row.runs,
      `${(row.winRate * 100).toFixed(1)}%`,
      row.avgTurns.toFixed(2),
      row.target,
      `${gap >= 0 ? '+' : ''}${gap.toFixed(1)}`,
      `${(row.avgHpLeft * 100).toFixed(1)}%`,
    ].join(' | ');
  });
  return [header, ...lines].join('\n');
}
