/**
 * Language tags for names in native script and in romanisation. Client-safe (no zod).
 *
 * `names.native` is tagged by its script: Devanagari is Sanskrit ("sa-Deva") for entities placed
 * before 1200 CE and Hindi ("hi") after, Tamil is "ta", Perso-Arabic is "fa" or "ar", and so on.
 * An entity can override the default with `names.nativeLang`.
 * `names.iast` is tagged as the romanisation of that language: "sa-Latn", "ta-Latn", "hi-Latn".
 */

export type ScriptCode = 'Deva' | 'Beng' | 'Guru' | 'Gujr' | 'Orya' | 'Taml' | 'Telu' | 'Knda' | 'Mlym' | 'Sinh' | 'Tibt' | 'Arab' | 'Hani' | 'Grek';

const RANGES: [number, number, ScriptCode][] = [
  [0x0370, 0x03ff, 'Grek'],
  [0x1f00, 0x1fff, 'Grek'],
  [0x0600, 0x06ff, 'Arab'],
  [0x0750, 0x077f, 'Arab'],
  [0xfb50, 0xfdff, 'Arab'],
  [0xfe70, 0xfeff, 'Arab'],
  [0x0900, 0x097f, 'Deva'],
  [0xa8e0, 0xa8ff, 'Deva'],
  [0x0980, 0x09ff, 'Beng'],
  [0x0a00, 0x0a7f, 'Guru'],
  [0x0a80, 0x0aff, 'Gujr'],
  [0x0b00, 0x0b7f, 'Orya'],
  [0x0b80, 0x0bff, 'Taml'],
  [0x0c00, 0x0c7f, 'Telu'],
  [0x0c80, 0x0cff, 'Knda'],
  [0x0d00, 0x0d7f, 'Mlym'],
  [0x0d80, 0x0dff, 'Sinh'],
  [0x0f00, 0x0fff, 'Tibt'],
  [0x3400, 0x9fff, 'Hani'],
];

const DEFAULT_LANG: Record<ScriptCode, string> = {
  Deva: 'sa-Deva',
  Beng: 'bn',
  Guru: 'pa',
  Gujr: 'gu',
  Orya: 'or',
  Taml: 'ta',
  Telu: 'te',
  Knda: 'kn',
  Mlym: 'ml',
  Sinh: 'si',
  Tibt: 'bo',
  Arab: 'ar',
  Hani: 'zh',
  Grek: 'grc',
};

/** Letters used in Persian and Urdu but not in Arabic: pe, che, zhe, gaf, keheh, Farsi yeh. */
const PERSIAN_LETTERS = /[پچژکگی]/;

/** The dominant script of a string, by count of letters in each known block; null for Latin or unknown. */
export function detectScript(text: string): ScriptCode | null {
  const counts = new Map<ScriptCode, number>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const hit = RANGES.find(([lo, hi]) => cp >= lo && cp <= hi);
    if (hit) counts.set(hit[2], (counts.get(hit[2]) ?? 0) + 1);
  }
  let best: ScriptCode | null = null;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

/** Year (astronomical) from which a Devanagari name is tagged as Hindi rather than Sanskrit. */
export const DEVANAGARI_HINDI_FROM = 1200;

/**
 * BCP 47 tag for a native-script name.
 * @param anchorYear the entity's placement in time, used only to choose between Sanskrit and Hindi for Devanagari.
 */
export function nativeLang(native: string, opts: { override?: string; anchorYear?: number | null } = {}): string {
  if (opts.override) return opts.override;
  const script = detectScript(native);
  if (!script) return 'und';
  if (script === 'Arab') return PERSIAN_LETTERS.test(native) ? 'fa' : 'ar';
  if (script === 'Deva' && opts.anchorYear != null && opts.anchorYear >= DEVANAGARI_HINDI_FROM) return 'hi';
  return DEFAULT_LANG[script];
}

/** BCP 47 tag for a romanised (IAST or ISO 15919) name: the native language with the Latin script subtag. */
export function romanisedLang(nativeTag?: string): string {
  const base = nativeTag?.split('-')[0];
  if (!base || base === 'und') return 'sa-Latn';
  return `${base}-Latn`;
}
