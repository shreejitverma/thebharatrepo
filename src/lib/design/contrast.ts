/*
 * Colour maths for the design tokens: parse the token blocks of globals.css, resolve aliases, and measure
 * WCAG 2.2 contrast and colour-vision-deficiency separation. Pure functions, used by the palette unit test
 * and by scripts/palette-contrast.ts.
 */

export type Tokens = Record<string, string>;
export type Theme = 'light' | 'dark';

/** Custom properties declared directly inside one CSS block body. */
function declarations(body: string): Tokens {
  const out: Tokens = {};
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

/** Body of the first block whose selector text matches exactly, from its opening brace to the matching close. */
function blockBody(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no "${selector}" block`);
  let depth = 0;
  const open = css.indexOf('{', at);
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed "${selector}" block`);
}

/**
 * Light tokens are the first `:root` block; dark tokens are the light ones overridden by the
 * `:root[data-theme='dark']` block. The prefers-color-scheme copy is returned too, so a test can hold the two
 * dark definitions identical.
 */
export function parseThemes(css: string): { light: Tokens; dark: Tokens; darkMedia: Tokens } {
  const light = declarations(blockBody(css, ':root'));
  const dark = { ...light, ...declarations(blockBody(css, ":root[data-theme='dark']")) };
  const media = blockBody(css, '@media (prefers-color-scheme: dark)');
  const darkMedia = { ...light, ...declarations(blockBody(media, ":root:not([data-theme='light'])")) };
  return { light, dark, darkMedia };
}

/** A token's colour as #rrggbb, following var() aliases. Throws for anything that is not a plain colour. */
export function resolve(tokens: Tokens, name: string, seen: string[] = []): string {
  const v = tokens[name];
  if (v === undefined) throw new Error(`unknown token ${name}`);
  const alias = /^var\((--[a-z0-9-]+)\)$/i.exec(v);
  if (alias) {
    if (seen.includes(alias[1])) throw new Error(`alias loop at ${name}`);
    return resolve(tokens, alias[1], [...seen, name]);
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (!hex) throw new Error(`${name} is not a hex colour: ${v}`);
  const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
  return `#${h.toLowerCase()}`;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Machado, Oliveira and Fernandes (2009) simulation matrices at full severity, applied in linear RGB. */
const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

export type Vision = 'normal' | keyof typeof CVD;
export const VISIONS: Vision[] = ['normal', 'protan', 'deutan', 'tritan'];

/** CIE L*a*b* (D65) of a colour as seen with the given vision. */
export function lab(hex: string, vision: Vision = 'normal'): [number, number, number] {
  let rgb = channels(hex).map(toLinear);
  if (vision !== 'normal') {
    const m = CVD[vision];
    rgb = m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
  }
  const [r, g, b] = rgb;
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. */
export function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export interface Pair {
  fg: string;
  bg: string;
  min: number;
  use: string;
}

/**
 * Rows of the "Contrast pairs" table in docs/design/palette.md: | `--fg` | `--bg` | min | use |.
 * A `*` in a token name expands to every matching token, so one row can cover every kind on every era wash.
 */
export function documentedPairs(markdown: string, tokens: Tokens): Pair[] {
  const section = markdown.split(/^## /m).find((s) => s.startsWith('Contrast pairs'));
  if (!section) throw new Error('docs/design/palette.md has no "Contrast pairs" section');
  const expand = (pattern: string) => {
    if (!pattern.includes('*')) return [pattern];
    const re = new RegExp(`^${pattern.replace(/[-]/g, '\\-').replace('*', '[a-z0-9-]+')}$`);
    const names = Object.keys(tokens).filter((n) => re.test(n));
    if (!names.length) throw new Error(`no token matches ${pattern}`);
    return names;
  };
  const out: Pair[] = [];
  for (const line of section.split('\n')) {
    const m = /^\|\s*`(--[a-z0-9*-]+)`\s*\|\s*`(--[a-z0-9*-]+)`\s*\|\s*([\d.]+)\s*\|\s*(.+?)\s*\|$/i.exec(line.trim());
    if (!m) continue;
    for (const fg of expand(m[1])) for (const bg of expand(m[2])) out.push({ fg, bg, min: Number(m[3]), use: m[4] });
  }
  return out;
}

/** Token names documented in the token tables of docs/design/palette.md (first column, in backticks). */
export function documentedTokens(markdown: string): Set<string> {
  const names = new Set<string>();
  for (const m of markdown.matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|/gim)) names.add(m[1]);
  return names;
}
