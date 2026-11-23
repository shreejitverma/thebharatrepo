/**
 * Screen-space clustering for map markers, in two deterministic passes.
 *
 * 1. Greedy: points are taken in input order, and each joins the nearest existing cluster whose seed
 *    (the first point of that cluster) lies within `radius` pixels, or starts a new cluster. Of two
 *    seeds at the same distance the earlier one (in input order) wins. Seeds never move, so a uniform
 *    grid of cell size `radius` finds every candidate seed by looking at the 3 x 3 block of cells
 *    around a point; the pass is O(n) for evenly spread points.
 * 2. Merge: a cluster is drawn at the centroid of its members, and centroids can end up closer than
 *    the seeds were. Clusters are kept in seed order. The first cluster that has another within
 *    `radius` absorbs its nearest one (the earlier on a tie), and the scan starts again, until no two
 *    are within `radius`. This is O(k^2) per merge in the number of clusters, which is small.
 *
 * After both passes no two clusters are closer than `radius`, so markers drawn with a radius of at
 * most `radius / 2` never overlap. Every choice and tie-break depends only on input order and pairwise
 * distances, never on grid cells or coordinates, so panning the map (which shifts every point by the
 * same amount) never changes the clusters, and each cluster lists its members in input order.
 */

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

export interface Cluster {
  /** Member ids in input order. */
  ids: string[];
  /** Centroid of the members, in pixels. */
  x: number;
  y: number;
}

export function clusterPoints(points: readonly ScreenPoint[], radius: number): Cluster[] {
  if (!(radius > 0)) return points.map((p) => ({ ids: [p.id], x: p.x, y: p.y }));
  /** Members are held as input indices, so merged clusters can be put back in input order. */
  const seeds: { x: number; y: number; members: number[]; sx: number; sy: number }[] = [];
  const grid = new Map<string, number[]>();
  const r2 = radius * radius;
  points.forEach((p, n) => {
    const cx = Math.floor(p.x / radius);
    const cy = Math.floor(p.y / radius);
    let best = -1;
    let bestD = Infinity;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const i of grid.get(`${gx},${gy}`) ?? []) {
          const d = (seeds[i].x - p.x) ** 2 + (seeds[i].y - p.y) ** 2;
          // Cells are scanned in grid order, which a pan can change, so a tie goes to the earlier seed explicitly.
          if (d <= r2 && (d < bestD || (d === bestD && i < best))) {
            best = i;
            bestD = d;
          }
        }
      }
    }
    if (best >= 0) {
      const s = seeds[best];
      s.members.push(n);
      s.sx += p.x;
      s.sy += p.y;
    } else {
      const key = `${cx},${cy}`;
      const cell = grid.get(key);
      if (cell) cell.push(seeds.length);
      else grid.set(key, [seeds.length]);
      seeds.push({ x: p.x, y: p.y, members: [n], sx: p.x, sy: p.y });
    }
  });
  const clusters = seeds.map((s) => ({ members: s.members, sx: s.sx, sy: s.sy }));
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < clusters.length && !merged; i++) {
      const a = clusters[i];
      let best = -1;
      let bestD = r2;
      for (let j = i + 1; j < clusters.length; j++) {
        const b = clusters[j];
        const d = (a.sx / a.members.length - b.sx / b.members.length) ** 2 + (a.sy / a.members.length - b.sy / b.members.length) ** 2;
        // Strict, so of two clusters at the same distance the earlier (lower j) is merged.
        if (d < bestD) {
          best = j;
          bestD = d;
        }
      }
      if (best >= 0) {
        const b = clusters[best];
        // Both lists are in input order; merging them keeps the cluster in input (time) order.
        a.members = mergeSorted(a.members, b.members);
        a.sx += b.sx;
        a.sy += b.sy;
        clusters.splice(best, 1);
        merged = true;
      }
    }
  }
  return clusters.map((c) => ({ ids: c.members.map((n) => points[n].id), x: c.sx / c.members.length, y: c.sy / c.members.length }));
}

/** Two ascending lists of distinct indices as one ascending list. */
function mergeSorted(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) out.push(j >= b.length || (i < a.length && a[i] < b[j]) ? a[i++] : b[j++]);
  return out;
}
