import path from 'node:path';
import { ROOT } from '../src/lib/content/load';
import { contentCommitDate } from './content-commit-date';
import { loadPublicContent, verifyDataExport, writeDataExport } from './data-export';

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const command = mode === 'verify' ? 'data:verify-export' : 'data:export';
  if (args.length === 1 && args[0] === '--help') {
    console.log(`usage: npm run ${command}`);
    return;
  }
  if (args.length || (mode !== 'verify' && mode !== 'write')) {
    console.log(`error: Unexpected arguments. Usage is npm run ${command}.`);
    process.exitCode = 2;
    return;
  }
  const commit = await contentCommitDate(ROOT);
  const graph = loadPublicContent();
  const dir = path.join(ROOT, 'public', 'data');
  const manifest = mode === 'verify' ? verifyDataExport(dir, graph, commit) : writeDataExport(dir, graph, commit);
  const counts = Object.entries(manifest.counts).map(([name, count]) => `${count} ${name}`).join(', ');
  console.log(`${command} ok: ${counts} (content commit date ${commit.date ?? 'unknown'})`);
  if (commit.note) console.log(`warning: ${commit.note} The manifest records the date as null with this note.`);
}

main().catch((error: Error) => {
  console.log(`error: ${error.message}${error.cause instanceof Error ? `\n  ${error.cause.message}` : ''}`);
  process.exitCode = 1;
});
