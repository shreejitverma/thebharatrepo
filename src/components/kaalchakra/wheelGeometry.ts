/*
 * Pure geometry of the Kaalchakra wheel, shared by the renderer (server and client) and the spin controller.
 * Angles are in radians, measured clockwise from 3 o'clock as in SVG; the wheel's rotation is added to every
 * angle that turns with it.
 */

export const VB = 1000;
export const C = VB / 2;
export const R_INNER = 150;
export const R_OUTER = 430;
/** Fraction of the circle left open at the top, where the end of time meets its beginning. */
export const GAP = 0.035;
/** The fixed indicator sits at 12 o'clock; a selection spins there. */
export const INDICATOR = -Math.PI / 2;

const TAU = 2 * Math.PI;

/** Angle of a scale unit (0 = start of the axis, 1 = its end) on the unrotated wheel. */
export function angleOf(u: number): number {
  const start = -Math.PI / 2 + GAP * Math.PI;
  return start + u * (TAU * (1 - GAP));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  const w = a - TAU * Math.floor((a + Math.PI) / TAU);
  return w === -Math.PI ? Math.PI : w;
}

/** The signed shortest turn from one angle to another, in (-PI, PI]. */
export function shortestDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Wheel rotation that brings a mark at the given unrotated angle to the indicator. */
export function rotationFor(markAngle: number): number {
  return wrapAngle(INDICATOR - markAngle);
}

/**
 * Index of the angle that sits closest to the indicator under the given rotation, or -1 for an empty list.
 * Ties go to the earlier entry so the result is deterministic.
 */
export function nearestToIndicator(angles: readonly number[], rotation: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < angles.length; i++) {
    const d = Math.abs(shortestDelta(angles[i] + rotation, INDICATOR));
    if (d < bestD - 1e-12) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** Index of the angle closest to a pointer angle on the rotated wheel, or -1. */
export function nearestToAngle(angles: readonly number[], rotation: number, pointerAngle: number): number {
  return nearestToIndicator(angles, rotation + (INDICATOR - pointerAngle));
}

/**
 * Spin duration in milliseconds for a turn of `delta` radians: 600 ms for a small step, rising to 900 ms
 * for half a turn or more, so a long journey reads as one deliberate motion and a step stays responsive.
 */
export function spinDuration(delta: number): number {
  const d = Math.min(Math.abs(delta), Math.PI);
  return 600 + 300 * (d / Math.PI);
}

/**
 * Cubic Hermite segment from p0 to p1 over duration T (ms), starting at velocity v0 (rad/ms) and ending at rest.
 * With v0 = 0 this is the smoothstep ease-in-out; with the velocity of an interrupted spin or a released drag
 * the motion continues without a jolt. Returns position and velocity at time t.
 */
export function hermite(p0: number, p1: number, v0: number, T: number, t: number): { p: number; v: number } {
  if (T <= 0 || t >= T) return { p: p1, v: 0 };
  if (t <= 0) return { p: p0, v: v0 };
  const s = t / T;
  const s2 = s * s;
  const s3 = s2 * s;
  const m0 = v0 * T;
  const p = (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1;
  const dp = (6 * s2 - 6 * s) * p0 + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * p1;
  return { p, v: dp / T };
}

/** Distance a released drag coasts before it snaps, for a velocity in rad/ms: an exponential decay with a 325 ms time constant. */
export function coastDistance(v: number): number {
  return v * 325;
}

/** Degrees in [0, 360). */
function deg360(a: number): number {
  const d = (a * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

/**
 * Orientation of a label set along the rim (tangential): it turns with the wheel, flips by 180 degrees
 * at the left and right so it is never upside down, and fades out near the flip while the wheel is moving
 * so the flip is never seen. `speed` is the wheel's angular speed in rad/ms.
 */
export function tangentLabel(angle: number, speed: number): { deg: number; opacity: number } {
  let deg = deg360(angle) + 90;
  if (deg >= 180 && deg < 360) deg -= 180;
  else if (deg >= 360) deg -= 360;
  // deg is now in [-90, 180); the flip happens at +/-90 (the label vertical at 3 and 9 o'clock).
  if (deg >= 90) deg -= 180;
  return { deg, opacity: flipFade(90 - Math.abs(deg), speed) };
}

/**
 * Orientation of a label running outward along a radial line: on the left half it is turned round and
 * anchored at its outer end so it still reads left to right. It fades near the vertical while moving.
 */
export function radialLabel(angle: number, speed: number): { deg: number; flipped: boolean; opacity: number } {
  const d = deg360(angle);
  const flipped = d > 90 && d < 270;
  const deg = flipped ? d - 180 : d > 180 ? d - 360 : d;
  return { deg, flipped, opacity: flipFade(90 - Math.abs(deg), speed) };
}

/** Opacity for a label `margin` degrees from its flip line, at a wheel speed in rad/ms; always 1 at rest. */
function flipFade(margin: number, speed: number): number {
  const near = Math.min(1, Math.max(0, margin / 14));
  const eased = near * near * (3 - 2 * near);
  const moving = Math.min(1, Math.abs(speed) / 0.0015);
  return 1 - (1 - eased) * moving;
}

export function polarXY(r: number, a: number): { x: number; y: number } {
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}
