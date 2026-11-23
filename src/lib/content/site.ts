/** Site-wide data helpers for server components. */

import { loadContentOrThrow } from './load';
import { buildKaalchakraIndex, type KcItem } from './kaalchakra';
import { buildCitationIndex, type CitedBy } from './references';
import { CATEGORY_LABELS, type Category } from './labels';

import { REPO_URL } from './site-url';
export { SITE_URL, REPO_URL } from './site-url';

export const CATEGORY_META: Record<Category, { title: string; description: string }> = {
  history: { title: CATEGORY_LABELS.history, description: 'Polities, peoples and turning points of the subcontinent, from the first stone tools to the Republic.' },
  philosophy: { title: CATEGORY_LABELS.philosophy, description: 'The Vedas, Upanishads, darshanas and the living traditions of thought.' },
  science: { title: CATEGORY_LABELS.science, description: 'Mathematics, astronomy, medicine and metallurgy, with the evidence for each claim.' },
  literature: { title: CATEGORY_LABELS.literature, description: 'Itihasa, kavya, Sangam poetry and the literatures of every Indian language.' },
  'art-and-culture': { title: CATEGORY_LABELS['art-and-culture'], description: 'Architecture, sculpture, painting, dance, textiles and food.' },
  music: { title: CATEGORY_LABELS.music, description: 'From Vedic chant to Hindustani and Carnatic classical traditions.' },
  language: { title: CATEGORY_LABELS.language, description: 'Sanskrit and the languages of Bharat: scripts, grammar from Panini onward, and how the words carry the civilisation.' },
};

let index: KcItem[] | undefined;

export function getGraph() {
  return loadContentOrThrow();
}

export function getIndex(): KcItem[] {
  if (!index || process.env.NODE_ENV === 'development') index = buildKaalchakraIndex(getGraph());
  return index;
}

let citations: Map<string, CitedBy> | undefined;

/** Source id -> every entity, article, correction, quiz and published debate that cites it. */
export function getCitationIndex(): Map<string, CitedBy> {
  if (!citations || process.env.NODE_ENV === 'development') citations = buildCitationIndex(getGraph());
  return citations;
}

export function issueUrl(title: string, body: string): string {
  const p = new URLSearchParams({ title, body, labels: 'content' });
  return `${REPO_URL}/issues/new?${p.toString()}`;
}
