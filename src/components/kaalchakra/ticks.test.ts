import { describe, expect, it } from 'vitest';
import { SEGMENTS, yearToUnit, zoomWindow, type UnitWindow } from '@/lib/time/scale';
import { edgeLabel, niceStep, ticksFor } from './ticks';

const WHOLE: UnitWindow = { start: 0, end: 1 };

function segWindow(id: string): UnitWindow {
  const seg = SEGMENTS.find((s) => s.id === id)!;
  return { start: yearToUnit(seg.from), end: yearToUnit(seg.to) };
}

function windows(): [string, UnitWindow][] {
  return [
    ['whole', WHOLE],
    ...SEGMENTS.map((s): [string, UnitWindow] => [s.id, segWindow(s.id)]),
    ['near 1950', zoomWindow(WHOLE, yearToUnit(1950), 0.01)],
    ['tight near 1950', zoomWindow(WHOLE, yearToUnit(1950), 0.002)],
    ['across 500 BCE', zoomWindow(WHOLE, yearToUnit(-499), 0.05)],
    ['across 10,000 BCE', zoomWindow(WHOLE, yearToUnit(-9999), 0.08)],
    ['deep zoom', zoomWindow(WHOLE, 0.12, 0.01)],
  ];
}

describe('niceStep', () => {
  it('returns the nearest 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(0.3)).toBeCloseTo(0.2);
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.3)).toBe(1);
    expect(niceStep(4)).toBe(5);
    expect(niceStep(8)).toBe(10);
    expect(niceStep(130)).toBe(100);
    expect(niceStep(160)).toBe(200);
  });
});

describe('ticksFor', () => {
  for (const width of [360, 900, 1400]) {
    for (const [name, win] of windows()) {
      it(`${name} at ${width}px: ordered, distinct, spaced and inside the canvas`, () => {
        const ticks = ticksFor(win, width);
        const labels = ticks.map((t) => t.label);
        expect(new Set(labels).size).toBe(labels.length);
        for (let i = 1; i < ticks.length; i++) {
          expect(ticks[i].year).toBeGreaterThan(ticks[i - 1].year);
          expect(ticks[i].px - ticks[i - 1].px).toBeGreaterThanOrEqual(60);
        }
        for (const t of ticks) {
          expect(t.px).toBeGreaterThanOrEqual(0);
          expect(t.px).toBeLessThanOrEqual(width);
          expect(t.label).not.toMatch(/^0(\.0+)? (ka|Ma|Ga)$/);
          expect(Number.isInteger(t.year)).toBe(true);
        }
      });
    }
  }

  it('has no "0 ka" and spans deep time to history on the whole axis', () => {
    const labels = ticksFor(WHOLE, 900).map((t) => t.label);
    expect(labels).not.toContain('0 ka');
    expect(labels.some((l) => / (Ma|Ga)$/.test(l))).toBe(true);
    expect(labels.some((l) => /BCE$/.test(l))).toBe(true);
    expect(labels.length).toBeGreaterThanOrEqual(5);
  });

  it('labels deep time with precision that matches the step', () => {
    for (const [, win] of windows()) {
      for (const t of ticksFor(win, 900)) {
        expect(t.label).not.toMatch(/\d\.\d{3,} (ka|Ma|Ga)$/);
      }
    }
    expect(ticksFor(segWindow('palaeolithic'), 900).map((t) => t.label)).not.toContain('1.01 Ma');
  });

  it('shows at least two ticks when zoomed near 1950', () => {
    const ticks = ticksFor(zoomWindow(WHOLE, yearToUnit(1950), 0.01), 900);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    for (const t of ticks) expect(t.label).toMatch(/^\d{4}$/);
  });

  it('shows round BCE labels in the classical era', () => {
    const labels = ticksFor(segWindow('classical'), 900).map((t) => t.label);
    const bce = labels.filter((l) => l.endsWith('BCE'));
    expect(bce.length).toBeGreaterThan(0);
    for (const l of bce) expect(Number(l.replace(/\D/g, '')) % 100).toBe(0);
  });

  it('never ticks the future', () => {
    for (const [, win] of windows()) for (const t of ticksFor(win, 1400)) expect(t.year).toBeLessThanOrEqual(2026);
  });
});

describe('edgeLabel', () => {
  it('caps the end of the axis at Today', () => {
    expect(edgeLabel(1)).toBe('Today');
    expect(edgeLabel(yearToUnit(2026))).toBe('Today');
    expect(edgeLabel(yearToUnit(-499))).toBe('500 BCE');
    expect(edgeLabel(0)).toMatch(/billion years ago$/);
  });
});
