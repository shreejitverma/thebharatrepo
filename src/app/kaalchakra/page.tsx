import type { Metadata } from 'next';
import Kaalchakra from '@/components/kaalchakra/Kaalchakra';
import { getIndex } from '@/lib/content/site';

export const metadata: Metadata = {
  title: 'Kaalchakra: the wheel of time',
  description: 'Every entry in The Bharat Repo on one wheel of time, from the traditional start of the kalpa to today, in the Scholarship and Tradition lenses.',
};

export default function KaalchakraPage() {
  const items = getIndex();
  return (
    <div className="main-content">
      <p className="eyebrow">The Kaalchakra</p>
      <h1>The wheel of time</h1>
      <p className="lede" style={{ marginTop: 0 }}>
        {items.length} entries from the archive, each placed in time by its evidence. Switch lenses to see where scholarship and tradition agree, and where they differ.
      </p>
      <Kaalchakra items={items} />
    </div>
  );
}
