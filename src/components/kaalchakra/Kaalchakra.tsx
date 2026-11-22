'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KINDS, KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import { LENSES, LENS_LABELS, type Lens } from '@/lib/content/lens';
import type { CalendarSystem } from '@/lib/time';
import { panWindow, zoomWindow, type UnitWindow } from '@/lib/time/scale';
import Wheel from './Wheel';
import River from './River';
import ListView from './ListView';
import Panel from './Panel';
import { SEGMENTS, SHORT_SEGMENT_LABELS, formatDating, kindColor, orderedItems, primaryAnchor, primaryDating, segmentUnitBounds, yearToUnit, type Level, type View } from './shared';

const VIEWS: { id: View; label: string }[] = [
  { id: 'wheel', label: 'Wheel' },
  { id: 'river', label: 'River' },
  { id: 'list', label: 'List' },
];

const CALENDARS: { id: CalendarSystem; label: string }[] = [
  { id: 'ce', label: 'CE / BCE' },
  { id: 'ago', label: 'Years ago' },
  { id: 'vs', label: 'Vikram Samvat' },
  { id: 'shaka', label: 'Shaka Samvat' },
  { id: 'kali', label: 'Kali Yuga era' },
];

interface State {
  view: View;
  lens: Lens;
  cal: CalendarSystem;
  kinds: Kind[];
  q: string;
  sel: string | null;
  win: UnitWindow;
  level: Level;
}

const DEFAULT: State = { view: 'wheel', lens: 'both', cal: 'ce', kinds: [...KINDS], q: '', sel: null, win: { start: 0, end: 1 }, level: 'adult' };

/**
 * `aliases` maps the former id of a merged entity to the entity it was merged into, so an old ?id= deep link
 * selects the surviving entry (the server also redirects it; this covers client-side navigation).
 */
function parseState(search: string, ids: Set<string>, aliases: Readonly<Record<string, string>>): State {
  const p = new URLSearchParams(search);
  const s: State = { ...DEFAULT, kinds: [...KINDS] };
  const v = p.get('view');
  if (v === 'wheel' || v === 'river' || v === 'list') s.view = v;
  const l = p.get('lens');
  if (l && (LENSES as readonly string[]).includes(l)) s.lens = l as Lens;
  const c = p.get('cal');
  if (c && CALENDARS.some((x) => x.id === c)) s.cal = c as CalendarSystem;
  const k = p.get('kinds');
  if (k) {
    const ks = k.split(',').filter((x): x is Kind => (KINDS as readonly string[]).includes(x));
    if (ks.length) s.kinds = ks;
  }
  s.q = p.get('q') ?? '';
  const sel = p.get('id');
  const live = sel && !ids.has(sel) && Object.hasOwn(aliases, sel) ? aliases[sel] : sel;
  if (live && ids.has(live)) s.sel = live;
  const w = p.get('win');
  if (w) {
    const [a, b] = w.split(',').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b <= 1 && b - a > 0.0004) s.win = { start: a, end: b };
  }
  const lv = p.get('level');
  if (lv === 'teen' || lv === 'kids') s.level = lv;
  return s;
}

/** Query string for a state, without the leading "?", in URLSearchParams encoding. */
function serialise(s: State): string {
  const p = new URLSearchParams();
  if (s.view !== DEFAULT.view) p.set('view', s.view);
  if (s.lens !== DEFAULT.lens) p.set('lens', s.lens);
  if (s.cal !== DEFAULT.cal) p.set('cal', s.cal);
  if (s.kinds.length !== KINDS.length) p.set('kinds', s.kinds.join(','));
  if (s.q) p.set('q', s.q);
  if (s.sel) p.set('id', s.sel);
  if (s.view === 'river' && (s.win.start > 0 || s.win.end < 1)) p.set('win', `${s.win.start.toFixed(5)},${s.win.end.toFixed(5)}`);
  if (s.level !== 'adult') p.set('level', s.level);
  return p.toString();
}

function hrefFor(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

function matches(item: KcItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.name} ${item.iast ?? ''} ${item.native ?? ''} ${item.region ?? ''} ${item.summary}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

interface Mount {
  /** Search params last seen from the router. */
  seen: string;
  /** Query string this component last wrote with history.replaceState, if any since the last mount. */
  written: string | null;
  epoch: number;
  initial: State;
}

/**
 * State is initialised from useSearchParams, so deep links work on first load and on client-side
 * navigation. The inner component remounts only when the search params change to something this
 * component did not write itself: Back and Forward, or following a link such as the nav link to
 * /kaalchakra. Its own debounced replaceState writes are recognised and do not remount it.
 */
export default function Kaalchakra({ items, aliases = {} }: { items: KcItem[]; aliases?: Readonly<Record<string, string>> }) {
  const search = useSearchParams().toString();
  const ids = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const [mount, setMount] = useState<Mount>(() => ({ seen: search, written: null, epoch: 0, initial: parseState(search, ids, aliases) }));
  if (search !== mount.seen) {
    if (search === mount.written) setMount({ ...mount, seen: search });
    else setMount({ seen: search, written: null, epoch: mount.epoch + 1, initial: parseState(search, ids, aliases) });
  }
  const onWrite = useCallback((query: string) => setMount((m) => ({ ...m, written: query })), []);
  return <KaalchakraInner key={mount.epoch} items={items} initial={mount.initial} onWrite={onWrite} />;
}

/** Pan the window so the item's anchor is comfortably inside it; unchanged if it already is. */
function reveal(win: UnitWindow, item: KcItem, lens: Lens): UnitWindow {
  const a = primaryAnchor(item, lens);
  if (a === null) return win;
  const u = yearToUnit(a);
  const margin = (win.end - win.start) * 0.08;
  if (u >= win.start + margin && u <= win.end - margin) return win;
  return panWindow(win, u - (win.start + win.end) / 2);
}

function KaalchakraInner({ items, initial, onWrite }: { items: KcItem[]; initial: State; onWrite: (query: string) => void }) {
  const [s, setS] = useState<State>(initial);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const keysId = useId();

  // Debounced so continuous panning never exceeds browser limits on history.replaceState.
  useEffect(() => {
    const query = serialise(s);
    const t = setTimeout(() => {
      if (query === new URLSearchParams(window.location.search).toString()) return;
      onWrite(query);
      window.history.replaceState(null, '', hrefFor(window.location.pathname, query));
    }, 250);
    return () => clearTimeout(t);
  }, [s, onWrite]);

  const update = useCallback((patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch })), []);

  const kindSet = useMemo(() => new Set(s.kinds), [s.kinds]);
  const visible = useMemo(() => orderedItems(items.filter((i) => kindSet.has(i.kind) && matches(i, s.q)), s.lens), [items, kindSet, s.q, s.lens]);
  const ringKinds = useMemo(() => KINDS.filter((k) => kindSet.has(k)), [kindSet]);
  const selected = s.sel ? items.find((i) => i.id === s.sel) : undefined;
  const selIdx = selected ? visible.findIndex((i) => i.id === selected.id) : -1;
  const selDating = selected ? primaryDating(selected, s.lens) : undefined;

  // A hovered mark can unmount without a pointerleave when the items, view or window change.
  const [hoverCtx, setHoverCtx] = useState({ visible, view: s.view, win: s.win });
  if (hoverCtx.visible !== visible || hoverCtx.view !== s.view || hoverCtx.win !== s.win) {
    setHoverCtx({ visible, view: s.view, win: s.win });
    if (hover) setHover(null);
  }

  // Count announcements wait for typing and toggling to settle.
  const [announcedCount, setAnnouncedCount] = useState(visible.length);
  useEffect(() => {
    const t = setTimeout(() => setAnnouncedCount(visible.length), 800);
    return () => clearTimeout(t);
  }, [visible.length]);
  const announcement = selected ? (selDating ? `${selected.name}, ${formatDating(selDating, s.cal)}` : selected.name) : `${announcedCount} entries shown`;

  const select = useCallback((id: string) => update({ sel: id }), [update]);
  const onHover = useCallback((id: string | null, x: number, y: number) => {
    if (!id) return setHover(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ id, x: x - rect.left, y: y - rect.top });
  }, []);
  const onWindow = useCallback((w: UnitWindow) => update({ win: w }), [update]);
  const onSegment = useCallback(
    (segId: string) => {
      const seg = SEGMENTS.find((x) => x.id === segId);
      if (seg) update({ view: 'river', win: segmentUnitBounds(seg) });
    },
    [update],
  );

  const step = (dir: -1 | 1) => {
    if (!visible.length) return;
    const i = selIdx < 0 ? (dir === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, selIdx + dir));
    const item = visible[i];
    update(s.view === 'river' ? { sel: item.id, win: reveal(s.win, item, s.lens) } : { sel: item.id });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (s.view === 'river' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const span = s.win.end - s.win.start;
      const mid = (s.win.start + s.win.end) / 2;
      let win: UnitWindow | null = null;
      if (e.key === '+' || e.key === '=') win = zoomWindow(s.win, mid, 0.5);
      else if (e.key === '-' || e.key === '_') win = zoomWindow(s.win, mid, 2);
      else if (e.shiftKey && e.key === 'ArrowLeft') win = panWindow(s.win, -0.2 * span);
      else if (e.shiftKey && e.key === 'ArrowRight') win = panWindow(s.win, 0.2 * span);
      if (win) {
        e.preventDefault();
        update({ win });
        return;
      }
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Escape') update({ sel: null });
  };

  const toggleKind = (k: Kind) => {
    const next = kindSet.has(k) ? s.kinds.filter((x) => x !== k) : KINDS.filter((x) => x === k || kindSet.has(x));
    update({ kinds: next.length ? next : [...KINDS] });
  };

  const hoverItem = hover ? visible.find((i) => i.id === hover.id) : undefined;
  const hoverDating = hoverItem ? primaryDating(hoverItem, s.lens) : undefined;

  return (
    <div className="kc">
      <div className="kc-toolbar">
        <div className="segmented" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={s.view === v.id} onClick={() => update({ view: v.id })}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Lens">
          {LENSES.map((l) => (
            <button key={l} type="button" aria-pressed={s.lens === l} onClick={() => update({ lens: l })}>
              {LENS_LABELS[l]}
            </button>
          ))}
        </div>
        <div className="kc-toolbar__group">
          <label className="visually-hidden" htmlFor="kc-cal">
            Calendar
          </label>
          <select id="kc-cal" className="select" value={s.cal} onChange={(e) => update({ cal: e.target.value as CalendarSystem })}>
            {CALENDARS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="kc-q">
            Filter entries
          </label>
          <input id="kc-q" className="input" type="search" placeholder="Filter: Ashoka, Vedas, Chola..." value={s.q} onChange={(e) => update({ q: e.target.value })} />
        </div>
      </div>
      <div className="kc-kinds" role="group" aria-label="Kinds of entry">
        {KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kindSet.has(k)} onClick={() => toggleKind(k)} style={{ color: kindColor(k) }}>
            <span className="chip__dot" aria-hidden="true" />
            <span style={{ color: 'var(--ink-soft)' }}>{KIND_LABELS[k]}</span>
          </button>
        ))}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      <p className="visually-hidden" id={keysId}>
        Arrow keys move between entries in time order and Escape clears the selection. In the River view, Shift and the left or right arrow move the window, and + and - zoom.
      </p>

      <div className="kc-stage">
        <div className="kc-canvas" ref={canvasRef} tabIndex={0} onKeyDown={onKey} role="group" aria-roledescription="timeline" aria-label="Kaalchakra" aria-describedby={keysId}>
          {s.view === 'wheel' ? (
            <>
              <Wheel items={visible} kinds={ringKinds} lens={s.lens} selectedId={s.sel} cal={s.cal} onSelect={select} onHover={onHover} onSegment={onSegment} />
              <div className="kc-scale-note">
                <div className="kc-kinds" role="group" aria-label="Zoom into an era">
                  {SEGMENTS.map((seg) => (
                    <button key={seg.id} type="button" className="chip" onClick={() => onSegment(seg.id)}>
                      {SHORT_SEGMENT_LABELS[seg.id]}
                    </button>
                  ))}
                </div>
                Each era has its own scale: deep time is logarithmic, history is linear. Tap an era to zoom into it.
              </div>
            </>
          ) : s.view === 'river' ? (
            <River items={visible} kinds={ringKinds} lens={s.lens} selectedId={s.sel} win={s.win} onWindow={onWindow} onSelect={select} onHover={onHover} />
          ) : (
            <ListView items={visible} lens={s.lens} cal={s.cal} selectedId={s.sel} onSelect={select} />
          )}
          {hover && hoverItem ? (
            <div className="kc-tooltip" style={{ left: hover.x, top: hover.y }}>
              <strong>{hoverItem.name}</strong>
              {hoverDating ? <div>{formatDating(hoverDating, s.cal)}</div> : null}
            </div>
          ) : null}
        </div>
        <Panel
          item={selected}
          lens={s.lens}
          cal={s.cal}
          level={s.level}
          onLevel={(level) => update({ level })}
          onPrev={selIdx > 0 ? () => step(-1) : undefined}
          onNext={selIdx >= 0 && selIdx < visible.length - 1 ? () => step(1) : undefined}
          total={visible.length}
          filteredOut={selected !== undefined && selIdx < 0}
          shareUrl={() => `${window.location.origin}${hrefFor(window.location.pathname, serialise(s))}`}
        />
      </div>
    </div>
  );
}
