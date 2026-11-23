import { KINDS, KIND_LABELS, type Kind } from '@/lib/content/labels';
import { LENSES, LENS_LABELS, type Lens } from '@/lib/content/lens';
import type { CalendarSystem } from '@/lib/time';
import { SEGMENTS, SHORT_SEGMENT_LABELS, kindColor, type View } from './shared';
import { CALENDARS, VIEWS } from './urlState';

export interface ToolbarHandlers {
  view: (v: View) => void;
  lens: (l: Lens) => void;
  cal: (c: CalendarSystem) => void;
  q: (q: string) => void;
  toggleFilters: () => void;
  kind: (k: Kind) => void;
}

export interface ToolbarProps {
  view: View;
  lens: Lens;
  cal: CalendarSystem;
  q: string;
  kinds: ReadonlySet<Kind>;
  filtersOpen: boolean;
  /** Filters in force, counted on the phone layout's Filters button while they are folded away. */
  activeFilters: number;
  /**
   * The controls' handlers. Without them the toolbar is the static skeleton the server renders before the
   * interactive Kaalchakra loads: the same elements and classes, so it takes the same height at every breakpoint,
   * but inert, hidden from assistive technology and drawn as blank shapes (.kc-skeleton).
   */
  on?: ToolbarHandlers;
}

/** The view, lens and calendar controls, the text filter, and the row of kind chips below them. */
export default function Toolbar({ view, lens, cal, q, kinds, filtersOpen, activeFilters, on }: ToolbarProps) {
  const skeleton = on === undefined;
  // React renders `inert` as a boolean attribute; `aria-hidden` keeps the blank shapes out of the accessibility tree.
  const shell = skeleton ? { inert: true, 'aria-hidden': true as const } : {};
  const cls = (base: string) => (skeleton ? `${base} kc-skeleton` : base);
  return (
    <>
      <div className={cls('kc-toolbar')} {...shell}>
        <div className="segmented" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={on && (() => on.view(v.id))}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Lens">
          {LENSES.map((l) => (
            <button key={l} type="button" aria-pressed={lens === l} onClick={on && (() => on.lens(l))}>
              {LENS_LABELS[l]}
            </button>
          ))}
        </div>
        <div className="kc-toolbar__group">
          <label className="visually-hidden" htmlFor={skeleton ? undefined : 'kc-cal'}>
            Calendar
          </label>
          <select
            id={skeleton ? undefined : 'kc-cal'}
            className="select"
            {...(on ? { value: cal, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => on.cal(e.target.value as CalendarSystem) } : { defaultValue: cal })}
          >
            {CALENDARS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn kc-filters-toggle" aria-expanded={filtersOpen} aria-controls={skeleton ? undefined : 'kc-q kc-kinds'} onClick={on?.toggleFilters}>
            Filters
            {activeFilters ? (
              <span className="kc-filters-toggle__count">
                {activeFilters}
                <span className="visually-hidden"> active</span>
              </span>
            ) : null}
          </button>
          <label className="visually-hidden" htmlFor={skeleton ? undefined : 'kc-q'}>
            Filter entries
          </label>
          <input
            id={skeleton ? undefined : 'kc-q'}
            className="input"
            type="search"
            placeholder="Filter, e.g. Ashoka"
            {...(on ? { value: q, onChange: (e: React.ChangeEvent<HTMLInputElement>) => on.q(e.target.value) } : { defaultValue: q, readOnly: true })}
          />
        </div>
      </div>
      <div className={cls('kc-kinds kc-kinds--filter')} id={skeleton ? undefined : 'kc-kinds'} role="group" aria-label="Kinds of entry" {...shell}>
        {KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kinds.has(k)} onClick={on && (() => on.kind(k))} style={{ color: kindColor(k) }}>
            <span className="chip__dot" aria-hidden="true" />
            <span style={{ color: 'var(--ink-soft)' }}>{KIND_LABELS[k]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * The note under the wheel, with a chip per era that zooms into it. Without `onSegment` the chips are the static
 * skeleton of the server-rendered wheel, so the canvas keeps its height when the interactive wheel replaces it.
 */
export function WheelScaleNote({ onSegment }: { onSegment?: (segmentId: string) => void }) {
  return (
    <div className="kc-scale-note">
      <div className={onSegment ? 'kc-kinds' : 'kc-kinds kc-skeleton'} role="group" aria-label="Zoom into an era" {...(onSegment ? {} : { inert: true, 'aria-hidden': true as const })}>
        {SEGMENTS.map((seg) => (
          <button key={seg.id} type="button" className="chip" onClick={onSegment && (() => onSegment(seg.id))}>
            {SHORT_SEGMENT_LABELS[seg.id]}
          </button>
        ))}
      </div>
      Each era has its own scale: deep time is logarithmic, history is linear. Tap an era to zoom into it.
    </div>
  );
}
