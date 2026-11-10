import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings';

const memory = (initial: string | null = null) => {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, next: string) => void (value = next) };
};

describe('settings', () => {
  it('defaults to Normal text speed and round-trips a choice', () => {
    const storage = memory();
    expect(loadSettings(storage)).toEqual({ textSpeed: 'Normal' });
    saveSettings(storage, { textSpeed: 'Instant' });
    expect(loadSettings(storage)).toEqual({ textSpeed: 'Instant' });
  });

  it('ignores unknown or broken settings', () => {
    expect(loadSettings(memory('{"textSpeed":"Turbo"}'))).toEqual({ textSpeed: 'Normal' });
    expect(loadSettings(memory('{oops'))).toEqual({ textSpeed: 'Normal' });
  });
});
