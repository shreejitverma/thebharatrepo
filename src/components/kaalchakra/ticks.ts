import { PRESENT_YEAR, formatYear } from '@/lib/time';
import { SEGMENTS, SEGMENT_STARTS, unitToYear, yearToUnit, type Segment, type UnitWindow } from '@/lib/time/scale';

export interface Tick {
  year: number;
  label: string;
  /** Horizontal position in pixels within a canvas of the given width. */
  px: number;
}

/** Target spacing between ticks, and the hard minimum between drawn labels. */
const TARGET_PX = 110;
const MIN_PX = 60;
/** Ticks this close to either edge are not drawn, since their labels would be clipped. */
const EDGE_PX = 20;
const CHAR_PX = 6.4;

/** The 1, 2, 5 x 10^k value nearest to x on a log scale. */
export function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
  const m = x / p;
  return (m < Math.SQRT2 ? 1 : m < Math.sqrt(10) ? 2 : m < Math.sqrt(50) ? 5 : 10) * p;
}

/** The next smaller 1, 2, 5 x 10^k value. */
function smallerStep(step: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
  const m = Math.round(step / p);
  return m === 1 ? p / 2 : m === 2 ? p : 2 * p;
}

function agoLabel(ago: number, step: number): string {
  const unit = ago >= 1e9 ? 1e9 : ago >= 1e6 ? 1e6 : 1e3;
  const suffix = unit === 1e9 ? 'Ga' : unit === 1e6 ? 'Ma' : 'ka';
  const decimals = Math.max(0, Math.ceil(-Math.log10(step / unit) - 1e-9));
  return `${(ago / unit).toFixed(decimals)} ${suffix}`;
}

/** Caption label for a window edge; anything at or past the present reads "Today". */
export function edgeLabel(u: number): string {
  const y = unitToYear(u);
  return y >= PRESENT_YEAR ? 'Today' : formatYear(y);
}

function calendarLabel(year: number): string {
  // Bare numbers for 1000 to 2999 CE read as plain years; everything else carries its era.
  return year >= 1000 && year < 3000 ? `${year}` : formatYear(year);
}

/** Years-ago ticks for a logarithmic segment between agoLo (newer) and agoHi (older). */
function logTicks(agoLo: number, agoHi: number, segPx: number): { year: number; label: string }[] {
  const out: { year: number; label: string }[] = [];
  const decades = Math.log10(agoHi / agoLo);
  if (decades < 1) {
    // Less than a decade visible: a linear step in years ago reads better than powers of ten.
    const step = niceStep((agoHi - agoLo) / Math.max(1, segPx / TARGET_PX));
    for (let ago = Math.ceil(agoLo / step) * step; ago <= agoHi; ago += step) out.push({ year: PRESENT_YEAR - ago, label: agoLabel(ago, step) });
    return out;
  }
  const perDecade = segPx / decades;
  const mantissas = perDecade < 150 ? [1] : perDecade < 400 ? [1, 2, 5] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let k = Math.floor(Math.log10(agoLo)); k <= Math.ceil(Math.log10(agoHi)); k++) {
    const p = Math.pow(10, k);
    for (const m of mantissas) {
      const ago = m * p;
      if (ago >= agoLo && ago <= agoHi) out.push({ year: PRESENT_YEAR - ago, label: agoLabel(ago, p) });
    }
  }
  return out;
}

/** Calendar-year ticks for a linear segment, rounded in historical numbering so labels read 500 BCE, not 499 BCE. */
function linearTicks(y0: number, y1: number, segPx: number): { year: number; label: string }[] {
  // A segment narrower than its step would get no tick at all, so step down until one fits.
  for (let step = Math.max(1, niceStep((y1 - y0) / Math.max(1, segPx / TARGET_PX))); ; step = smallerStep(step)) {
    const out = linearTicksWithStep(y0, y1, step);
    if (out.length || step <= 1) return out;
  }
}

function linearTicksWithStep(y0: number, y1: number, step: number): { year: number; label: string }[] {
  const out: { year: number; label: string }[] = [];
  // BCE side: astronomical year y is historical year 1 - y.
  if (y0 <= 0) {
    const hNew = 1 - Math.min(y1, 0);
    const hOld = 1 - y0;
    for (let h = Math.floor(hOld / step) * step; h >= Math.max(hNew, step); h -= step) out.push({ year: 1 - h, label: calendarLabel(1 - h) });
  }
  if (y1 >= 1) {
    const top = Math.min(y1, PRESENT_YEAR);
    for (let y = Math.max(step, Math.ceil(Math.max(y0, 1) / step) * step); y <= top; y += step) out.push({ year: y, label: calendarLabel(y) });
  }
  return out;
}

/**
 * Axis ticks for a River window. Each segment that intersects the window gets one nice step of its own:
 * years ago for the logarithmic deep-time segments and calendar years for the linear ones. Labels that
 * would crowd the previous one, including across scale breaks, are dropped.
 */
export function ticksFor(win: UnitWindow, width: number): Tick[] {
  const span = win.end - win.start;
  if (!(span > 0) || !(width > 0)) return [];
  const px = (u: number) => ((u - win.start) / span) * width;
  const candidates: Tick[] = [];
  SEGMENTS.forEach((seg: Segment, i) => {
    const a = Math.max(win.start, SEGMENT_STARTS[i]);
    const b = Math.min(win.end, SEGMENT_STARTS[i] + seg.share);
    if (b <= a) return;
    const segPx = px(b) - px(a);
    const y0 = Math.max(seg.from, unitToYear(a));
    const y1 = Math.min(seg.to, unitToYear(b));
    const raw =
      seg.interp === 'log'
        ? logTicks(Math.max(1, PRESENT_YEAR - y1), PRESENT_YEAR - y0, segPx)
        : linearTicks(y0, y1, segPx);
    for (const t of raw) {
      if (t.year < seg.from || t.year > seg.to) continue;
      candidates.push({ ...t, px: px(yearToUnit(t.year)) });
    }
  });
  candidates.sort((p, q) => p.px - q.px);
  const out: Tick[] = [];
  const seen = new Set<string>();
  for (const t of candidates) {
    if (t.px < EDGE_PX || t.px > width - EDGE_PX || seen.has(t.label)) continue;
    const prev = out[out.length - 1];
    if (prev && t.px - prev.px < Math.max(MIN_PX, ((prev.label.length + t.label.length) / 2) * CHAR_PX + 10)) continue;
    seen.add(t.label);
    out.push(t);
  }
  return out;
}
