/** Read-only access to the committed verification cache (content/verification.json). */

import fs from 'node:fs';
import path from 'node:path';

export interface VerifiedImage {
  thumb: string;
  pageUrl: string;
  license: string;
  artist: string;
}

let cache: Record<string, { ok: boolean; thumb?: string; pageUrl?: string; license?: string; artist?: string }> | undefined;

function load() {
  if (!cache) {
    const file = path.join(process.cwd(), 'content', 'verification.json');
    cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }
  return cache!;
}

/** Only images that passed verification are ever rendered. */
export function verifiedImage(commonsFile: string): VerifiedImage | null {
  const hit = load()[`commons:${commonsFile}`];
  if (!hit?.ok || !hit.thumb || !hit.pageUrl) return null;
  return { thumb: hit.thumb, pageUrl: hit.pageUrl, license: hit.license ?? 'unknown', artist: hit.artist ?? '' };
}
