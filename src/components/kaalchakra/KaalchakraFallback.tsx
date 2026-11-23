import Link from 'next/link';
import { KINDS } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import PanelIntro from './PanelIntro';
import Toolbar, { WheelScaleNote } from './Toolbar';
import WheelSvg from './WheelSvg';
import { orderedItems, toPlacedItem } from './shared';
import { DEFAULT } from './urlState';

const ALL_KINDS = new Set(KINDS);

/**
 * Server-rendered stand-in for the interactive Kaalchakra, shown before it loads and without JavaScript. It renders
 * the default view (the wheel) with the same toolbar, scale note and panel elements as the interactive one, the
 * controls as inert skeletons, so every block has the same size at every breakpoint and the swap shifts nothing.
 */
export default function KaalchakraFallback({ items }: { items: KcItem[] }) {
  const placed = orderedItems(items, DEFAULT.lens);
  return (
    <div className="kc">
      <Toolbar view={DEFAULT.view} lens={DEFAULT.lens} cal={DEFAULT.cal} q={DEFAULT.q} kinds={ALL_KINDS} filtersOpen={false} activeFilters={0} />
      <div className="kc-stage">
        <div className="kc-canvas">
          <WheelSvg items={placed.map(toPlacedItem)} kinds={KINDS} lens={DEFAULT.lens} selectedId={null} />
          <WheelScaleNote />
        </div>
        <PanelIntro view={DEFAULT.view} total={placed.length}>
          {/* Only without JavaScript, so it takes no space while the interactive Kaalchakra loads. */}
          <noscript>
            <p>
              <Link href="/archive" prefetch={false}>
                Browse every entry in the archive
              </Link>
            </p>
          </noscript>
        </PanelIntro>
      </div>
    </div>
  );
}
