/**
 * Screen-space clustering for map markers, in two deterministic passes.
 *
 * 1. Greedy: points are taken in input order, and each joins the nearest existing cluster whose seed
 *    (the first point of that cluster) lies within `radius` pixels, or starts a new cluster. Seeds
 *    never move, so a uniform grid of cell size `radius` finds every candidate seed by looking at the
 *    3 x 3 block of cells around a point; the pass is O(n) for evenly spread points.
 * 2. Merge: a cluster is drawn at the centroid of its members, and centroids can end up closer than
 *    the seeds were. Clusters whose centroids are within `radius` are merged, nearest pair first in
 *    scan order, until none are. This is O(k^2) per merge in the number of clusters, which is small.
 *
 * After both passes no two clusters are closer than `radius`, so markers drawn with a radius of at
 * most `radius / 2` never overlap. The result depends only on input order and pairwise distances, so
 * panning the map (which shifts every point by the same amount) never changes the clusters.
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
  const seeds: { x: number; y: number; ids: string[]; sx: number; sy: number }[] = [];
  const grid = new Map<string, number[]>();
  const r2 = radius * radius;
  for (const p of points) {
    const cx = Math.floor(p.x / radius);
    const cy = Math.floor(p.y / radius);
    let best = -1;
    let bestD = Infinity;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const i of grid.get(`${gx},${gy}`) ?? []) {
          const d = (seeds[i].x - p.x) ** 2 + (seeds[i].y - p.y) ** 2;
          // Strict comparison keeps the earliest seed on a tie, so the result is stable.
          if (d <= r2 && d < bestD) {
            best = i;
            bestD = d;
          }
        }
      }
    }
    if (best >= 0) {
      const s = seeds[best];
      s.ids.push(p.id);
      s.sx += p.x;
      s.sy += p.y;
    } else {
      const key = `${cx},${cy}`;
      const cell = grid.get(key);
      if (cell) cell.push(seeds.length);
      else grid.set(key, [seeds.length]);
      seeds.push({ x: p.x, y: p.y, ids: [p.id], sx: p.x, sy: p.y });
    }
  }
  const clusters = seeds.map((s, order) => ({ ids: s.ids, sx: s.sx, sy: s.sy, order }));
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < clusters.length && !merged; i++) {
      const a = clusters[i];
      let best = -1;
      let bestD = r2;
      for (let j = i + 1; j < clusters.length; j++) {
        const b = clusters[j];
        const d = (a.sx / a.ids.length - b.sx / b.ids.length) ** 2 + (a.sy / a.ids.length - b.sy / b.ids.length) ** 2;
        if (d < bestD) {
          best = j;
          bestD = d;
        }
      }
      if (best >= 0) {
        const b = clusters[best];
        a.ids.push(...b.ids);
        a.sx += b.sx;
        a.sy += b.sy;
        clusters.splice(best, 1);
        merged = true;
      }
    }
  }
  return clusters.map((c) => ({ ids: c.ids, x: c.sx / c.ids.length, y: c.sy / c.ids.length }));
}
