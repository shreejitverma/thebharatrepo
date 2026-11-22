import { describe, expect, it } from 'vitest';
import {
  formatInCalendar,
  formatRange,
  formatYear,
  fromAstronomical,
  kaliYuga,
  ordinal,
  shakaSamvat,
  toAstronomical,
  vikramSamvat,
  YUGA_YEARS,
} from './index';
import { AXIS_END, AXIS_START, SEGMENTS, panWindow, segmentOf, unitToYear, yearToUnit, zoomWindow } from './scale';

describe('astronomical year numbering', () => {
  it('has no year zero in historical numbering', () => {
    expect(toAstronomical(1, 'CE')).toBe(1);
    expect(toAstronomical(1, 'BCE')).toBe(0);
    expect(toAstronomical(2, 'BCE')).toBe(-1);
    expect(toAstronomical(3102, 'BCE')).toBe(-3101);
  });

  it('round-trips across the BCE/CE boundary', () => {
    for (const astro of [-3101, -1, 0, 1, 2, 1947]) {
      const { year, era } = fromAstronomical(astro);
      expect(toAstronomical(year, era)).toBe(astro);
    }
  });

  it('rejects non-positive historical years', () => {
    expect(() => toAstronomical(0, 'CE')).toThrow(RangeError);
    expect(() => toAstronomical(-5, 'BCE')).toThrow(RangeError);
  });
});

describe('formatting', () => {
  it('formats historical years', () => {
    expect(formatYear(-267, 'year', true)).toBe('c. 268 BCE');
    expect(formatYear(499)).toBe('499 CE');
    expect(formatYear(0)).toBe('1 BCE');
  });

  it('formats centuries and millennia', () => {
    expect(formatYear(-250, 'century')).toBe('3rd century BCE');
    expect(formatYear(1001, 'millennium')).toBe('2nd millennium CE');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(22)).toBe('22nd');
  });

  it('formats deep time as years ago', () => {
    expect(formatYear(2026 - 385_000, 'ka')).toBe('385 ka');
    expect(formatYear(2026 - 1_500_000, 'Ma', true)).toBe('c. 1.5 Ma');
    expect(formatYear(2026 - 1_972_949_000, 'cosmological')).toBe('1.973 billion years ago');
  });

  it('formats ranges', () => {
    expect(formatRange({ earliest: -2599, latest: -1899, precision: 'year', circa: true })).toBe('c. 2600 to 1900 BCE');
    expect(formatRange({ earliest: -321, latest: -184, precision: 'year', circa: false })).toBe('322 to 185 BCE');
    expect(formatRange({ earliest: -49, latest: 50, precision: 'year', circa: true })).toBe('c. 50 BCE to 50 CE');
    expect(formatRange({ earliest: 320, latest: 320, precision: 'year', circa: false })).toBe('320 CE');
    expect(formatRange({ earliest: -6999, latest: -2599, precision: 'century', circa: true })).toBe('c. 7000 to 2600 BCE');
    expect(formatRange({ earliest: -299, latest: -200, precision: 'century', circa: true })).toBe('c. 3rd century BCE');
  });

  it('formats recent cosmological endpoints in BCE/CE or ka, not as fractions of a million years', () => {
    const kaliEpoch = toAstronomical(3102, 'BCE');
    expect(formatYear(kaliEpoch, 'cosmological')).toBe('3102 BCE');
    expect(formatRange({ earliest: kaliEpoch, latest: 2026, precision: 'cosmological', circa: false })).toBe('3102 BCE to 2026 CE');
    expect(formatRange({ earliest: 2026 - 870_000, latest: 2026 - 869_000, precision: 'cosmological', circa: true })).toBe('c. 870 ka to 869 ka');
    expect(formatRange({ earliest: 2026 - 1_972_949_000, latest: kaliEpoch, precision: 'cosmological', circa: false })).toBe('1.973 billion years ago to 3102 BCE');
    expect(formatRange({ earliest: 2026 - 1_449_000, latest: 2026 - 1_441_000, precision: 'cosmological', circa: false })).toBe('1.45 million years ago to 1.44 million years ago');
    expect(formatRange({ earliest: 2026 - 385_040, latest: 2026 - 385_010, precision: 'ka', circa: true })).toBe('c. 385.04 ka to 385.01 ka');
  });

  it('never renders a content dating as zero units or as an X to X range', async () => {
    const { loadContentUncached } = await import('../content/load');
    const graph = loadContentUncached();
    const ranges = [...[...graph.entities.values()].flatMap((e) => e.datings), ...graph.articles.flatMap((a) => a.datings ?? [])].map((d) => d.range);
    expect(ranges.length).toBeGreaterThan(0);
    for (const r of ranges) {
      const text = formatRange(r);
      expect(text, JSON.stringify(r)).not.toMatch(/(^|[^\d.])0 (million|billion|Ma|ka)\b/);
      if (r.earliest === r.latest) continue;
      expect(text, JSON.stringify(r)).not.toMatch(/^(?:c\. )?(.+) to \1$/);
      if (r.precision !== 'century' && r.precision !== 'millennium') expect(text, JSON.stringify(r)).toContain(' to ');
    }
  });
});

describe('Indian era systems', () => {
  it('computes Kali Yuga with epoch 3102 BCE as year 1', () => {
    expect(kaliYuga(-3101)).toBe(1);
    expect(kaliYuga(-3102)).toBeNull();
    // Aryabhata: 3600 years of Kali had elapsed when he was 23 (Aryabhatiya 3.10), i.e. 499 CE.
    expect(kaliYuga(499)! - 1).toBe(3600);
    expect(kaliYuga(2025)).toBe(5127);
  });

  it('computes Vikram and Shaka Samvat for the year beginning in spring', () => {
    expect(vikramSamvat(2025)).toBe(2082);
    expect(shakaSamvat(2025)).toBe(1947);
    expect(shakaSamvat(78)).toBeNull();
    // VS 1 began in 57 BCE (astronomical -56).
    expect(vikramSamvat(-56)).toBe(1);
    expect(vikramSamvat(-57)).toBeNull();
  });

  it('falls back to CE/BCE before an era epoch', () => {
    expect(formatInCalendar(-500, 'shaka')).toBe('501 BCE');
    expect(formatInCalendar(2025, 'kali')).toBe('Kali 5,127');
    expect(formatInCalendar(1000, 'ago')).toBe('1,026 years ago');
  });

  it('keeps the traditional yuga proportions 4:3:2:1', () => {
    expect(YUGA_YEARS.satya / YUGA_YEARS.kali).toBe(4);
    expect(YUGA_YEARS.treta / YUGA_YEARS.kali).toBe(3);
    expect(YUGA_YEARS.dvapara / YUGA_YEARS.kali).toBe(2);
    expect(YUGA_YEARS.satya + YUGA_YEARS.treta + YUGA_YEARS.dvapara + YUGA_YEARS.kali).toBe(YUGA_YEARS.mahayuga);
    expect(YUGA_YEARS.kalpa).toBe(4_320_000_000);
  });
});

describe('piecewise scale', () => {
  it('has shares summing to 1 and contiguous segments', () => {
    const total = SEGMENTS.reduce((s, x) => s + x.share, 0);
    expect(total).toBeCloseTo(1, 10);
    for (let i = 1; i < SEGMENTS.length; i++) expect(SEGMENTS[i].from).toBe(SEGMENTS[i - 1].to);
    expect(SEGMENTS[0].from).toBe(AXIS_START);
    expect(SEGMENTS[SEGMENTS.length - 1].to).toBe(AXIS_END);
  });

  it('is monotonic and continuous at segment boundaries', () => {
    let prev = -Infinity;
    const samples = [AXIS_START + 1, -2e9 + 5e8, -1e6, -100_000, -10_001, -10_000, -9_999, -3_300, -500, 0, 600, 1500, 1947, 2000, 2026];
    for (const y of samples) {
      const u = yearToUnit(y);
      expect(u).toBeGreaterThan(prev);
      prev = u;
    }
    for (const seg of SEGMENTS.slice(1)) {
      expect(yearToUnit(seg.from - 1e-6)).toBeCloseTo(yearToUnit(seg.from + 1e-6), 5);
    }
  });

  it('inverts', () => {
    for (const y of [-1.5e9, -1_500_000, -385_000, -7_000, -2_600, -268, 320, 1336, 1857, 1950, 2020]) {
      expect(unitToYear(yearToUnit(y))).toBeCloseTo(y, Math.abs(y) > 1e6 ? -3 : 3);
    }
  });

  it('clamps outside the axis', () => {
    expect(yearToUnit(-1e12)).toBe(0);
    expect(yearToUnit(1e6)).toBe(1);
    expect(segmentOf(-268).id).toBe('classical');
  });

  it('zooms around a focus point and pans within bounds', () => {
    const w = zoomWindow({ start: 0, end: 1 }, 0.5, 0.5);
    expect(w.end - w.start).toBeCloseTo(0.5);
    expect((w.start + w.end) / 2).toBeCloseTo(0.5);
    const p = panWindow(w, 10);
    expect(p.end).toBe(1);
    const z = zoomWindow({ start: 0, end: 1 }, 0, 1e-9);
    expect(z.end - z.start).toBeGreaterThan(0);
  });
});
