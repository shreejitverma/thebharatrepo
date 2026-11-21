/**
 * Honest piecewise time scale for the Kaalchakra.
 *
 * Deep time and recent history differ by seven orders of magnitude, so no single linear scale works.
 * Instead the axis is split into named segments, each with a fixed share of the axis and its own
 * interpolation (linear or logarithmic in years-before-present). Segment boundaries are drawn as
 * visible scale breaks so the reader always knows that distance means different things in each segment.
 */

import { PRESENT_YEAR } from './index';

export type Interp = 'linear' | 'log';

export interface Segment {
  id: string;
  label: string;
  /** Astronomical year where the segment starts (older end). */
  from: number;
  /** Astronomical year where the segment ends (newer end). */
  to: number;
  /** Share of the full axis, all shares sum to 1. */
  share: number;
  interp: Interp;
}

/** The oldest year on the axis: the traditional start of the present kalpa is ~1.97 billion years ago. */
export const AXIS_START = PRESENT_YEAR - 2_000_000_000;
/** The axis ends slightly after the present so "today" is not drawn on the very edge. */
export const AXIS_END = PRESENT_YEAR + 24;

/** Boundaries are exact round historical years: -9999 = 10,000 BCE, -3299 = 3300 BCE, -499 = 500 BCE. */
export const SEGMENTS: readonly Segment[] = [
  { id: 'cosmic', label: 'Cosmic and geological time', from: AXIS_START, to: PRESENT_YEAR - 3_000_000, share: 0.07, interp: 'log' },
  { id: 'palaeolithic', label: 'Palaeolithic', from: PRESENT_YEAR - 3_000_000, to: -9_999, share: 0.1, interp: 'log' },
  { id: 'neolithic', label: 'Mesolithic to Chalcolithic', from: -9_999, to: -3_299, share: 0.1, interp: 'linear' },
  { id: 'harappan-vedic', label: 'Harappan and Vedic', from: -3_299, to: -499, share: 0.18, interp: 'linear' },
  { id: 'classical', label: 'Mahajanapadas to Guptas', from: -499, to: 600, share: 0.17, interp: 'linear' },
  { id: 'medieval', label: 'Early medieval and medieval', from: 600, to: 1_500, share: 0.13, interp: 'linear' },
  { id: 'early-modern', label: 'Early modern and colonial', from: 1_500, to: 1_947, share: 0.13, interp: 'linear' },
  { id: 'republic', label: 'Republic of India', from: 1_947, to: AXIS_END, share: 0.12, interp: 'linear' },
] as const;

/** Unit position where each segment starts, aligned with SEGMENTS. */
export const SEGMENT_STARTS: readonly number[] = SEGMENTS.reduce<number[]>((acc, seg, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SEGMENTS[i - 1].share);
  return acc;
}, []);

function ybp(year: number): number {
  // Years before the axis end; always >= 0 inside the axis. +1 keeps log finite at the end.
  return AXIS_END - year + 1;
}

function segmentFraction(seg: Segment, year: number): number {
  if (seg.interp === 'linear') return (year - seg.from) / (seg.to - seg.from);
  const a = Math.log(ybp(seg.from));
  const b = Math.log(ybp(seg.to));
  return (a - Math.log(ybp(year))) / (a - b);
}

/** Map an astronomical year to [0, 1] along the axis. Values outside the axis are clamped. */
export function yearToUnit(year: number): number {
  if (!Number.isFinite(year)) return Number.NaN;
  if (year <= AXIS_START) return 0;
  if (year >= AXIS_END) return 1;
  let acc = 0;
  for (const seg of SEGMENTS) {
    if (year <= seg.to) {
      return acc + seg.share * segmentFraction(seg, year);
    }
    acc += seg.share;
  }
  return 1;
}

/** Inverse of yearToUnit. */
export function unitToYear(u: number): number {
  if (u <= 0) return AXIS_START;
  if (u >= 1) return AXIS_END;
  let acc = 0;
  for (const seg of SEGMENTS) {
    if (u <= acc + seg.share) {
      const f = (u - acc) / seg.share;
      if (seg.interp === 'linear') return seg.from + f * (seg.to - seg.from);
      const a = Math.log(ybp(seg.from));
      const b = Math.log(ybp(seg.to));
      return AXIS_END + 1 - Math.exp(a - f * (a - b));
    }
    acc += seg.share;
  }
  return AXIS_END;
}

/** Unit position of each segment boundary (excluding 0 and 1). */
export function segmentBoundaries(): { unit: number; year: number; segment: Segment }[] {
  const out: { unit: number; year: number; segment: Segment }[] = [];
  let acc = 0;
  for (const seg of SEGMENTS) {
    out.push({ unit: acc, year: seg.from, segment: seg });
    acc += seg.share;
  }
  return out;
}

/** Find the segment containing a year. */
export function segmentOf(year: number): Segment {
  for (const seg of SEGMENTS) if (year <= seg.to) return seg;
  return SEGMENTS[SEGMENTS.length - 1];
}

/**
 * Linear zoomable view over the unit axis, used by the River view.
 * `start` and `end` are unit positions; the visible window is [start, end].
 */
export interface UnitWindow {
  start: number;
  end: number;
}

export const MIN_WINDOW = 0.0005;

export function zoomWindow(w: UnitWindow, focusUnit: number, factor: number): UnitWindow {
  const width = Math.min(1, Math.max(MIN_WINDOW, (w.end - w.start) * factor));
  const t = (focusUnit - w.start) / (w.end - w.start);
  let start = focusUnit - t * width;
  start = Math.min(Math.max(0, start), 1 - width);
  return { start, end: start + width };
}

export function panWindow(w: UnitWindow, deltaUnit: number): UnitWindow {
  const width = w.end - w.start;
  const start = Math.min(Math.max(0, w.start + deltaUnit), 1 - width);
  return { start, end: start + width };
}
