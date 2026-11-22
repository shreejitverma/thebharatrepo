'use client';

import Link from 'next/link';
import { useState } from 'react';
import DraftNotice from '@/components/DraftNotice';
import GradeBadge, { LensTag } from '@/components/GradeBadge';
import { KIND_LABELS, METHOD_LABELS } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import type { CalendarSystem } from '@/lib/time';
import { formatDatingRange, summaryFor, visibleDatings, type Level } from './shared';

export interface PanelProps {
  item: KcItem | undefined;
  lens: Lens;
  cal: CalendarSystem;
  level: Level;
  onLevel: (l: Level) => void;
  onPrev?: () => void;
  onNext?: () => void;
  total: number;
  /** The selected item is filtered out of the current views. */
  filteredOut?: boolean;
  /** Link to the current state; the address bar lags behind by a debounce. */
  shareUrl: () => string;
}

export default function Panel({ item, lens, cal, level, onLevel, onPrev, onNext, total, filteredOut, shareUrl }: PanelProps) {
  const [copied, setCopied] = useState(false);

  if (!item) {
    return (
      <aside className="kc-panel" aria-label="How to read the Kaalchakra">
        <p className="eyebrow">How to read the wheel</p>
        <h2>One wheel, two lenses</h2>
        <p className="kc-panel__summary">
          Time runs clockwise from the traditional start of the present kalpa, at the top, to today. Each ring holds one kind of entry. Select any point, or switch to the
          River view to zoom, or the List view to read.
        </p>
        <div className="kc-legend" style={{ marginBottom: 12 }}>
          <span>
            <svg width="16" height="16" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" fill="var(--k-text)" />
            </svg>{' '}
            Scholarly dating
          </span>
          <span>
            <svg width="16" height="16" aria-hidden="true">
              <circle cx="8" cy="8" r="5" fill="var(--bg-elev)" stroke="var(--gold)" strokeWidth="2.2" />
            </svg>{' '}
            Traditional reckoning
          </span>
          <span>
            <svg width="30" height="16" aria-hidden="true">
              <path d="M3 8h24" stroke="var(--k-text)" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
            </svg>{' '}
            Date range
          </span>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Distance is honest within each era, but the eras use different scales: deep time is logarithmic, history is linear. Dashed lines mark each change of scale.
        </p>
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
      </aside>
    );
  }

  const ds = visibleDatings(item, lens);
  const hidden = item.datings.length - ds.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className="kc-panel" aria-label={`Details: ${item.name}`}>
      <p className="eyebrow">{KIND_LABELS[item.kind]}</p>
      <h2>{item.name}</h2>
      {filteredOut ? (
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Hidden by the current filters or lens, so it is not drawn in the view.
        </p>
      ) : null}
      {item.iast || item.native ? (
        <div className="names">
          {item.native ? <span lang="sa">{item.native}</span> : null}
          {item.iast ? <span>{item.iast}</span> : null}
        </div>
      ) : null}
      <div className="segmented level-tabs" role="group" aria-label="Reading level">
        {(['adult', 'teen', 'kids'] as Level[]).map((l) => (
          <button key={l} type="button" aria-pressed={level === l} onClick={() => onLevel(l)}>
            {l === 'adult' ? 'Full' : l === 'teen' ? 'Teen' : 'Kids'}
          </button>
        ))}
      </div>
      <p className="kc-panel__summary">{summaryFor(item, level)}</p>
      <h3 style={{ fontSize: '1rem', margin: '0 0 8px' }}>When, and how we know</h3>
      <div className="datings">
        {ds.map((d, i) => (
          <div key={i} className={`dating dating--${d.lens}`}>
            <div className="dating__top">
              <span className="dating__range">{formatDatingRange(d, cal)}</span>
            </div>
            <div className="dating__top" style={{ marginTop: 6 }}>
              <GradeBadge grade={d.grade} />
              <LensTag lens={d.lens} />
            </div>
            <div className="dating__method" style={{ marginTop: 6 }}>
              {METHOD_LABELS[d.method]}
              {d.label ? `: ${d.label}` : ''}
            </div>
            {d.note ? <p>{d.note}</p> : null}
          </div>
        ))}
      </div>
      {hidden > 0 ? (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          {hidden} more dating{hidden > 1 ? 's' : ''} in the other lens.
        </p>
      ) : null}
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Link className="btn btn--primary" href={item.href}>
          Full record and sources
        </Link>
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </p>
      <DraftNotice className="review-note" />
      <div className="kc-panel__nav">
        <button type="button" className="btn" onClick={onPrev} disabled={!onPrev}>
          Earlier
        </button>
        <button type="button" className="btn" onClick={onNext} disabled={!onNext}>
          Later
        </button>
      </div>
    </aside>
  );
}
