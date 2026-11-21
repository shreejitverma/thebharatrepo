/** Site-wide data helpers for server components. */

import { loadContentOrThrow } from './load';
import { buildKaalchakraIndex, type KcItem } from './kaalchakra';
import { CATEGORIES } from './schema';

import { REPO_URL } from './site-url';
export { SITE_URL, REPO_URL } from './site-url';

export const CATEGORY_META: Record<(typeof CATEGORIES)[number], { title: string; description: string }> = {
  history: { title: 'History', description: 'Polities, peoples and turning points of the subcontinent, from the first stone tools to the Republic.' },
  philosophy: { title: 'Philosophy', description: 'The Vedas, Upanishads, darshanas and the living traditions of thought.' },
  science: { title: 'Science', description: 'Mathematics, astronomy, medicine and metallurgy, with the evidence for each claim.' },
  literature: { title: 'Literature', description: 'Itihasa, kavya, Sangam poetry and the literatures of every Indian language.' },
  'art-and-culture': { title: 'Art and Culture', description: 'Architecture, sculpture, painting, dance, textiles and food.' },
  music: { title: 'Music', description: 'From Vedic chant to Hindustani and Carnatic classical traditions.' },
};

let index: KcItem[] | undefined;

export function getGraph() {
  return loadContentOrThrow();
}

export function getIndex(): KcItem[] {
  if (!index || process.env.NODE_ENV === 'development') index = buildKaalchakraIndex(getGraph());
  return index;
}

export function issueUrl(title: string, body: string): string {
  const p = new URLSearchParams({ title, body, labels: 'content' });
  return `${REPO_URL}/issues/new?${p.toString()}`;
}
