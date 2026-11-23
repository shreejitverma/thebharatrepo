import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VISIONS, contrast, deltaE, documentedPairs, documentedTokens, lab, parseThemes, resolve, type Theme } from './contrast';

const ROOT = path.resolve(__dirname, '../../..');
const css = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
const doc = fs.readFileSync(path.join(ROOT, 'docs/design/palette.md'), 'utf8');
const themes = parseThemes(css);
const THEMES: Theme[] = ['light', 'dark'];
const isColour = (v: string) => /^(#|var\(--)/.test(v) && !/,/.test(v);
const colourTokens = Object.keys(themes.light).filter((k) => isColour(themes.light[k]));

describe('palette', () => {
  it('defines dark mode identically for prefers-color-scheme and data-theme', () => {
    expect(themes.darkMedia).toEqual(themes.dark);
  });

  it('documents every colour token, with the values in globals.css', () => {
    const documented = documentedTokens(doc);
    for (const t of colourTokens) expect(documented, `${t} is missing from docs/design/palette.md`).toContain(t);
    for (const m of doc.matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gim)) {
      expect(resolve(themes.light, m[1]), `${m[1]} light`).toBe(m[2].toLowerCase());
      expect(resolve(themes.dark, m[1]), `${m[1]} dark`).toBe(m[3].toLowerCase());
    }
  });

  it('prints grades and lenses in the light palette', () => {
    const print = fs.readFileSync(path.join(ROOT, 'src/styles/print.css'), 'utf8');
    const printed = [...print.matchAll(/(--(?:grade|lens)-[a-z]+):\s*(#[0-9a-f]{6});/g)];
    expect(printed.map((m) => m[1]).sort()).toEqual(colourTokens.filter((t) => /^--(grade|lens)-/.test(t)).sort());
    for (const [, token, value] of printed) expect(value, `${token} in print.css`).toBe(resolve(themes.light, token));
  });

  const pairs = documentedPairs(doc, themes.light);
  it('documents the contrast pairs', () => {
    expect(pairs.length).toBeGreaterThan(100);
  });

  for (const theme of THEMES) {
    it(`meets WCAG 2.2 AA for every documented pair in ${theme}`, () => {
      const failures = pairs
        .map((p) => ({ ...p, ratio: contrast(resolve(themes[theme], p.fg), resolve(themes[theme], p.bg)) }))
        .filter((p) => p.ratio < p.min)
        .map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min} (${p.use})`);
      expect(failures).toEqual([]);
    });

    it(`keeps the five grades apart under every colour vision in ${theme}`, () => {
      const grades = ['a', 'b', 'c', 'd', 'e'].map((g) => resolve(themes[theme], `--grade-${g}`));
      for (const v of VISIONS) {
        const labs = grades.map((g) => lab(g, v));
        for (let i = 0; i < labs.length; i++) {
          for (let j = i + 1; j < labs.length; j++) {
            expect(deltaE(labs[i], labs[j]), `${theme} ${v}: grade ${'ABCDE'[i]} vs ${'ABCDE'[j]}`).toBeGreaterThanOrEqual(10);
          }
        }
      }
    });

    it(`keeps the two lenses apart under every colour vision in ${theme}`, () => {
      for (const v of VISIONS) {
        const d = deltaE(lab(resolve(themes[theme], '--lens-scholarship'), v), lab(resolve(themes[theme], '--lens-tradition'), v));
        expect(d, `${theme} ${v}`).toBeGreaterThanOrEqual(20);
      }
    });
  }
});

describe('contrast maths', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
  });

  it('follows aliases and rejects what it cannot measure', () => {
    expect(resolve({ '--a': 'var(--b)', '--b': '#ABC' }, '--a')).toBe('#aabbcc');
    expect(() => resolve({ '--a': 'var(--a)' }, '--a')).toThrow();
    expect(() => resolve({ '--a': 'rgb(0 0 0)' }, '--a')).toThrow();
  });
});
