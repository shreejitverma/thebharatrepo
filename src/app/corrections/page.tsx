import type { Metadata } from 'next';
import { getGraph } from '@/lib/content/site';

export const metadata: Metadata = { title: 'Corrections log', description: 'Every substantive correction made to The Bharat Repo, with reasons and sources.' };

export default function CorrectionsPage() {
  const list = getGraph().corrections;
  return (
    <div className="main-content">
      <div className="prose-wrap">
        <p className="eyebrow">Corrections</p>
        <h1>Corrections log</h1>
        <p className="lede" style={{ marginTop: 0 }}>
          When we get something wrong, we fix it in public. {list.length} correction{list.length === 1 ? '' : 's'} recorded.
        </p>
        {list.length === 0 ? <p className="empty">0 corrections recorded.</p> : null}
        {list.map((c, i) => (
          <section key={i} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
            <p className="muted" style={{ margin: 0 }}>
              {c.date} / {c.target}
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong>Before:</strong> {c.before}
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong>After:</strong> {c.after}
            </p>
            <p style={{ margin: '6px 0' }} className="muted">
              Why: {c.reason}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
