import type { KcItem } from '@/lib/content/kaalchakra';
import { KC_ITEMS_URL } from '@/lib/content/public-data';

export type ItemsResult = { ok: true; items: KcItem[] } | { ok: false; error: string };

let pending: Promise<ItemsResult> | null = null;

/**
 * One shared request per page load, so React `use` sees the same promise on every render and on client-side
 * navigation back to the Kaalchakra. A failure is cached too: retrying in render would loop, so the error
 * state offers a reload instead.
 */
export function loadItems(): Promise<ItemsResult> {
  if (typeof window === 'undefined') throw new Error('Kaalchakra items load in the browser only; the page must render its server fallback during prerendering');
  pending ??= fetch(KC_ITEMS_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<KcItem[]>;
    })
    .then(
      (items): ItemsResult => ({ ok: true, items }),
      (e: unknown): ItemsResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
  return pending;
}
