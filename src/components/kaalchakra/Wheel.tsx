'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import type { CalendarSystem } from '@/lib/time';
import WheelSvg, { SEGMENT_ANGLES, placeLabels } from './WheelSvg';
import { Spinner } from './spin';
import { anchorIn, formatDatingRange, primaryDating, wrapText, yearToUnit } from './shared';
import { R_INNER, R_OUTER, VB, angleOf, coastDistance, nearestToAngle, nearestToIndicator, rotationFor, shortestDelta } from './wheelGeometry';

export interface WheelProps {
  /** Visible entries in time order. */
  items: KcItem[];
  kinds: readonly Kind[];
  lens: Lens;
  selectedId: string | null;
  cal: CalendarSystem;
  onSelect: (id: string) => void;
  onHover: (id: string | null, clientX: number, clientY: number) => void;
  /** One step through the entries in time order, from a scroll gesture. */
  onStep: (dir: -1 | 1) => void;
  /** The wheel has come to rest on this selection (also called on first paint). */
  onSettled: (id: string | null) => void;
}

/** Pixels the pointer must travel before a press becomes a drag rather than a tap. */
const DRAG_SLOP = 6;
/** A pointer must rest on the wheel this long, with the page still, before scrolling turns the wheel. */
const HOVER_INTENT_MS = 400;

/** Clockwise turn from angle a to angle b, in [0, 2 PI). */
function turnsFrom(a: number, b: number): number {
  const t = (b - a) % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Drag {
  pointerId: number;
  x0: number;
  y0: number;
  lastPhi: number;
  angle: number;
  active: boolean;
}

/**
 * Interactive wheel for the Kaalchakra page; static renders use WheelSvg directly.
 * The rotation lives in a Spinner, outside React: selecting an entry re-renders the hub once, then the
 * wheel turns frame by frame through direct style writes, and settles with a single onSettled call.
 */
function WheelImpl({ items, kinds, lens, selectedId, cal, onSelect, onHover, onStep, onSettled }: WheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);

  const angles = useMemo(() => items.map((it) => angleOf(yearToUnit(anchorIn(it, lens) ?? 0))), [items, lens]);
  const selIdx = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
  const target = selIdx >= 0 ? rotationFor(angles[selIdx]) : 0;

  // The first paint is already at rest on the selection; after that only the Spinner moves the wheel.
  const [initialRotation] = useState(target);

  // The latest props, for handlers and the Spinner's settle callback that outlive a render.
  const latest = useRef({ selectedId, onSettled, items, angles, onSelect, onStep });
  useEffect(() => {
    latest.current = { selectedId, onSettled, items, angles, onSelect, onStep };
  });

  const spinner = useRef<Spinner | null>(null);
  const pending = useRef<{ id: string; to: number; v0: number } | null>(null);

  useEffect(() => {
    const rotor = rotorRef.current;
    const overlay = overlayRef.current;
    if (!rotor || !overlay) return;
    const labels = Array.from(overlay.querySelectorAll<SVGTextElement>('text[data-mode]'));
    const s = new Spinner(
      initialRotation,
      (a, v) => {
        rotor.style.transform = `rotate(${((a * 180) / Math.PI).toFixed(3)}deg)`;
        placeLabels(labels, a, v);
      },
      () => {
        rotor.removeAttribute('data-spinning');
        latest.current.onSettled(latest.current.selectedId);
      },
    );
    spinner.current = s;
    latest.current.onSettled(latest.current.selectedId);
    return () => {
      s.stop();
      spinner.current = null;
    };
  }, [initialRotation]);

  // Spin whenever the target moves: a new selection, a lens that moves the anchor, or Back and Forward.
  const lastTarget = useRef(target);
  useEffect(() => {
    const s = spinner.current;
    if (!s) return;
    if (target === lastTarget.current) {
      // Same place on the wheel (another entry of the same year, say): nothing to turn, but still announce it.
      if (!s.moving) latest.current.onSettled(selectedId);
      return;
    }
    lastTarget.current = target;
    const p = pending.current;
    pending.current = null;
    const rotor = rotorRef.current;
    const instant = reducedMotion();
    if (!instant) rotor?.setAttribute('data-spinning', '');
    if (p && p.id === selectedId) s.spinTo(p.to, { v0: p.v0, instant });
    else s.spinTo(s.current + shortestDelta(s.current, target), { instant });
  }, [target, selectedId]);

  /** Pointer angle about the wheel centre, and distance from it in viewBox units. */
  const pointerPolar = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    return { phi: Math.atan2(dy, dx), r: Math.hypot(dx, dy) / (rect.width / VB), px: rect.width / VB };
  }, []);

  /** Spin to entry i, choosing the turn that continues from where a drag would coast to. */
  const snapTo = useCallback((i: number, from: number, v0: number) => {
    const { items: its, angles: as, selectedId: cur, onSelect: select } = latest.current;
    const s = spinner.current;
    if (!s || i < 0) return;
    const goal = rotationFor(as[i]);
    const to = from + shortestDelta(from, goal);
    if (its[i].id === cur) {
      const instant = reducedMotion();
      if (!instant) rotorRef.current?.setAttribute('data-spinning', '');
      s.spinTo(to, { v0, instant });
    } else {
      pending.current = { id: its[i].id, to, v0 };
      select(its[i].id);
    }
  }, []);

  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  const onRotorPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (drag.current || !spinner.current) return;
      const { phi } = pointerPolar(e.clientX, e.clientY);
      drag.current = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, lastPhi: phi, angle: spinner.current.current, active: false };
      suppressClick.current = false;

      const move = (ev: PointerEvent) => {
        const d = drag.current;
        const s = spinner.current;
        if (!d || !s || ev.pointerId !== d.pointerId) return;
        if (!d.active) {
          if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < DRAG_SLOP) return;
          d.active = true;
          d.angle = s.current;
          rotorRef.current?.setAttribute('data-spinning', '');
          rotorRef.current?.setAttribute('data-dragging', '');
          onHover(null, 0, 0);
        }
        const p = pointerPolar(ev.clientX, ev.clientY).phi;
        d.angle += shortestDelta(d.lastPhi, p);
        d.lastPhi = p;
        s.drag(d.angle);
      };
      const end = (ev: PointerEvent) => {
        const d = drag.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        drag.current = null;
        rotorRef.current?.removeAttribute('data-dragging');
        const s = spinner.current;
        if (!d.active || !s) return;
        suppressClick.current = ev.type === 'pointerup';
        const v = s.release();
        const coast = s.current + coastDistance(v);
        snapTo(nearestToIndicator(latest.current.angles, coast), coast, v);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
    [onHover, pointerPolar, snapTo],
  );

  // A tap on a mark selects it (the mark's own handler); a tap elsewhere on the disc selects the entry nearest
  // that moment, preferring one inside the era that was tapped.
  const onRotorClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        e.stopPropagation();
        return;
      }
      if ((e.target as Element).closest('.kc-mark')) return;
      const s = spinner.current;
      const { angles: as } = latest.current;
      if (!s || as.length === 0) return;
      const { phi, r } = pointerPolar(e.clientX, e.clientY);
      if (r < R_INNER - 14 || r > R_OUTER + 16) return;
      const at = phi - s.current;
      const era = SEGMENT_ANGLES.find(({ a0, a1 }) => turnsFrom(a0, at) <= a1 - a0);
      const inEra = era ? as.map((a, i) => ({ a, i })).filter(({ a }) => a >= era.a0 && a <= era.a1) : [];
      const pool = inEra.length ? inEra : as.map((a, i) => ({ a, i }));
      const k = nearestToAngle(
        pool.map((p) => p.a),
        s.current,
        phi,
      );
      if (k >= 0) snapTo(pool[k].i, s.current, 0);
    },
    [pointerPolar, snapTo],
  );

  // A drag that ends on a mark must not also select that mark.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const swallow = (e: MouseEvent) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    };
    el.addEventListener('click', swallow, true);
    return () => el.removeEventListener('click', swallow, true);
  }, []);

  // Scroll turns the wheel only with intent: the Kaalchakra has keyboard focus, or a mouse has rested on the
  // wheel while the page was still. Otherwise the event is left alone and the page scrolls as usual.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let enteredAt: number | null = null;
    let scrolledAt = 0;
    let acc = 0;
    let lastWheel = 0;
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') enteredAt = performance.now();
    };
    const onLeave = () => {
      enteredAt = null;
    };
    const onScroll = () => {
      scrolledAt = performance.now();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const now = performance.now();
      const focused = Boolean(el.closest('.kc-canvas')?.contains(document.activeElement)) && document.activeElement !== document.body;
      const resting = enteredAt !== null && now - enteredAt > HOVER_INTENT_MS && now - scrolledAt > HOVER_INTENT_MS;
      if (!focused && !resting) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
      if (now - lastWheel > 250) acc = 0;
      lastWheel = now;
      if (Math.abs(delta) >= 50) {
        acc = 0;
        latest.current.onStep(delta > 0 ? 1 : -1);
        return;
      }
      acc += delta;
      if (Math.abs(acc) >= 60) {
        latest.current.onStep(acc > 0 ? 1 : -1);
        acc = 0;
      }
    };
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const selected = selIdx >= 0 ? items[selIdx] : undefined;
  const d = selected ? primaryDating(selected, lens) : undefined;
  const core = selected
    ? { lines: wrapText(selected.name, 17, 2), sub: d ? formatDatingRange(d, cal) : '', tag: d?.lens === 'tradition' ? 'Tradition' : undefined, kind: KIND_LABELS[selected.kind] }
    : undefined;
  const refs = useMemo(() => ({ container: containerRef, rotor: rotorRef, overlay: overlayRef }), []);

  return (
    <WheelSvg
      items={items}
      kinds={kinds}
      lens={lens}
      selectedId={selectedId}
      core={core}
      rotation={initialRotation}
      indicator
      refs={refs}
      onSelect={onSelect}
      onHover={onHover}
      onRotorPointerDown={onRotorPointerDown}
      onRotorClick={onRotorClick}
    />
  );
}

const Wheel = memo(WheelImpl);
export default Wheel;
