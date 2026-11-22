import Link from 'next/link';
import { KIND_LABELS, type Kind } from '@/lib/content/labels';
import { countByDirection, type RelationDirection, type RelationGroup } from '@/lib/content/relations';

/** What the graph shows for the entity at the far end of an edge. */
export interface RelationNode {
  name: string;
  href: string;
  kind: Kind;
  /** Formatted primary dating. */
  when: string;
}

const DIRECTION_TEXT: Record<RelationDirection, string> = {
  out: 'stated on this record',
  in: 'stated on the other record',
  both: 'stated on both records',
};

/** Arrow from this entity to the other (out), from the other to this (in), or both ways. */
function DirectionMark({ direction }: { direction: RelationDirection }) {
  return (
    <svg className="relgraph__dir" width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" focusable="false">
      <path d="M2 6h14" />
      {direction !== 'in' ? <path d="M12 2l4 4l-4 4" /> : null}
      {direction !== 'out' ? <path d="M6 2l-4 4l4 4" /> : null}
    </svg>
  );
}

/**
 * The date, then the direction arrow. A long date (deep time, or a marked traditional reckoning) may wrap, but the
 * arrow stays joined to its last word, so it never sits alone on a line.
 */
function WhenAndDirection({ when, direction }: { when: string; direction: RelationDirection }) {
  const cut = when.lastIndexOf(' ');
  return (
    <span className="relgraph__when">
      {cut > 0 ? `${when.slice(0, cut)} ` : null}
      <span className="relgraph__tail">
        {when.slice(cut + 1)}
        <DirectionMark direction={direction} />
      </span>
    </span>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The relation graph around one entity, drawn as a tree: the entity is the root, each branch is a
 * relation phrase, and each leaf links to the entity at the other end. It is plain HTML lists, so it
 * reads in order with a screen reader ("ruled: Maurya Empire, stated on both records") and needs no
 * client JavaScript. Every edge shows where it was declared, so incoming relations are never mistaken
 * for claims made on this record.
 */
export default function RelationGraph({ name, groups, node }: { name: string; groups: RelationGroup[]; node: (id: string) => RelationNode | undefined }) {
  const n = countByDirection(groups);
  const total = n.out + n.in + n.both;
  return (
    <section className="relgraph" aria-labelledby="connections">
      <h2 id="connections">Connections</h2>
      {total === 0 ? (
        <p className="relgraph__none">0 connections: no relation between this entry and another is recorded yet.</p>
      ) : (
        <>
          <p className="relgraph__summary">
            {plural(total, 'connection', 'connections')} to other entries: {n.out} stated on this record, {n.in} stated on other records, {n.both} stated on both.
          </p>
          <div className="relgraph__tree">
            <p className="relgraph__root">{name}</p>
            <ul className="relgraph__branches">
              {groups.map((g) => (
                <li key={g.label} className="relgraph__branch">
                  <span className="relgraph__label">{g.label}</span>
                  <ul className="relgraph__nodes">
                    {g.edges.map((e) => {
                      const other = node(e.other);
                      if (!other) return null;
                      return (
                        <li key={e.other}>
                          <Link href={other.href} data-direction={e.direction} title={e.note ?? `${KIND_LABELS[other.kind]}, ${DIRECTION_TEXT[e.direction]}`} style={{ color: `var(--k-${other.kind})` }}>
                            <span className="chip__dot" aria-hidden="true" />
                            <span className="relgraph__text">
                              <span className="relgraph__name">{other.name}</span>
                              <WhenAndDirection when={other.when} direction={e.direction} />
                              <span className="visually-hidden">
                                ({KIND_LABELS[other.kind]}, {DIRECTION_TEXT[e.direction]})
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          <ul className="relgraph__legend" aria-label="How to read the arrows">
            {(['out', 'in', 'both'] as const).map((d) => (
              <li key={d}>
                <DirectionMark direction={d} /> {DIRECTION_TEXT[d]}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
