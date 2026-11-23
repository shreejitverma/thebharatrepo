import { describe, expect, it } from 'vitest';
import { LABEL_BASELINE, LABEL_GAP, LABEL_W_PER_CHAR, laneLabels, type LaneMark } from './riverLabels';

const mark = (key: string, x0: number, x1 = x0, name = key, trad = false): LaneMark => ({ key, name, x0, x1, trad });

describe('laneLabels', () => {
  it('sits on a row above the marks, clear of a selected point', () => {
    // The label's descenders reach about 3 px below its baseline; a selected point has a 7 px radius.
    expect(LABEL_BASELINE + 3).toBeLessThan(-7);
  });

  it('never overlaps another label in the lane, or the lane title', () => {
    const marks = Array.from({ length: 80 }, (_, i) => mark(`m${i}`, 20 + i * 11, 20 + i * 11 + (i % 3 === 0 ? 60 : 0), `Entry name ${i}`));
    const out = laneLabels(marks, 70, 900);
    expect(out.length).toBeGreaterThan(3);
    expect(out[0].x).toBeGreaterThanOrEqual(70 + LABEL_GAP);
    for (let i = 1; i < out.length; i++) expect(out[i].x).toBeGreaterThanOrEqual(out[i - 1].x + out[i - 1].width + LABEL_GAP);
    for (const l of out) expect(l.x + l.width).toBeLessThan(900 - 4);
  });

  it('starts a point label at its point, and slides a range label along its bar past the title', () => {
    const [point] = laneLabels([mark('p', 300)], 50, 900);
    expect(point.x).toBe(296);
    const [range] = laneLabels([mark('r', 10, 400, 'Range')], 50, 900);
    expect(range.x).toBe(50 + LABEL_GAP);
    expect(range.width).toBe(5 * LABEL_W_PER_CHAR);
  });

  it('leaves traditional reckonings and names that do not fit unlabelled', () => {
    expect(laneLabels([mark('t', 300, 300, 'Tradition', true)], 0, 900)).toEqual([]);
    expect(laneLabels([mark('edge', 880, 880, 'A long name')], 0, 900)).toEqual([]);
    expect(laneLabels([mark('a', 100, 100, 'Alpha'), mark('b', 110, 110, 'Beta')], 0, 900).map((l) => l.key)).toEqual(['a']);
  });
});
