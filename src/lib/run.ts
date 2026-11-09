import balance from '../../data/balance.json';
import climberData from '../../data/climber.json';
import { climberCombatant } from './combat';
import type { Floor } from './data';

export interface RunState {
  locationId: string;
  safePoint: string;
  hp: number;
  exp: number; // progress toward the next level
  bonds: Record<string, number>; // bond points by NPC id
  lastBond: string | null; // NPC whose bond was raised most recently
  memoriesLost: number; // never shown as a number
  inFight: boolean; // saved so that abandoning a fight counts as a defeat
}

export type RunAction =
  | { type: 'move'; to: string }
  | { type: 'rest' }
  | { type: 'fightStart' }
  | { type: 'fightEnd'; outcome: 'won' | 'lost'; hp: number };

export const maxHp = (): number => climberCombatant(climberData).maxHp;

export function newRun(floor: Floor): RunState {
  return {
    locationId: floor.start,
    safePoint: floor.start,
    hp: maxHp(),
    exp: 0,
    bonds: {},
    lastBond: null,
    memoriesLost: 0,
    inFight: false,
  };
}

function find(floor: Floor, id: string) {
  const location = floor.locations.find((l) => l.id === id);
  if (!location) throw new Error(`Unknown location ${id}`);
  return location;
}

function lowerLastBond({ bonds, lastBond }: RunState): Record<string, number> {
  if (lastBond === null) return bonds;
  const bondLevel = balance.bondThresholds.filter((points) => points <= bonds[lastBond]).length - 1;
  return bondLevel === 0 ? bonds : { ...bonds, [lastBond]: balance.bondThresholds[bondLevel - 1] };
}

function defeat(state: RunState): RunState {
  return {
    ...state,
    locationId: state.safePoint,
    hp: maxHp(),
    exp: state.exp - Math.ceil((state.exp * balance.defeatExpLossPercent) / 100),
    bonds: lowerLastBond(state),
    memoriesLost: state.memoriesLost + 1,
    inFight: false,
  };
}

export function applyAction(state: RunState, floor: Floor, action: RunAction): RunState {
  switch (action.type) {
    case 'move': {
      if (!find(floor, state.locationId).exits.includes(action.to)) throw new Error(`No exit to ${action.to}`);
      const safePoint = find(floor, action.to).rest ? action.to : state.safePoint;
      return { ...state, locationId: action.to, safePoint };
    }
    case 'rest':
      if (!find(floor, state.locationId).rest) throw new Error('No resting place here');
      return { ...state, hp: maxHp() };
    case 'fightStart':
      return { ...state, inFight: true };
    case 'fightEnd':
      return action.outcome === 'lost' ? defeat(state) : { ...state, hp: action.hp, inFight: false };
  }
}

export function resumeRun(state: RunState, floor: Floor): RunState {
  return state.inFight ? applyAction(state, floor, { type: 'fightEnd', outcome: 'lost', hp: 0 }) : state;
}
