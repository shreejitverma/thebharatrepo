/**
 * The relation graph: consistency checks for the validator and the per-entity view for entity pages.
 *
 * Relations are authored one way ("<this entity> <kind> <target>") and the site shows them from both
 * ends. Some kinds have a named inverse (ruled and ruled-by) and some are symmetric (contemporary-of),
 * so the same fact can be declared on one record, on the other, or on both. Everything here works on
 * a canonical form in which each fact has exactly one spelling, so that both declarations of one fact
 * collapse into one edge and two declarations that contradict each other are detected.
 */

import {
  ONE_WAY_RELATIONS,
  RELATION_INBOUND_LABELS,
  RELATION_INVERSE,
  RELATION_KINDS,
  RELATION_LABELS,
  SYMMETRIC_RELATIONS,
  type RelationKind,
} from './labels';

/** The parts of an entity the relation graph reads. */
export interface RelationSource {
  id: string;
  relations: readonly { kind: RelationKind; target: string; note?: string }[];
}

/** Of each inverse pair, the kind used as the canonical spelling. */
const CANONICAL_OF_PAIR: readonly RelationKind[] = ['authored', 'ruled', 'patronised', 'succeeded', 'founded', 'taught'];

function isSymmetric(kind: RelationKind): boolean {
  return SYMMETRIC_RELATIONS.includes(kind);
}

/**
 * One spelling per fact: inverse kinds are flipped onto their canonical partner ("B ruled-by A" becomes
 * "A ruled B") and symmetric kinds order their two ends by id.
 */
export function canonicalRelation(from: string, kind: RelationKind, to: string): { from: string; kind: RelationKind; to: string } {
  const inverse = RELATION_INVERSE[kind];
  if (inverse && !CANONICAL_OF_PAIR.includes(kind)) return { from: to, kind: inverse, to: from };
  if (isSymmetric(kind) && to < from) return { from: to, kind, to: from };
  return { from, kind, to };
}

function keyOf(r: { from: string; kind: RelationKind; to: string }): string {
  return `${r.kind}|${r.from}|${r.to}`;
}

export interface RelationWarning {
  /** The entity whose record should be looked at first. */
  id: string;
  message: string;
}

export interface RelationStats {
  /** Relations as authored, counting every declaration. */
  declared: number;
  /** Distinct facts after both declarations of one fact are merged. */
  facts: number;
  unknownTargets: number;
  selfRelations: number;
  duplicates: number;
  contradictions: number;
  /** Facts of a kind that has an inverse, by where they are declared. */
  inverse: { bothSides: number; oneSide: number };
  /** Facts of a symmetric kind, by where they are declared. */
  symmetric: { bothSides: number; oneSide: number };
  byKind: Partial<Record<RelationKind, number>>;
}

export interface RelationCheck {
  warnings: RelationWarning[];
  stats: RelationStats;
}

/**
 * Checks the whole graph. Unknown targets are counted here and reported as errors by the loader;
 * everything in `warnings` is advisory, because a one-sided or redundant declaration still renders
 * correctly and existing content must not stop building.
 */
export function checkRelations(entities: Iterable<RelationSource>): RelationCheck {
  const all = [...entities];
  const ids = new Set(all.map((e) => e.id));
  const warnings: RelationWarning[] = [];
  const stats: RelationStats = {
    declared: 0,
    facts: 0,
    unknownTargets: 0,
    selfRelations: 0,
    duplicates: 0,
    contradictions: 0,
    inverse: { bothSides: 0, oneSide: 0 },
    symmetric: { bothSides: 0, oneSide: 0 },
    byKind: {},
  };
  /** Canonical fact -> ids of the entities that declare it. */
  const facts = new Map<string, { from: string; kind: RelationKind; to: string; declaredBy: Set<string> }>();

  for (const e of all) {
    const seen = new Set<string>();
    for (const r of e.relations) {
      stats.declared++;
      stats.byKind[r.kind] = (stats.byKind[r.kind] ?? 0) + 1;
      if (!ids.has(r.target)) {
        stats.unknownTargets++;
        continue;
      }
      if (r.target === e.id) {
        stats.selfRelations++;
        warnings.push({ id: e.id, message: `relation ${r.kind} points at the entity itself` });
        continue;
      }
      const dup = `${r.kind}|${r.target}`;
      if (seen.has(dup)) {
        stats.duplicates++;
        warnings.push({ id: e.id, message: `relation ${r.kind} -> ${r.target} is declared twice` });
        continue;
      }
      seen.add(dup);
      const c = canonicalRelation(e.id, r.kind, r.target);
      const k = keyOf(c);
      const fact = facts.get(k);
      if (fact) fact.declaredBy.add(e.id);
      else facts.set(k, { ...c, declaredBy: new Set([e.id]) });
    }
  }

  stats.facts = facts.size;
  for (const f of facts.values()) {
    const both = f.declaredBy.size > 1;
    if (isSymmetric(f.kind)) stats.symmetric[both ? 'bothSides' : 'oneSide']++;
    else if (RELATION_INVERSE[f.kind]) stats.inverse[both ? 'bothSides' : 'oneSide']++;
    // A one-way fact and its mirror image cannot both hold. Report each clashing pair once.
    if (ONE_WAY_RELATIONS.includes(f.kind) && f.from < f.to) {
      const mirror = facts.get(keyOf({ from: f.to, kind: f.kind, to: f.from }));
      if (mirror) {
        stats.contradictions++;
        const inverse = RELATION_INVERSE[f.kind];
        const spelling = inverse ? `${f.kind} or ${inverse}` : f.kind;
        warnings.push({
          id: f.from,
          message: `relations contradict each other: ${f.from} and ${f.to} are each declared as "${RELATION_LABELS[f.kind]}" the other (check the ${spelling} relations on both records)`,
        });
      }
    }
  }
  return { warnings, stats };
}

export type RelationDirection = 'out' | 'in' | 'both';

export interface RelationEdge {
  /** The entity at the other end. */
  other: string;
  /** out: declared on this record; in: declared on the other record; both: declared on both. */
  direction: RelationDirection;
  note?: string;
}

export interface RelationGroup {
  /** Phrase read as "<this entity> <label> <other>". */
  label: string;
  edges: RelationEdge[];
}

/**
 * Every relation that touches one entity, from its own point of view, grouped by the phrase that
 * joins the two names. Outgoing and incoming declarations of the same fact become one edge.
 * `order` sorts the entities inside a group; the default is by id.
 */
export function relationGroups(entities: ReadonlyMap<string, RelationSource>, inbound: ReadonlyMap<string, readonly { from: string; kind: string }[]>, id: string, order: (a: string, b: string) => number = (a, b) => a.localeCompare(b)): RelationGroup[] {
  const self = entities.get(id);
  if (!self) return [];
  /** fact key -> edge, so the second declaration of a fact upgrades the first instead of adding a row. */
  const byFact = new Map<string, { label: string; rank: number; edge: RelationEdge }>();
  const rank = (label: string, kind: RelationKind) => {
    // Groups follow the order of RELATION_KINDS, with the vaguest kind last.
    const named = RELATION_KINDS.findIndex((k) => RELATION_LABELS[k] === label);
    return named >= 0 ? named : RELATION_KINDS.indexOf(kind) + 0.5;
  };

  for (const r of self.relations) {
    if (r.target === id || !entities.has(r.target)) continue;
    const k = keyOf(canonicalRelation(id, r.kind, r.target));
    if (byFact.has(k)) continue;
    const label = RELATION_LABELS[r.kind];
    byFact.set(k, { label, rank: rank(label, r.kind), edge: { other: r.target, direction: 'out', note: r.note } });
  }
  for (const r of inbound.get(id) ?? []) {
    const kind = r.kind as RelationKind;
    if (r.from === id || !entities.has(r.from)) continue;
    const k = keyOf(canonicalRelation(r.from, kind, id));
    const existing = byFact.get(k);
    if (existing) {
      if (existing.edge.direction === 'out') existing.edge.direction = 'both';
      continue;
    }
    const label = RELATION_INBOUND_LABELS[kind];
    const note = entities.get(r.from)?.relations.find((x) => x.kind === kind && x.target === id)?.note;
    byFact.set(k, { label, rank: rank(label, kind), edge: { other: r.from, direction: 'in', note } });
  }

  const groups = new Map<string, { rank: number; edges: RelationEdge[] }>();
  for (const { label, rank: rk, edge } of byFact.values()) {
    const g = groups.get(label);
    if (g) g.edges.push(edge);
    else groups.set(label, { rank: rk, edges: [edge] });
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([label, g]) => ({ label, edges: g.edges.sort((a, b) => order(a.other, b.other)) }));
}

export function countByDirection(groups: readonly RelationGroup[]): Record<RelationDirection, number> {
  const n = { out: 0, in: 0, both: 0 };
  for (const g of groups) for (const e of g.edges) n[e.direction]++;
  return n;
}
