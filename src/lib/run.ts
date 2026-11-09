import balance from '../../data/balance.json';
import { expToNext, maxHp } from './climber';
import type { Floor } from './data';

export interface RunState {
  locationId: string;
  safePoint: string;
  hp: number;
  level: number;
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
  | { type: 'fightEnd'; outcome: 'won'; hp: number; exp: number }
  | { type: 'fightEnd'; outcome: 'lost' };

export function newRun(floor: Floor): RunState {
  return {
    locationId: floor.start,
    safePoint: floor.start,
    hp: maxHp(1),
    level: 1,
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

function winFight(state: RunState, hp: number, gained: number): RunState {
  let { level } = state;
  let exp = state.exp + gained;
  while (exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
  }
  return { ...state, level, exp, hp: level > state.level ? maxHp(level) : hp, inFight: false };
}

function defeat(state: RunState): RunState {
  return {
    ...state,
    locationId: state.safePoint,
    hp: maxHp(state.level),
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
      return { ...state, hp: maxHp(state.level) };
    case 'fightStart':
      return { ...state, inFight: true };
    case 'fightEnd':
      return action.outcome === 'lost'
        ? defeat(state)
        : winFight(state, action.hp, action.exp);
  }
}

export function resumeRun(state: RunState, floor: Floor): RunState {
  return state.inFight ? applyAction(state, floor, { type: 'fightEnd', outcome: 'lost' }) : state;
}
