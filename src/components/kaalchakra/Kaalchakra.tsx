'use client';

import { use, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { loadItems } from './data';
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

const NO_ALIASES: Readonly<Record<string, string>> = {};

/** The List view is the default for readers who ask for reduced motion; an explicit view in the URL still wins. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Entry nearest a year (astronomical numbering) in a lens, for a `t=` link that names a moment rather than an entry. */
function nearestTo(items: KcItem[], year: number, lens: Lens): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const it of items) {
    const a = primaryAnchor(it, lens);
    if (a === null) continue;
    const d = Math.abs(yearToUnit(a) - yearToUnit(year));
    if (d < bestD) {
      best = it.id;
      bestD = d;
    }
  }
  return best;
}

/**
 * `aliases` maps the former id of a merged entity to the entity it was merged into, so an old ?id= deep link
 * selects the surviving entry (the server also redirects it; this covers client-side navigation).
 */
function parseState(search: string, items: KcItem[], ids: Set<string>, aliases: Readonly<Record<string, string>>): State {
  const p = new URLSearchParams(search);
  const s: State = { ...DEFAULT, kinds: [...KINDS] };
  const v = p.get('view');
  if (v === 'wheel' || v === 'river' || v === 'list') s.view = v;
  else if (prefersReducedMotion()) s.view = 'list';
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
  const t = Number(p.get('t') ?? NaN);
  const live = sel && !ids.has(sel) && Object.hasOwn(aliases, sel) ? aliases[sel] : sel;
  if (live && ids.has(live)) s.sel = live;
  else if (p.get('t') && Number.isFinite(t)) s.sel = nearestTo(items, t, s.lens);
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
  // Reduced motion changes the default view, so its readers always get an explicit view: their links then open the same view for everyone.
  if (s.view !== DEFAULT.view || prefersReducedMotion()) p.set('view', s.view);
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
  /** Query string this component last wrote to history, if any since the last outside change. */
  written: string | null;
  /** Bumped by every outside change: Back and Forward, or a link to /kaalchakra. */
  epoch: number;
  state: State;
}

/**
 * The items arrive as a static JSON file rather than in the page, so the HTML stays small as the archive grows.
 * Until they arrive the page's Suspense fallback (the server-rendered wheel) stays on screen.
 * useSearchParams comes first: during static prerendering it bails out to that fallback before any fetch.
 */
export default function Kaalchakra({ aliases = NO_ALIASES }: { aliases?: Readonly<Record<string, string>> }) {
  const search = useSearchParams().toString();
  const result = use(loadItems());
  if (!result.ok) {
    return (
      <div className="kc">
        <p className="empty" role="alert">
          The Kaalchakra data could not be loaded ({result.error}).{' '}
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </p>
      </div>
    );
  }
  return <KaalchakraMount items={result.items} search={search} aliases={aliases} />;
}

/**
 * The URL is the source of truth. State is initialised from useSearchParams, so deep links work on first
 * load and on client-side navigation. When the search params change to something this component did not
 * write itself (Back and Forward, a `t=` or `id=` edit, or a link such as the nav link to /kaalchakra),
 * the parsed state replaces the current one in place, without a remount, so the wheel animates to it.
 * Its own debounced history writes are recognised and change nothing.
 */
function KaalchakraMount({ items, search, aliases }: { items: KcItem[]; search: string; aliases: Readonly<Record<string, string>> }) {
  const ids = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const [mount, setMount] = useState<Mount>(() => ({ seen: search, written: null, epoch: 0, state: parseState(search, items, ids, aliases) }));
  if (search !== mount.seen) {
    if (search === mount.written) setMount({ ...mount, seen: search });
    else setMount({ seen: search, written: null, epoch: mount.epoch + 1, state: parseState(search, items, ids, aliases) });
  }
  const onWrite = useCallback((query: string) => setMount((m) => ({ ...m, written: query })), []);
  return <KaalchakraInner items={items} external={mount.state} epoch={mount.epoch} onWrite={onWrite} />;
}

/** Changes that are worth their own history entry, so Back returns to them; filters and pans only replace. */
function isNavigation(a: State, b: State): boolean {
  return a.sel !== b.sel || a.view !== b.view || a.lens !== b.lens;
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

function KaalchakraInner({ items, external, epoch, onWrite }: { items: KcItem[]; external: State; epoch: number; onWrite: (query: string) => void }) {
  const [s, setS] = useState<State>(external);
  const [seenEpoch, setSeenEpoch] = useState(epoch);
  if (epoch !== seenEpoch) {
    setSeenEpoch(epoch);
    setS(external);
  }
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  // The wheel announces a selection when its spin ends; the other views announce at once.
  const [settledSel, setSettledSel] = useState<string | null>(external.sel);
  const canvasRef = useRef<HTMLDivElement>(null);
  const keysId = useId();
  /** The state behind the current history entry. */
  const committed = useRef<State>(external);
  // An outside change already has its own history entry: writing its canonical form replaces that entry.
  useEffect(() => {
    committed.current = external;
  }, [external]);

  // A new selection, view or lens is written at once as its own history entry, so Back and Forward step through
  // them and a link clicked straight afterwards is never overtaken by a late write. A burst of such changes (an
  // arrow key held down, a scroll gesture) coalesces into one entry. Everything else (typing, panning) replaces
  // the entry after a debounce, so continuous changes never exceed browser limits on history writes.
  const lastPush = useRef(-Infinity);
  const pendingWrite = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const query = serialise(s);
    const navigation = isNavigation(committed.current, s);
    const write = () => {
      pendingWrite.current = null;
      if (!window.location.pathname.startsWith('/kaalchakra')) return;
      if (query === new URLSearchParams(window.location.search).toString()) {
        committed.current = s;
        return;
      }
      onWrite(query);
      const href = hrefFor(window.location.pathname, query);
      const now = performance.now();
      if (navigation && now - lastPush.current > 700) {
        window.history.pushState(null, '', href);
        lastPush.current = now;
      } else window.history.replaceState(null, '', href);
      committed.current = s;
    };
    if (navigation) {
      write();
      return;
    }
    const t = setTimeout(write, 250);
    pendingWrite.current = t;
    return () => clearTimeout(t);
  }, [s, onWrite]);

  // Following a link away drops a pending debounced write, which would otherwise land on the next page's entry.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a || !pendingWrite.current) return;
      if (new URL((a as HTMLAnchorElement).href, window.location.href).pathname !== window.location.pathname) {
        clearTimeout(pendingWrite.current);
        pendingWrite.current = null;
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const update = useCallback((patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch })), []);

  const kindSet = useMemo(() => new Set(s.kinds), [s.kinds]);
  const visible = useMemo(() => orderedItems(items.filter((i) => kindSet.has(i.kind) && matches(i, s.q)), s.lens), [items, kindSet, s.q, s.lens]);
  const ringKinds = useMemo(() => KINDS.filter((k) => kindSet.has(k)), [kindSet]);
  const selected = s.sel ? items.find((i) => i.id === s.sel) : undefined;
  const selIdx = selected ? visible.findIndex((i) => i.id === selected.id) : -1;

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
  const announcedSel = s.view === 'wheel' ? settledSel : s.sel;
  const announced = announcedSel ? items.find((i) => i.id === announcedSel) : undefined;
  const announcedDating = announced ? primaryDating(announced, s.lens) : undefined;
  const announcement = announced ? (announcedDating ? `${announced.name}, ${formatDating(announcedDating, s.cal)}` : announced.name) : `${announcedCount} entries shown`;

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

  const goTo = (i: number) => {
    const item = visible[i];
    if (!item) return;
    update(s.view === 'river' ? { sel: item.id, win: reveal(s.win, item, s.lens) } : { sel: item.id });
  };
  const step = (dir: -1 | 1) => {
    if (!visible.length) return;
    goTo(selIdx < 0 ? (dir === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, selIdx + dir)));
  };
  // The scroll gesture on the wheel steps from the latest state, however fast the events arrive.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  const onWheelStep = useCallback((dir: -1 | 1) => stepRef.current(dir), []);

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
    } else if (e.key === 'Home' && visible.length) {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End' && visible.length) {
      e.preventDefault();
      goTo(visible.length - 1);
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
          <input id="kc-q" className="input" type="search" placeholder="Filter, e.g. Ashoka" value={s.q} onChange={(e) => update({ q: e.target.value })} />
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
        Arrow keys move between entries in time order, Home and End go to the first and last, and Escape clears the selection. On the wheel, drag to spin it. In the River view, Shift and the left or right arrow move the window, and + and - zoom.
      </p>

      <div className="kc-stage">
        <div className="kc-canvas" ref={canvasRef} tabIndex={0} onKeyDown={onKey} role="group" aria-roledescription="timeline" aria-label="Kaalchakra" aria-describedby={keysId}>
          {s.view === 'wheel' ? (
            <>
              <Wheel items={visible} kinds={ringKinds} lens={s.lens} selectedId={s.sel} cal={s.cal} onSelect={select} onHover={onHover} onStep={onWheelStep} onSettled={setSettledSel} />
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
