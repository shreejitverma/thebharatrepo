/**
 * Name labels for one lane of the River view. Pure, so the layout rules are unit tested.
 *
 * Every label sits on the lane's label row, above the row its marks are drawn on, so a label never covers a mark,
 * whatever lies to its right; labels used to share the mark row with points, and covered the next marks along the
 * lane, which the halo could not hide. Along the row, labels never overlap each other or the lane title.
 */

/** Label text: 11.5 px, measured at about 6.6 px per character. */
export const LABEL_W_PER_CHAR = 6.6;
/** Minimum horizontal gap between labels in a lane, and between the lane title and the first label. */
export const LABEL_GAP = 8;
/** A mark narrower than this is drawn as a point. */
export const POINT_PX = 8;
/** Baseline of the label row, above the lane's centre line, where the marks are: clear of a selected point (r = 7). */
export const LABEL_BASELINE = -11;

export interface LaneMark {
  key: string;
  name: string;
  x0: number;
  x1: number;
  /** Traditional reckonings are not labelled in the lane; the tooltip and the panel name them. */
  trad: boolean;
}

export interface LaneLabel {
  key: string;
  x: number;
  width: number;
}

/**
 * Greedy, in time order: each mark is labelled if its name fits on the row after the previous label (or the lane
 * title) and inside the canvas. A point's label starts at the point; a range's starts at its left end, or slides
 * right along the bar, past the title or the previous label, while the bar still holds it.
 */
export function laneLabels(marks: readonly LaneMark[], titleEnd: number, width: number): LaneLabel[] {
  const out: LaneLabel[] = [];
  let end = titleEnd;
  for (const m of marks) {
    if (m.trad) continue;
    const w = m.name.length * LABEL_W_PER_CHAR;
    const isPoint = m.x1 - m.x0 < POINT_PX;
    let x = isPoint ? (m.x0 + m.x1) / 2 - 4 : Math.max(m.x0, 0) + 4;
    if (!isPoint && x < end + LABEL_GAP && m.x1 >= end + LABEL_GAP + w) x = end + LABEL_GAP;
    if (x < 4 || x < end + LABEL_GAP || x + w >= width - 4) continue;
    out.push({ key: m.key, x, width: w });
    end = x + w;
  }
  return out;
}
