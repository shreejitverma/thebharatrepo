import { scaffoldContent } from './content-new';

const [mode, ...args] = process.argv.slice(2);

if (mode === 'entity' || mode === 'source') process.exitCode = scaffoldContent(mode, args);
else {
  console.log('error: Run npm run content:new or npm run content:new-source.');
  process.exitCode = 2;
}
