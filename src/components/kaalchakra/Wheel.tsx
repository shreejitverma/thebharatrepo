'use client';

import { memo } from 'react';
import { KIND_LABELS, type Kind } from '@/lib/content/labels';
import type { KcItem } from '@/lib/content/kaalchakra';
import type { Lens } from '@/lib/content/lens';
import type { CalendarSystem } from '@/lib/time';
import WheelSvg from './WheelSvg';
import { formatDating, primaryDating, wrapText } from './shared';

export interface WheelProps {
  items: KcItem[];
  kinds: readonly Kind[];
  lens: Lens;
  selectedId: string | null;
  cal: CalendarSystem;
  onSelect: (id: string) => void;
  onHover: (id: string | null, clientX: number, clientY: number) => void;
  onSegment: (segmentId: string) => void;
}

/** Interactive wheel for the Kaalchakra page; static renders use WheelSvg directly. */
function WheelImpl({ items, kinds, lens, selectedId, cal, onSelect, onHover, onSegment }: WheelProps) {
  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;
  const d = selected ? primaryDating(selected, lens) : undefined;
  const core = selected ? { lines: wrapText(selected.name, 17, 3), sub: d ? formatDating(d, cal) : '', kind: KIND_LABELS[selected.kind] } : undefined;
  return <WheelSvg items={items} kinds={kinds} lens={lens} selectedId={selectedId} core={core} onSelect={onSelect} onHover={onHover} onSegment={onSegment} />;
}

const Wheel = memo(WheelImpl);
export default Wheel;
