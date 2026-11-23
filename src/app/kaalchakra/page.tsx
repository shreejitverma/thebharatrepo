import type { Metadata } from 'next';
import { Suspense } from 'react';
import { preload } from 'react-dom';
import Kaalchakra from '@/components/kaalchakra/Kaalchakra';
import KaalchakraFallback from '@/components/kaalchakra/KaalchakraFallback';
import { KC_ITEMS_URL } from '@/lib/content/public-data';
import { getGraph, getIndex } from '@/lib/content/site';

export const metadata: Metadata = {
  title: 'Kaalchakra: the wheel of time',
  description: 'Every entry in The Bharat Repo on one wheel of time, from the traditional start of the kalpa to today, in the Scholarship and Tradition lenses.',
};

export default function KaalchakraPage() {
  const items = getIndex();
  // Start the items download with the HTML, in parallel with the scripts; fetch() then reuses this response.
  preload(KC_ITEMS_URL, { as: 'fetch', crossOrigin: 'anonymous' });
  const aliases = Object.fromEntries(getGraph().aliases);
  return (
    <div className="main-content">
      <p className="eyebrow">The Kaalchakra</p>
      <h1>The wheel of time</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        {items.length} entries from the archive, each placed in time by its evidence. Switch lenses to see where scholarship and tradition agree, and where they differ.
      </p>
      {/* Kaalchakra reads its state from the search params and fetches its items, so static prerendering stops at this boundary. */}
      <Suspense fallback={<KaalchakraFallback items={items} />}>
        <Kaalchakra aliases={aliases} />
      </Suspense>
    </div>
  );
}
