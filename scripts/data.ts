import path from 'node:path';
import { ROOT } from '../src/lib/content/load';
import { latestContentCommitDate } from './content-commit-date';
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
  const generatedAt = await latestContentCommitDate(ROOT);
  const graph = loadPublicContent();
  const dir = path.join(ROOT, 'public', 'data');
  const counts = mode === 'verify' ? verifyDataExport(dir, graph, generatedAt) : writeDataExport(dir, graph, generatedAt);
  console.log(`${command} ok: ${Object.entries(counts).map(([name, count]) => `${count} ${name}`).join(', ')} (content commit ${generatedAt})`);
}

main().catch((error: Error) => {
  console.log(`error: ${error.message}${error.cause instanceof Error ? `\n  ${error.cause.message}` : ''}`);
  process.exitCode = 1;
});
