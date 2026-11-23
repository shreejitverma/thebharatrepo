import { describe, expect, it } from 'vitest';
import { Spinner, type FrameClock } from './spin';
import { INDICATOR, angleOf, hermite, nearestToAngle, nearestToIndicator, radialLabel, rotationFor, shortestDelta, spinDuration, tangentLabel, wrapAngle } from './wheelGeometry';

/** A manual frame clock: advance() runs the pending frame at a later time. */
function fakeClock() {
  let t = 0;
  let pending: ((t: number) => void) | null = null;
  let id = 0;
  const clock: FrameClock = {
    now: () => t,
    request: (cb) => {
      pending = cb;
      return ++id;
    },
    cancel: () => {
      pending = null;
    },
  };
  return {
    clock,
    advance(ms: number) {
      t += ms;
      const cb = pending;
      pending = null;
      cb?.(t);
    },
    get pending() {
      return pending !== null;
    },
  };
}

describe('wheel geometry', () => {
  it('wraps angles and takes the shortest way round', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(shortestDelta(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(shortestDelta(-3, 3)).toBeCloseTo(6 - 2 * Math.PI);
  });

  it('brings any mark to the indicator at the top', () => {
    for (const u of [0, 0.1, 0.5, 0.77, 1]) {
      const a = angleOf(u);
      expect(wrapAngle(a + rotationFor(a) - INDICATOR)).toBeCloseTo(0);
    }
  });

  it('finds the mark nearest the indicator and nearest a tap', () => {
    const angles = [angleOf(0.1), angleOf(0.4), angleOf(0.7)];
    expect(nearestToIndicator(angles, rotationFor(angles[1]) + 0.05)).toBe(1);
    expect(nearestToIndicator([], 0)).toBe(-1);
    expect(nearestToAngle(angles, 0, angles[2] + 0.01)).toBe(2);
  });

  it('scales spin duration with distance between 600 and 900 ms', () => {
    expect(spinDuration(0.01)).toBeCloseTo(601, 0);
    expect(spinDuration(Math.PI / 2)).toBe(750);
    expect(spinDuration(-Math.PI)).toBe(900);
    expect(spinDuration(10)).toBe(900);
  });

  it('eases in and out from rest and keeps a start velocity', () => {
    expect(hermite(0, 1, 0, 800, 0)).toEqual({ p: 0, v: 0 });
    expect(hermite(0, 1, 0, 800, 400).p).toBeCloseTo(0.5);
    expect(hermite(0, 1, 0, 800, 800)).toEqual({ p: 1, v: 0 });
    expect(hermite(0, 1, 0.004, 800, 1).v).toBeCloseTo(0.004, 3);
    // Motion is monotonic from rest: never past the target, never backwards.
    let prev = 0;
    for (let t = 0; t <= 800; t += 16) {
      const { p } = hermite(0, 1, 0, 800, t);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(p).toBeLessThanOrEqual(1 + 1e-12);
      prev = p;
    }
  });

  it('keeps rim labels upright and fades them only through the flip while moving', () => {
    for (let a = -Math.PI; a < Math.PI; a += 0.05) {
      const { deg } = tangentLabel(a, 0);
      expect(deg).toBeGreaterThanOrEqual(-90);
      expect(deg).toBeLessThan(90);
      expect(tangentLabel(a, 0).opacity).toBe(1);
    }
    expect(tangentLabel(-Math.PI / 2, 0).deg).toBeCloseTo(0);
    expect(tangentLabel(Math.PI / 2, 0).deg).toBeCloseTo(0);
    expect(tangentLabel(0, 0.003).opacity).toBeCloseTo(0);
    expect(tangentLabel(-Math.PI / 2, 0.003).opacity).toBe(1);
  });

  it('turns radial labels round on the left half', () => {
    expect(radialLabel(0, 0)).toMatchObject({ deg: 0, flipped: false });
    expect(radialLabel(Math.PI, 0)).toMatchObject({ flipped: true });
    expect(radialLabel(Math.PI, 0).deg).toBeCloseTo(0);
    expect(Math.abs(radialLabel(-Math.PI / 2 + 0.01, 0).deg)).toBeLessThanOrEqual(90);
  });
});

describe('Spinner', () => {
  function setup(initial = 0) {
    const f = fakeClock();
    const applied: number[] = [];
    let settled = 0;
    const s = new Spinner(initial, (a) => applied.push(a), () => settled++, f.clock);
    return { f, s, applied, settled: () => settled };
  }

  it('animates to the target over the distance-scaled duration and settles once', () => {
    const { f, s, applied, settled } = setup();
    s.spinTo(Math.PI / 2);
    expect(s.moving).toBe(true);
    let frames = 0;
    while (f.pending) {
      f.advance(16);
      frames++;
    }
    expect(frames).toBe(Math.ceil(750 / 16));
    expect(applied.at(-1)).toBe(Math.PI / 2);
    expect(settled()).toBe(1);
    expect(s.moving).toBe(false);
  });

  it('jumps without frames when asked to be instant', () => {
    const { f, s, applied, settled } = setup();
    s.spinTo(2, { instant: true });
    expect(f.pending).toBe(false);
    expect(applied).toEqual([2]);
    expect(settled()).toBe(1);
  });

  it('replaces a spin mid-flight from the current angle and velocity, settling only the last', () => {
    const { f, s, applied, settled } = setup();
    s.spinTo(3);
    for (let i = 0; i < 20; i++) f.advance(16);
    const mid = s.current;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(3);
    s.spinTo(-1);
    f.advance(16);
    // The first frame of the new spin continues forward: the old velocity carries on.
    expect(applied.at(-1)!).toBeGreaterThan(mid);
    while (f.pending) f.advance(16);
    expect(s.current).toBe(-1);
    expect(settled()).toBe(1);
  });

  it('measures drag velocity and drops it when the pointer rested before release', () => {
    const { f, s } = setup();
    for (let i = 1; i <= 5; i++) {
      f.advance(16);
      s.drag(i * 0.032);
    }
    f.advance(10);
    expect(s.release()).toBeCloseTo(0.002, 4);
    s.drag(1);
    f.advance(200);
    expect(s.release()).toBe(0);
  });
});
