import { describe, expect, it } from 'vitest';
import type { CalendarSystem, Precision, YearRange } from '@/lib/time';
import { formatDatingRange } from './shared';

const range = (earliest: number, latest: number, precision: Precision, circa = false): YearRange => ({ earliest, latest, precision, circa });
const CALENDARS: CalendarSystem[] = ['ce', 'ago', 'vs', 'shaka', 'kali'];

describe('formatDatingRange', () => {
  it('names a range inside one century once in every calendar, as formatRange does', () => {
    // 250 to 201 BCE predates both Vikram and Shaka Samvat, so those calendars print it in CE/BCE.
    expect(formatDatingRange(range(-249, -200, 'century', true), 'ce')).toBe('c. 3rd century BCE');
    expect(formatDatingRange(range(-249, -200, 'century', true), 'vs')).toBe('c. 3rd century BCE');
    expect(formatDatingRange(range(-249, -200, 'century', true), 'shaka')).toBe('c. 3rd century BCE');
    expect(formatDatingRange(range(-249, -200, 'year', true), 'vs')).toBe('c. 250 to 201 BCE');
  });

  it('keeps distinct era years as a range', () => {
    expect(formatDatingRange(range(1201, 1250, 'century'), 'vs')).toBe('VS 1,258 to VS 1,307');
    expect(formatDatingRange(range(1201, 1250, 'century'), 'shaka')).toBe('Shaka 1,123 to Shaka 1,172');
    expect(formatDatingRange(range(-249, -200, 'century', true), 'kali')).toBe('c. Kali 2,853 to Kali 2,902');
  });

  it('shows endpoints that print the same once', () => {
    // Both ends round to the same Kali Yuga year label once the era epoch is passed.
    expect(formatDatingRange(range(1500, 1500.4, 'year'), 'kali')).toBe('Kali 4,602');
  });

  it('never prints an "X to X" range in any calendar', () => {
    const samples = [range(-249, -200, 'century', true), range(-1999, -1000, 'millennium'), range(1201, 1250, 'century'), range(-11999, -11499, 'ka', true), range(1500, 1500.4, 'year')];
    for (const cal of CALENDARS) {
      for (const r of samples) {
        const label = formatDatingRange(r, cal);
        const m = /^(?:c\. )?(.+) to (.+)$/.exec(label);
        if (m) expect(m[1], `${cal}: ${label}`).not.toBe(m[2]);
      }
    }
  });
});
