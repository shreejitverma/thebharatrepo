'use client';

import { useId, useSyncExternalStore } from 'react';
import { READING_LEVELS, READING_LEVEL_AUDIENCE, READING_LEVEL_LABELS, type ReadingLevel } from '@/lib/content/labels';
import { LEVEL_ATTRIBUTE, LEVEL_PARAM, LEVEL_STORAGE_KEY, parseLevel, shownLevel } from '@/lib/reading-level';

const EVENT = 'tbr:reading-level';

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function snapshot(): ReadingLevel {
  return parseLevel(document.documentElement.getAttribute(LEVEL_ATTRIBUTE)) ?? 'adult';
}

/** The viewer's stored level, or null when none is stored or storage is unavailable. */
export function storedReadingLevel(): ReadingLevel | null {
  try {
    return parseLevel(window.localStorage.getItem(LEVEL_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Applies a level site-wide: <html> attribute, localStorage and, unless `url` is false, the `level`
 * URL parameter (so the address can be shared). Components that own their URL state pass url: false.
 */
export function setReadingLevel(level: ReadingLevel, { url = true }: { url?: boolean } = {}): void {
  const root = document.documentElement;
  if (level === 'adult') root.removeAttribute(LEVEL_ATTRIBUTE);
  else root.setAttribute(LEVEL_ATTRIBUTE, level);
  try {
    window.localStorage.setItem(LEVEL_STORAGE_KEY, level);
  } catch {
    // Storage is unavailable (private mode, blocked site data): the choice still applies to this page.
  }
  if (url) {
    const u = new URL(window.location.href);
    if (level === 'adult') u.searchParams.delete(LEVEL_PARAM);
    else u.searchParams.set(LEVEL_PARAM, level);
    window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The active reading level; "adult" during server rendering and hydration. */
export function useReadingLevel(): ReadingLevel {
  return useSyncExternalStore(subscribe, snapshot, () => 'adult');
}

/**
 * Reading level control. `available` lists the levels this page actually has text for, so the status
 * line can say honestly when a simpler summary is missing and a fuller one is shown instead.
 */
export default function ReadingLevelSwitcher({ available = READING_LEVELS, className }: { available?: readonly ReadingLevel[]; className?: string }) {
  const level = useReadingLevel();
  const statusId = useId();
  const shown = shownLevel(level, available);
  const status =
    shown === level
      ? `Showing ${level === 'adult' ? 'the full text' : `the ${READING_LEVEL_LABELS[level].toLowerCase()} version (${READING_LEVEL_AUDIENCE[level].toLowerCase()})`}.`
      : `No ${READING_LEVEL_LABELS[level].toLowerCase()} version here yet; showing the ${shown === 'adult' ? 'full text' : `${READING_LEVEL_LABELS[shown].toLowerCase()} version`}.`;
  return (
    <div className={`reading-level ${className ?? ''}`}>
      <div className="segmented" role="group" aria-label="Reading level" aria-describedby={statusId}>
        {READING_LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={level === l} onClick={() => setReadingLevel(l)} title={READING_LEVEL_AUDIENCE[l]}>
            {READING_LEVEL_LABELS[l]}
          </button>
        ))}
      </div>
      <p id={statusId} className="reading-level__status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
