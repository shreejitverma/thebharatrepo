import Link from 'next/link';
import { KINDS } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import WheelSvg from './WheelSvg';
import { orderedItems, toPlacedItem } from './shared';

/**
 * Server-rendered stand-in for the interactive Kaalchakra, shown before it loads and without JavaScript.
 * Same layout and default view (the wheel), so the swap does not shift the page.
 */
export default function KaalchakraFallback({ items }: { items: KcItem[] }) {
  return (
    <div className="kc">
      <div className="kc-stage">
        <div className="kc-canvas">
          <WheelSvg items={orderedItems(items, 'both').map(toPlacedItem)} kinds={KINDS} lens="both" selectedId={null} />
          <div className="kc-scale-note">Each era has its own scale: deep time is logarithmic, history is linear.</div>
        </div>
        <aside className="kc-panel" aria-label="How to read the Kaalchakra">
          <p className="eyebrow">How to read the wheel</p>
          <h2>One wheel, two lenses</h2>
          <p className="kc-panel__summary">
            Time runs clockwise from the traditional start of the present kalpa, at the top, to today. Each ring holds one kind of entry.
          </p>
          <p>
            <Link href="/archive">Browse every entry in the archive</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
