/**
 * Kaalchakra time engine.
 *
 * Invariants:
 * - Every year is stored in astronomical year numbering: 1 CE = 1, 1 BCE = 0, 2 BCE = -1.
 * - Years may be fractional and may be very large in magnitude (deep time, cosmology).
 * - All calendar arithmetic in the codebase goes through this module.
 */

export const PRESENT_YEAR = 2026;

export type Precision =
  | 'day'
  | 'year'
  | 'decade'
  | 'century'
  | 'millennium'
  | 'ka'
  | 'Ma'
  | 'cosmological';

export type Era = 'CE' | 'BCE';

/** Convert a historical (era) year to astronomical numbering. There is no year 0 in BCE/CE. */
export function toAstronomical(year: number, era: Era): number {
  if (!Number.isFinite(year) || year <= 0) {
    throw new RangeError(`Historical years are positive; got ${year} ${era}`);
  }
  return era === 'CE' ? year : 1 - year;
}

/** Convert an astronomical year to a historical (era) year. */
export function fromAstronomical(astro: number): { year: number; era: Era } {
  if (!Number.isFinite(astro)) throw new RangeError(`Not a finite year: ${astro}`);
  return astro >= 1 ? { year: astro, era: 'CE' } : { year: 1 - astro, era: 'BCE' };
}

/** Years before the present reference year (PRESENT_YEAR). Positive for the past. */
export function yearsAgo(astro: number, present = PRESENT_YEAR): number {
  return present - astro;
}

const KA = 1_000;
const MA = 1_000_000;
const GA = 1_000_000_000;

function trimNumber(n: number, maxFractionDigits: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

/**
 * Format an astronomical year for display.
 * Deep time (older than 10,000 BCE, or precision ka/Ma) is shown as "years ago" because BCE
 * numbering is meaningless at that scale. Precision cosmological uses million or billion years ago
 * only for values at least 1 million years ago; more recent values (such as the Kali Yuga epoch)
 * fall through to ka or BCE/CE.
 */
export function formatYear(astro: number, precision: Precision = 'year', circa = false, extraDigits = 0): string {
  const ago = yearsAgo(astro);
  const c = circa ? 'c. ' : '';
  if ((precision === 'cosmological' && ago >= MA) || ago >= 100 * MA) {
    if (ago >= GA) return `${c}${trimNumber(ago / GA, 3 + extraDigits)} billion years ago`;
    return `${c}${trimNumber(ago / MA, 1 + extraDigits)} million years ago`;
  }
  if (precision === 'Ma' || ago >= MA) return `${c}${trimNumber(ago / MA, 2 + extraDigits)} Ma`;
  if (precision === 'ka' || ago >= 10 * KA + PRESENT_YEAR) return `${c}${trimNumber(ago / KA, 1 + extraDigits)} ka`;

  const { year, era } = fromAstronomical(Math.round(astro));
  switch (precision) {
    case 'millennium': {
      const m = Math.ceil(year / 1000);
      return `${c}${ordinal(m)} millennium ${era}`;
    }
    case 'century': {
      const cent = Math.ceil(year / 100);
      return `${c}${ordinal(cent)} century ${era}`;
    }
    case 'decade':
    case 'year':
    case 'day':
    default:
      return `${c}${year.toLocaleString('en-US', { useGrouping: year >= 10000 })} ${era}`;
  }
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export interface YearRange {
  earliest: number;
  latest: number;
  best?: number;
  precision: Precision;
  circa: boolean;
}

/** Format a range. A zero-width range is formatted as a point. */
export function formatRange(r: YearRange): string {
  if (r.earliest === r.latest) return formatYear(r.earliest, r.precision, r.circa);
  const a = fromAstronomical(Math.round(r.earliest));
  const b = fromAstronomical(Math.round(r.latest));
  const deep = yearsAgo(r.earliest) >= 10 * KA + PRESENT_YEAR || r.precision === 'ka' || r.precision === 'Ma';
  const c = r.circa ? 'c. ' : '';
  if (deep) {
    let from = formatYear(r.earliest, r.precision);
    let to = formatYear(r.latest, r.precision);
    for (let extra = 1; from === to && extra <= 9; extra++) {
      from = formatYear(r.earliest, r.precision, false, extra);
      to = formatYear(r.latest, r.precision, false, extra);
    }
    return `${c}${from} to ${to}`;
  }
  // Ordinal centuries read well only for a single century or millennium; wider ranges use round years.
  if ((r.precision === 'century' || r.precision === 'millennium') && formatYear(r.earliest, r.precision) === formatYear(r.latest, r.precision)) {
    return formatYear(r.earliest, r.precision, r.circa);
  }
  if (a.era === b.era) {
    return `${c}${a.year} to ${b.year} ${a.era}`;
  }
  return `${c}${a.year} ${a.era} to ${b.year} ${b.era}`;
}

/** Midpoint used for placement when no explicit best estimate is given. */
export function rangeAnchor(r: YearRange): number {
  return r.best ?? (r.earliest + r.latest) / 2;
}

/*
 * Indian era systems. These are year-level approximations: the regnal and civil year of each era
 * begins in spring (Chaitra) in most regional usage, so a Gregorian year straddles two era years.
 * We report the era year that begins in the given Gregorian year.
 */

/** Vikram Samvat year beginning in the given astronomical year (VS 1 began in 57 BCE). */
export function vikramSamvat(astro: number): number | null {
  const vs = astro + 57;
  return vs >= 1 ? vs : null;
}

/** Shaka Samvat year beginning in the given astronomical year (Shaka 1 began in 79 CE; Shaka 0 epoch 78 CE). */
export function shakaSamvat(astro: number): number | null {
  const s = astro - 78;
  return s >= 1 ? s : null;
}

/**
 * Kali Yuga year (current, 1-based) beginning in the given astronomical year.
 * Epoch: 18 February 3102 BCE (Julian), midnight at Ujjain, per Siddhantic reckoning
 * (Surya Siddhanta; Aryabhata, Aryabhatiya 3.10). 3102 BCE is astronomical -3101, which is Kali year 1.
 */
export function kaliYuga(astro: number): number | null {
  const k = astro + 3102;
  return k >= 1 ? k : null;
}

/** Traditional cosmological durations (Vishnu Purana 1.3; Surya Siddhanta 1.15-21). */
export const YUGA_YEARS = {
  kali: 432_000,
  dvapara: 864_000,
  treta: 1_296_000,
  satya: 1_728_000,
  mahayuga: 4_320_000,
  manvantara: 71 * 4_320_000,
  kalpa: 1000 * 4_320_000,
} as const;

export type CalendarSystem = 'ce' | 'vs' | 'shaka' | 'kali' | 'ago';

export function formatInCalendar(astro: number, system: CalendarSystem, precision: Precision = 'year', circa = false): string {
  const c = circa ? 'c. ' : '';
  switch (system) {
    case 'ce':
      return formatYear(astro, precision, circa);
    case 'ago': {
      const ago = Math.round(yearsAgo(astro));
      if (ago >= MA) return formatYear(astro, 'Ma', circa);
      if (ago >= 10 * KA) return formatYear(astro, 'ka', circa);
      return `${c}${ago.toLocaleString('en-US')} years ago`;
    }
    case 'vs': {
      const v = vikramSamvat(Math.round(astro));
      return v === null ? formatYear(astro, precision, circa) : `${c}VS ${v.toLocaleString('en-US')}`;
    }
    case 'shaka': {
      const s = shakaSamvat(Math.round(astro));
      return s === null ? formatYear(astro, precision, circa) : `${c}Shaka ${s.toLocaleString('en-US')}`;
    }
    case 'kali': {
      const k = kaliYuga(Math.round(astro));
      return k === null ? formatYear(astro, precision, circa) : `${c}Kali ${k.toLocaleString('en-US')}`;
    }
  }
}
