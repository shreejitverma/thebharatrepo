import GradeBadge, { LensTag } from '@/components/GradeBadge';
import SourceCitation from '@/components/SourceCitation';
import { METHOD_LABELS, citationId, isTraditional, type Dating, type Source } from '@/lib/content/schema';
import { formatRange } from '@/lib/time';

/** Every dating in the order given, each with its grade, lens, method and sources (linked to their records). */
export default function DatingList({ datings, sources }: { datings: readonly Dating[]; sources: Map<string, Source> }) {
  return (
    <div className="datings">
      {datings.map((d, i) => {
        const lens = isTraditional(d.method) ? 'tradition' : 'scholarship';
        return (
          <div key={i} className={`dating dating--${lens}`}>
            <div className="dating__top">
              <span className="dating__range">{formatRange(d.range)}</span>
              <GradeBadge grade={d.grade} />
              <LensTag lens={lens} />
            </div>
            <div className="dating__method" style={{ marginTop: 6 }}>
              {METHOD_LABELS[d.method]}
              {d.label ? `: ${d.label}` : ''}
            </div>
            {d.note ? <p>{d.note}</p> : null}
            <ul className="dating__sources" data-pagefind-ignore>
              {d.sources.map((ref, j) => {
                const s = sources.get(citationId(ref));
                return <li key={j}>{s ? <SourceCitation source={s} locator={typeof ref === 'string' ? undefined : ref.locator} record /> : citationId(ref)}</li>;
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
