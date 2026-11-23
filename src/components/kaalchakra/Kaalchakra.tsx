'use client';

import { use, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { KINDS, KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import { LENSES, LENS_LABELS, type Lens } from '@/lib/content/lens';
import type { Size } from '@/lib/geo/projection';
import type { CalendarSystem } from '@/lib/time';
import { panWindow, zoomWindow, type UnitWindow } from '@/lib/time/scale';
import Wheel from './Wheel';
import River from './River';
import ListView from './ListView';
import Panel from './Panel';
import { setReadingLevel, useReadingLevel } from '@/components/ReadingLevel';
import { loadItems } from './data';
import { entriesAt, panRegion, resolveRegion, revealPlace, zoomRegion, type MapRegion, type TimeZoom } from './mapState';
import { SEGMENTS, SHORT_SEGMENT_LABELS, formatDating, kindColor, orderedItems, primaryAnchor, primaryDating, segmentUnitBounds, yearToUnit } from './shared';
import { CALENDARS, VIEWS, hrefFor, parseState, serialise, type State } from './urlState';

// The map and its basemap load only when the Map view is opened, so the other views do not pay for them.
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <p className="empty">Loading the map.</p> });

/** Canvas size assumed until the map has measured itself. */
const INITIAL_MAP_SIZE: Size = { width: 900, height: 580 };
/** Pixels moved by one Shift and arrow key press in the Map view. */
const MAP_KEY_PAN = 80;

const NO_ALIASES: Readonly<Record<string, string>> = {};

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
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [mount, setMount] = useState<Mount>(() => ({ seen: search, written: null, epoch: 0, state: parseState(search, byId, aliases) }));
  if (search !== mount.seen) {
    if (search === mount.written) setMount({ ...mount, seen: search });
    else setMount({ seen: search, written: null, epoch: mount.epoch + 1, state: parseState(search, byId, aliases) });
  }
  const onWrite = useCallback((query: string) => setMount((m) => ({ ...m, written: query })), []);
  return <KaalchakraInner items={items} byId={byId} external={mount.state} epoch={mount.epoch} onWrite={onWrite} />;
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

function KaalchakraInner({ items, byId, external, epoch, onWrite }: { items: KcItem[]; byId: ReadonlyMap<string, KcItem>; external: State; epoch: number; onWrite: (query: string) => void }) {
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
    const query = serialise(s, byId);
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
  }, [s, byId, onWrite]);

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
  // A level in the URL wins; otherwise the viewer's site-wide reading level applies.
  const siteLevel = useReadingLevel();
  const level = s.level !== 'adult' ? s.level : siteLevel;

  const kindSet = useMemo(() => new Set(s.kinds), [s.kinds]);
  const visible = useMemo(() => orderedItems(items.filter((i) => kindSet.has(i.kind) && matches(i, s.q)), s.lens), [items, kindSet, s.q, s.lens]);
  const ringKinds = useMemo(() => KINDS.filter((k) => kindSet.has(k)), [kindSet]);
  const selected = s.sel ? byId.get(s.sel) : undefined;

  // Map view: the same filtered entries, narrowed to the scrubber's moment and to those with a place.
  const [mapSize, setMapSize] = useState<Size>(INITIAL_MAP_SIZE);
  const atMoment = useMemo(() => entriesAt(visible, s.lens, s.t, s.zoom), [visible, s.lens, s.t, s.zoom]);
  const mapItems = useMemo(() => atMoment.filter((i) => i.place), [atMoment]);
  const extentItems = useMemo(() => atMoment.filter((i) => i.extents?.length), [atMoment]);
  const mapView = useMemo(() => resolveRegion(s.region, mapSize), [s.region, mapSize]);
  const isMap = s.view === 'map';
  /** The entries the current view draws, in time order: what the arrow keys and Earlier and Later step through. */
  const shown = isMap ? mapItems : visible;
  const selIdx = selected ? shown.findIndex((i) => i.id === selected.id) : -1;

  // A hovered mark can unmount without a pointerleave when the items, view or window change.
  const [hoverCtx, setHoverCtx] = useState({ shown, view: s.view, win: s.win, region: s.region });
  if (hoverCtx.shown !== shown || hoverCtx.view !== s.view || hoverCtx.win !== s.win || hoverCtx.region !== s.region) {
    setHoverCtx({ shown, view: s.view, win: s.win, region: s.region });
    if (hover) setHover(null);
  }

  // Count announcements wait for typing and toggling to settle.
  const [announcedCount, setAnnouncedCount] = useState(shown.length);
  useEffect(() => {
    const t = setTimeout(() => setAnnouncedCount(shown.length), 800);
    return () => clearTimeout(t);
  }, [shown.length]);
  const announcedSel = s.view === 'wheel' ? settledSel : s.sel;
  const announced = announcedSel ? byId.get(announcedSel) : undefined;
  const announcedDating = announced ? primaryDating(announced, s.lens) : undefined;
  const announcement = announced ? (announcedDating ? `${announced.name}, ${formatDating(announcedDating, s.cal)}` : announced.name) : `${announcedCount} entries shown`;

  const select = useCallback((id: string) => update({ sel: id }), [update]);
  /** Select from the map or its list, moving the map only if the place is not comfortably in view. */
  const selectOnMap = useCallback(
    (id: string) => {
      const place = byId.get(id)?.place;
      setS((prev) => ({ ...prev, sel: id, region: place ? revealPlace(prev.region, mapSize, place) : prev.region }));
    },
    [byId, mapSize],
  );
  const onTime = useCallback((t: number | null) => update({ t }), [update]);
  const onTimeZoom = useCallback((zoom: TimeZoom) => update({ zoom }), [update]);
  const onRegion = useCallback((region: MapRegion) => update({ region }), [update]);
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
    const item = shown[i];
    if (!item) return;
    if (isMap) selectOnMap(item.id);
    else update(s.view === 'river' ? { sel: item.id, win: reveal(s.win, item, s.lens) } : { sel: item.id });
  };
  const step = (dir: -1 | 1) => {
    if (!shown.length) return;
    goTo(selIdx < 0 ? (dir === 1 ? 0 : shown.length - 1) : Math.min(shown.length - 1, Math.max(0, selIdx + dir)));
  };
  // The scroll gesture on the wheel steps from the latest state, however fast the events arrive.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  const onWheelStep = useCallback((dir: -1 | 1) => stepRef.current(dir), []);

  const onKey = (e: React.KeyboardEvent) => {
    // Keys typed into the map's own controls (the scrubber, the selects) belong to those controls.
    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('input, select, textarea, summary')) return;
    if (isMap && !e.altKey && !e.ctrlKey && !e.metaKey) {
      let region: MapRegion | null = null;
      if (e.key === '+' || e.key === '=') region = zoomRegion(s.region, mapSize, 0.5);
      else if (e.key === '-' || e.key === '_') region = zoomRegion(s.region, mapSize, 2);
      else if (e.shiftKey && e.key === 'ArrowLeft') region = panRegion(s.region, mapSize, MAP_KEY_PAN, 0);
      else if (e.shiftKey && e.key === 'ArrowRight') region = panRegion(s.region, mapSize, -MAP_KEY_PAN, 0);
      else if (e.shiftKey && e.key === 'ArrowUp') region = panRegion(s.region, mapSize, 0, MAP_KEY_PAN);
      else if (e.shiftKey && e.key === 'ArrowDown') region = panRegion(s.region, mapSize, 0, -MAP_KEY_PAN);
      if (region) {
        e.preventDefault();
        update({ region });
        return;
      }
    }
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
    } else if (e.key === 'Home' && shown.length) {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End' && shown.length) {
      e.preventDefault();
      goTo(shown.length - 1);
    } else if (e.key === 'Escape') update({ sel: null });
  };

  const toggleKind = (k: Kind) => {
    const next = kindSet.has(k) ? s.kinds.filter((x) => x !== k) : KINDS.filter((x) => x === k || kindSet.has(x));
    update({ kinds: next.length ? next : [...KINDS] });
  };

  // On a phone the text filter and the kind chips fold into a Filters disclosure, so the wheel starts on the first
  // screen; the button counts the filters in force while they are folded away. Wider screens always show them.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = (s.q.trim() ? 1 : 0) + (s.kinds.length < KINDS.length ? 1 : 0);

  const hoverItem = hover ? visible.find((i) => i.id === hover.id) : undefined;
  const hoverDating = hoverItem ? primaryDating(hoverItem, s.lens) : undefined;

  return (
    <div className="kc" data-filters-open={filtersOpen || undefined}>
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
          <button type="button" className="btn kc-filters-toggle" aria-expanded={filtersOpen} aria-controls="kc-q kc-kinds" onClick={() => setFiltersOpen((o) => !o)}>
            Filters
            {activeFilters ? (
              <span className="kc-filters-toggle__count">
                {activeFilters}
                <span className="visually-hidden"> active</span>
              </span>
            ) : null}
          </button>
          <label className="visually-hidden" htmlFor="kc-q">
            Filter entries
          </label>
          <input id="kc-q" className="input" type="search" placeholder="Filter, e.g. Ashoka" value={s.q} onChange={(e) => update({ q: e.target.value })} />
        </div>
      </div>
      <div className="kc-kinds kc-kinds--filter" id="kc-kinds" role="group" aria-label="Kinds of entry">
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
        Arrow keys move between entries in time order, Home and End go to the first and last, and Escape clears the selection. On the wheel, drag to spin it. In the River view, Shift and the left or right arrow move the window, and + and - zoom. In the Map view,
        Shift and the arrow keys move the map, + and - zoom, and the list below the map gives every entry on it.
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
          ) : isMap ? (
            <MapView
              items={mapItems}
              extentItems={extentItems}
              unplaced={atMoment.length - mapItems.length}
              lens={s.lens}
              cal={s.cal}
              selectedId={s.sel}
              t={s.t}
              zoom={s.zoom}
              region={s.region}
              view={mapView}
              size={mapSize}
              onSize={setMapSize}
              onTime={onTime}
              onZoom={onTimeZoom}
              onRegion={onRegion}
              onSelect={selectOnMap}
              onHover={onHover}
            />
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
          level={level}
          onLevel={(l) => {
            update({ level: l });
            // Shares the choice with the rest of the site; this component writes its own URL.
            setReadingLevel(l, { url: false });
          }}
          onPrev={selIdx > 0 ? () => step(-1) : undefined}
          onNext={selIdx >= 0 && selIdx < shown.length - 1 ? () => step(1) : undefined}
          total={shown.length}
          view={s.view}
          filteredOut={selected !== undefined && selIdx < 0}
          filteredNote={isMap && selected && !selected.place ? 'This entry has no recorded place, so it is not on the map.' : isMap ? 'Not on the map for the current filters, lens or moment.' : undefined}
          shareUrl={() => `${window.location.origin}${hrefFor(window.location.pathname, serialise(s, byId))}`}
        />
      </div>
    </div>
  );
}
