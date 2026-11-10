// Device settings, kept apart from the save so a new game keeps them.
const KEY = 'tower-of-esther.settings';
export const TEXT_SPEEDS = ['Normal', 'Fast', 'Instant'] as const;
export type TextSpeed = (typeof TEXT_SPEEDS)[number];
export interface Settings {
  textSpeed: TextSpeed;
}

export function loadSettings(storage: Pick<Storage, 'getItem'>): Settings {
  try {
    const saved = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (TEXT_SPEEDS.includes(saved?.textSpeed)) return { textSpeed: saved.textSpeed };
  } catch {
    // unreadable settings are replaced by the defaults below
  }
  return { textSpeed: 'Normal' };
}

export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: Settings): void {
  storage.setItem(KEY, JSON.stringify(settings));
}
