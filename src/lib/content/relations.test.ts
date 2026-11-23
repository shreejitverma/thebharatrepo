import { describe, expect, it } from 'vitest';
import { canonicalRelation, checkRelations, countByDirection, relationGroups, type RelationSource } from './relations';
import { RELATION_INBOUND_LABELS, RELATION_INVERSE, RELATION_KINDS, RELATION_LABELS, SYMMETRIC_RELATIONS, type RelationKind } from './labels';

function ent(id: string, ...relations: [RelationKind, string][]): RelationSource {
  return { id, relations: relations.map(([kind, target]) => ({ kind, target })) };
}

function graph(...entities: RelationSource[]) {
  const map = new Map(entities.map((e) => [e.id, e]));
  const inbound = new Map<string, { from: string; kind: string }[]>();
  for (const e of entities) {
    for (const r of e.relations) {
      if (!map.has(r.target)) continue;
      inbound.set(r.target, [...(inbound.get(r.target) ?? []), { from: e.id, kind: r.kind }]);
    }
  }
  return { map, inbound };
}

describe('relation label tables', () => {
  it('cover every kind', () => {
    for (const k of RELATION_KINDS) {
      expect(RELATION_LABELS[k]).toBeTruthy();
      expect(RELATION_INBOUND_LABELS[k]).toBeTruthy();
    }
  });
  it('pair inverses both ways and never mark a symmetric kind as having one', () => {
    for (const [k, inv] of Object.entries(RELATION_INVERSE) as [RelationKind, RelationKind][]) {
      expect(RELATION_INVERSE[inv]).toBe(k);
      expect(SYMMETRIC_RELATIONS).not.toContain(k);
      // Seen from the target, a kind reads as its inverse.
      expect(RELATION_INBOUND_LABELS[k]).toBe(RELATION_LABELS[inv]);
    }
    for (const k of SYMMETRIC_RELATIONS) expect(RELATION_INBOUND_LABELS[k]).toBe(RELATION_LABELS[k]);
  });
});

describe('canonicalRelation', () => {
  it('flips an inverse kind onto its partner', () => {
    expect(canonicalRelation('polity.maurya', 'ruled-by', 'person.ashoka')).toEqual({ from: 'person.ashoka', kind: 'ruled', to: 'polity.maurya' });
    expect(canonicalRelation('person.ashoka', 'ruled', 'polity.maurya')).toEqual({ from: 'person.ashoka', kind: 'ruled', to: 'polity.maurya' });
    expect(canonicalRelation('polity.a', 'preceded', 'polity.b')).toEqual({ from: 'polity.b', kind: 'succeeded', to: 'polity.a' });
  });
  it('orders the ends of a symmetric kind', () => {
    expect(canonicalRelation('person.b', 'contemporary-of', 'person.a')).toEqual(canonicalRelation('person.a', 'contemporary-of', 'person.b'));
  });
  it('leaves other kinds alone', () => {
    expect(canonicalRelation('text.b', 'part-of', 'text.a')).toEqual({ from: 'text.b', kind: 'part-of', to: 'text.a' });
  });
});

describe('checkRelations', () => {
  it('accepts a consistent graph and counts where each fact is declared', () => {
    const { warnings, stats } = checkRelations([
      ent('person.ashoka', ['ruled', 'polity.maurya'], ['contemporary-of', 'person.antiochus']),
      ent('polity.maurya', ['ruled-by', 'person.ashoka'], ['succeeded', 'polity.nanda']),
      ent('polity.nanda'),
      ent('person.antiochus'),
    ]);
    expect(warnings).toEqual([]);
    expect(stats.declared).toBe(4);
    expect(stats.facts).toBe(3);
    expect(stats.inverse).toEqual({ bothSides: 1, oneSide: 1 });
    expect(stats.symmetric).toEqual({ bothSides: 0, oneSide: 1 });
    expect(stats.byKind).toEqual({ ruled: 1, 'contemporary-of': 1, 'ruled-by': 1, succeeded: 1 });
  });
  it('counts a symmetric relation declared at both ends as one fact', () => {
    const { warnings, stats } = checkRelations([ent('person.a', ['related-to', 'person.b']), ent('person.b', ['related-to', 'person.a'])]);
    expect(warnings).toEqual([]);
    expect(stats.facts).toBe(1);
    expect(stats.symmetric).toEqual({ bothSides: 1, oneSide: 0 });
  });
  it('warns when two records each claim to succeed the other', () => {
    const { warnings, stats } = checkRelations([ent('polity.a', ['succeeded', 'polity.b']), ent('polity.b', ['succeeded', 'polity.a'])]);
    expect(stats.contradictions).toBe(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('contradict');
  });
  it('warns when one record declares a kind and its inverse toward the same target', () => {
    const { stats } = checkRelations([ent('polity.a', ['succeeded', 'polity.b'], ['preceded', 'polity.b']), ent('polity.b')]);
    expect(stats.contradictions).toBe(1);
  });
  it('warns on a mutual part-of but not on mutual influence', () => {
    expect(checkRelations([ent('text.a', ['part-of', 'text.b']), ent('text.b', ['part-of', 'text.a'])]).stats.contradictions).toBe(1);
    expect(checkRelations([ent('person.a', ['influenced', 'person.b']), ent('person.b', ['influenced', 'person.a'])]).warnings).toEqual([]);
  });
  it('warns on self relations and duplicates, and counts unknown targets without warning', () => {
    const { warnings, stats } = checkRelations([ent('text.a', ['part-of', 'text.a'], ['related-to', 'text.b'], ['related-to', 'text.b'], ['part-of', 'text.missing']), ent('text.b')]);
    expect(stats.selfRelations).toBe(1);
    expect(stats.duplicates).toBe(1);
    expect(stats.unknownTargets).toBe(1);
    expect(warnings.map((w) => w.id)).toEqual(['text.a', 'text.a']);
  });
});

describe('relationGroups', () => {
  const g = graph(
    ent('person.ashoka', ['ruled', 'polity.maurya'], ['patronised', 'site.sanchi'], ['related-to', 'person.bindusara']),
    ent('polity.maurya', ['ruled-by', 'person.ashoka']),
    ent('site.sanchi'),
    ent('person.bindusara', ['related-to', 'person.ashoka']),
    ent('event.edict', ['issued-by', 'person.ashoka']),
    ent('text.ashokavadana', ['related-to', 'person.ashoka']),
  );
  it('merges both declarations of one fact and labels incoming relations from this end', () => {
    const groups = relationGroups(g.map, g.inbound, 'person.ashoka');
    expect(groups).toEqual([
      { label: 'ruled', edges: [{ other: 'polity.maurya', direction: 'both', note: undefined }] },
      { label: 'patronised', edges: [{ other: 'site.sanchi', direction: 'out', note: undefined }] },
      { label: 'issued', edges: [{ other: 'event.edict', direction: 'in', note: undefined }] },
      {
        label: 'related to',
        edges: [
          { other: 'person.bindusara', direction: 'both', note: undefined },
          { other: 'text.ashokavadana', direction: 'in', note: undefined },
        ],
      },
    ]);
    expect(countByDirection(groups)).toEqual({ out: 1, in: 2, both: 2 });
  });
  it('shows the same fact from the other end with the inverse phrase', () => {
    expect(relationGroups(g.map, g.inbound, 'polity.maurya')).toEqual([{ label: 'ruled by', edges: [{ other: 'person.ashoka', direction: 'both', note: undefined }] }]);
    expect(relationGroups(g.map, g.inbound, 'site.sanchi')).toEqual([{ label: 'patronised by', edges: [{ other: 'person.ashoka', direction: 'in', note: undefined }] }]);
  });
  it('merges an outgoing inverse kind with an incoming canonical kind under one phrase', () => {
    const h = graph(ent('text.a', ['authored-by', 'person.x']), ent('person.y', ['authored', 'text.a']), ent('person.x'));
    expect(relationGroups(h.map, h.inbound, 'text.a')).toEqual([
      {
        label: 'authored by',
        edges: [
          { other: 'person.x', direction: 'out', note: undefined },
          { other: 'person.y', direction: 'in', note: undefined },
        ],
      },
    ]);
  });
  it('returns nothing for an entity without relations or an unknown id', () => {
    const h = graph(ent('text.lonely'));
    expect(relationGroups(h.map, h.inbound, 'text.lonely')).toEqual([]);
    expect(relationGroups(h.map, h.inbound, 'text.none')).toEqual([]);
  });
  it('carries the note and applies the caller order', () => {
    const h = graph({ id: 'a.x', relations: [{ kind: 'related-to', target: 'a.y', note: 'shared workshop' }, { kind: 'related-to', target: 'a.z' }] }, ent('a.y'), ent('a.z'));
    const groups = relationGroups(h.map, h.inbound, 'a.x', (p, q) => q.localeCompare(p));
    expect(groups[0].edges.map((e) => e.other)).toEqual(['a.z', 'a.y']);
    expect(groups[0].edges[1].note).toBe('shared workshop');
    expect(relationGroups(h.map, h.inbound, 'a.y')[0].edges[0]).toEqual({ other: 'a.x', direction: 'in', note: 'shared workshop' });
  });
});

describe('neighbours in time', () => {
  const kc = (id: string, lens: 'scholarship' | 'tradition', earliest: number, latest: number, grade: 'A' | 'B' | 'C' | 'D' = lens === 'tradition' ? 'D' : 'B') =>
    ({
      id,
      name: id,
      datings: [{ lens, earliest, latest, grade, method: lens === 'tradition' ? 'traditional-puranic' : 'epigraphic', precision: 'year', circa: false }],
    }) as unknown as import('./kaalchakra').KcItem;
  const items = [
    kc('a', 'scholarship', -600, -500),
    kc('b', 'scholarship', -400, -350),
    kc('c', 'scholarship', -330, -250),
    kc('self', 'scholarship', -273, -232),
    kc('d', 'scholarship', -260, -240),
    kc('e', 'scholarship', -1500, 2000),
    kc('f', 'scholarship', -200, -100),
    kc('g', 'scholarship', 100, 200),
    kc('t1', 'tradition', -3101, -3101),
    kc('t2', 'tradition', -260, -260),
  ];
  it('splits entries into before, during and after by their own ranges', async () => {
    const { neighbours } = await import('./kaalchakra');
    const n = neighbours(items, { earliest: -273, latest: -232 }, 'self');
    expect(n.before.map((i) => i.id)).toEqual(['a', 'b']);
    expect(n.during.map((i) => i.id)).toEqual(['c', 'd', 'e']);
    expect(n.after.map((i) => i.id)).toEqual(['f', 'g']);
  });
  it('keeps the nearest entries on each side and never the page itself', async () => {
    const { neighbours } = await import('./kaalchakra');
    const n = neighbours(items, { earliest: -273, latest: -232 }, 'self', 'scholarship', 1);
    expect(n.before.map((i) => i.id)).toEqual(['b']);
    expect(n.during.map((i) => i.id)).toEqual(['d']);
    expect(n.after.map((i) => i.id)).toEqual(['f']);
  });
  it('never mixes the lenses', async () => {
    const { neighbours } = await import('./kaalchakra');
    const scholarly = neighbours(items, { earliest: -273, latest: -232 }, 'self');
    expect([...scholarly.before, ...scholarly.during, ...scholarly.after].map((i) => i.id)).not.toContain('t2');
    const traditional = neighbours(items, { earliest: -3101, latest: -3101 }, 't1', 'tradition');
    expect(traditional).toMatchObject({ before: [], during: [] });
    expect(traditional.after.map((i) => i.id)).toEqual(['t2']);
  });
});
