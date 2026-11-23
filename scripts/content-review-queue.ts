import { assembleContent, readContentRecords } from '../src/lib/content/load';
import { formatReviewQueue } from '../src/lib/content/review-queue';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('usage: npm run content:review-queue');
} else if (args.length) {
  console.log(`error: ${JSON.stringify(`Unexpected argument ${args[0]}; supported flag is --help.`)}`);
  process.exitCode = 2;
} else {
  const { records, errors } = readContentRecords();
  const problems = assembleContent(records, errors).errors.length;
  if (problems) {
    console.log(`error: Fix ${problems} validation problem(s) before using the review queue. Run npm run content:validate.`);
    process.exitCode = 1;
  } else {
    console.log(formatReviewQueue(records));
  }
}
