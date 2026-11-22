const { PNG } = require('playwright-core/lib/utilsBundle');
const { execFileSync } = require('child_process');
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const a = PNG.sync.read(execFileSync('git', ['show', `HEAD:${f}`], { maxBuffer: 1 << 26 }));
  const b = PNG.sync.read(fs.readFileSync(f));
  if (a.width !== b.width || a.height !== b.height) { console.log(f, 'size differs'); continue; }
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  console.log(f.split('/').pop(), `${n} px differ of ${a.width * a.height} (${((100 * n) / (a.width * a.height)).toFixed(3)}%)`);
}
