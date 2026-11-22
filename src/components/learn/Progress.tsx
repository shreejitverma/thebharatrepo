'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

/**
 * Per-viewer progress through a learning path, kept only in this browser's localStorage (no account,
 * no server, no tracking of minors). Steps are keyed by their entity id or article reference, so
 * reordering a path keeps the viewer's progress.
 */

const EVENT = 'tbr:learn-progress';

function key(pathId: string): string {
  return `tbr.learn.${pathId}`;
}

function readRaw(pathId: string): string | null {
  try {
    return window.localStorage.getItem(key(pathId));
  } catch {
    return null;
  }
}

/** In-memory fallback so ticking a step still works for this page view when storage is blocked. */
const memory = new Map<string, string>();

function parse(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function write(pathId: string, done: Set<string>): void {
  const raw = JSON.stringify([...done]);
  memory.set(pathId, raw);
  try {
    if (done.size) window.localStorage.setItem(key(pathId), raw);
    else window.localStorage.removeItem(key(pathId));
  } catch {
    // Storage unavailable: progress lasts for this page view only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

function useDone(pathId: string): Set<string> {
  const raw = useSyncExternalStore(
    subscribe,
    () => memory.get(pathId) ?? readRaw(pathId),
    () => null,
  );
  return parse(raw);
}

export function PathProgress({ pathId, steps }: { pathId: string; steps: string[] }) {
  const done = useDone(pathId);
  const n = steps.filter((s) => done.has(s)).length;
  return (
    <div className="progress">
      <div className="progress__head">
        <span role="status" aria-live="polite">
          {n === steps.length ? `All ${steps.length} steps done.` : `${n} of ${steps.length} steps done.`}
        </span>
        {n > 0 ? (
          <button type="button" className="link-button" onClick={() => write(pathId, new Set())}>
            Reset progress
          </button>
        ) : null}
      </div>
      <progress max={steps.length} value={n} aria-label="Steps done" />
      <p className="muted" style={{ fontSize: '0.82rem', margin: '6px 0 0' }}>
        Progress is saved only in this browser.
      </p>
    </div>
  );
}

/** A step card whose border and number show whether the viewer has marked it done. */
export function StepCard({ pathId, step, title, children }: { pathId: string; step: string; title: string; children: ReactNode }) {
  const done = useDone(pathId);
  const isDone = done.has(step);
  const toggle = () => {
    const next = new Set(done);
    if (isDone) next.delete(step);
    else next.add(step);
    write(pathId, next);
  };
  return (
    <li className="step" data-done={isDone}>
      {children}
      <div className="step__actions">
        <label className="step__check">
          <input type="checkbox" checked={isDone} onChange={toggle} />
          <span>
            Done<span className="visually-hidden">: {title}</span>
          </span>
        </label>
      </div>
    </li>
  );
}

/** "n of m steps done" for a path card on the /learn index. */
export function ProgressSummary({ pathId, steps }: { pathId: string; steps: string[] }) {
  const done = useDone(pathId);
  const n = steps.filter((s) => done.has(s)).length;
  return <>{n ? `${n} of ${steps.length} steps done` : `${steps.length} steps`}</>;
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn--primary" onClick={() => window.print()}>
      Print this pack
    </button>
  );
}
