import Link from 'next/link';
import GradeBadge from '@/components/GradeBadge';
import type { View } from './shared';

/**
 * The panel before any entry is selected: how to read the current view, the legend and the grades. The server-rendered
 * wheel (KaalchakraFallback) shows it too, so the panel keeps its size when the interactive Kaalchakra replaces it.
 */
export default function PanelIntro({ view, total, children }: { view: View; total: number; children?: React.ReactNode }) {
  return (
    <aside className="kc-panel" aria-label="How to read the Kaalchakra">
      {view === 'map' ? (
        <>
          <p className="eyebrow">How to read the map</p>
          <h2>Places in time</h2>
          <p className="kc-panel__summary">
            Each marker is an entry with a recorded place. A numbered circle stands for several entries close together: select it to zoom in. Move the time scrubber to see what is dated
            to a moment, or keep All time. The list below the map gives the same entries.
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow">How to read the wheel</p>
          <h2>One wheel, two lenses</h2>
          <p className="kc-panel__summary">
            Time runs clockwise from the traditional start of the present kalpa, at the top, to today. Each ring holds one kind of entry. Select any point, or switch to the River view to
            zoom, the Map view to see places, or the List view to read.
          </p>
        </>
      )}
      <div className="kc-legend" style={{ marginBottom: 12 }}>
        <span>
          <svg width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" fill="var(--k-text)" />
          </svg>{' '}
          Scholarly dating
        </span>
        <span>
          <svg width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="5" fill="var(--wheel-trad-fill)" stroke="var(--lens-tradition)" strokeWidth="2.2" />
          </svg>{' '}
          Traditional reckoning
        </span>
        {view === 'map' ? (
          <span>
            <svg width="22" height="22" aria-hidden="true">
              <circle cx="11" cy="11" r="10" fill="var(--map-cluster)" />
              <text x="11" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--map-cluster-ink)">
                5
              </text>
            </svg>{' '}
            Several entries
          </span>
        ) : (
          <span>
            <svg width="30" height="16" aria-hidden="true">
              <path d="M3 8h24" stroke="var(--k-text)" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
            </svg>{' '}
            Date range
          </span>
        )}
      </div>
      {view === 'map' ? null : (
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Distance is honest within each era, but the eras use different scales: deep time is logarithmic, history is linear. Dashed lines mark each change of scale.
        </p>
      )}
      <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        <GradeBadge grade="A" />
        <GradeBadge grade="B" />
        <GradeBadge grade="C" />
        <GradeBadge grade="D" />
        <GradeBadge grade="E" />
      </div>
      <p style={{ marginTop: 14 }}>
        <Link href="/methodology">Read the full methodology</Link>
      </p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        {total} entries currently shown.
      </p>
      {children}
    </aside>
  );
}
