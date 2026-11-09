import balance from '../../data/balance.json';
import climberData from '../../data/climber.json';
import { expToNext, maxHp, type Worn } from './climber';
import { itemById, type Enemy, type Floor } from './data';

export interface Rewards {
  exp: number;
  drops: Record<string, number>;
}

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
  coins: number;
  items: Record<string, number>; // carried consumables, materials and spare gear
  worn: Worn;
  cleared: string[]; // locations whose monsters are beaten until re-entry
}

export type RunAction =
  | { type: 'move'; to: string }
  | { type: 'rest' }
  | { type: 'fightStart' }
  | { type: 'spendItem'; item: string }
  | { type: 'useItem'; item: string }
  | { type: 'buy'; item: string }
  | { type: 'equip'; item: string }
  | { type: 'fightEnd'; outcome: 'won'; hp: number; rewards: Rewards }
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
    coins: 0,
    items: { ...climberData.startingItems },
    worn: { weapon: climberData.startingWeapon },
    cleared: [],
  };
}

export function fightRewards(foes: Enemy[]): Rewards {
  const drops: Record<string, number> = {};
  for (const foe of foes) {
    for (const [item, amount] of Object.entries(foe.drops)) drops[item] = (drops[item] ?? 0) + amount;
  }
  return { exp: foes.reduce((sum, foe) => sum + foe.exp, 0), drops };
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

function withItem(carried: Record<string, number>, item: string, amount: number): Record<string, number> {
  const count = (carried[item] ?? 0) + amount;
  if (count < 0) throw new Error(`Not holding ${item}`);
  return { ...carried, [item]: count };
}

function winFight(state: RunState, hp: number, rewards: Rewards): RunState {
  let { level } = state;
  let exp = state.exp + rewards.exp;
  while (exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
  }
  let carried = state.items;
  for (const [item, amount] of Object.entries(rewards.drops)) carried = withItem(carried, item, amount);
  return {
    ...state,
    level,
    exp,
    hp: level > state.level ? maxHp(level) : hp,
    inFight: false,
    items: carried,
    cleared: [...state.cleared, state.locationId],
  };
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
      return { ...state, locationId: action.to, safePoint, cleared: state.cleared.filter((id) => id !== action.to) };
    }
    case 'rest':
      if (!find(floor, state.locationId).rest) throw new Error('No resting place here');
      return { ...state, hp: maxHp(state.level) };
    case 'spendItem':
      return { ...state, items: withItem(state.items, action.item, -1) };
    case 'useItem': {
      const heal = itemById(action.item)?.heal;
      if (!heal) throw new Error(`${action.item} does not heal`);
      const hp = Math.min(maxHp(state.level), state.hp + Math.round(maxHp(state.level) * heal));
      return { ...state, hp, items: withItem(state.items, action.item, -1) };
    }
    case 'buy': {
      const price = itemById(action.item)?.price;
      if (!find(floor, state.locationId).shop?.includes(action.item) || price === undefined) {
        throw new Error(`${action.item} is not sold here`);
      }
      if (state.coins < price) throw new Error('Not enough coins');
      return { ...state, coins: state.coins - price, items: withItem(state.items, action.item, 1) };
    }
    case 'equip': {
      const slot = itemById(action.item)?.slot;
      if (!slot) throw new Error(`${action.item} cannot be worn`);
      const previous = state.worn[slot];
      const carried = withItem(state.items, action.item, -1);
      return {
        ...state,
        items: previous ? withItem(carried, previous, 1) : carried,
        worn: { ...state.worn, [slot]: action.item },
      };
    }
    case 'fightStart':
      return { ...state, inFight: true };
    case 'fightEnd':
      return action.outcome === 'lost'
        ? defeat(state)
        : winFight(state, action.hp, action.rewards);
  }
}

export function resumeRun(state: RunState, floor: Floor): RunState {
  return state.inFight ? applyAction(state, floor, { type: 'fightEnd', outcome: 'lost' }) : state;
}
