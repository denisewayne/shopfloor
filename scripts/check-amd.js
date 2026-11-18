#!/usr/bin/env node
/**
 * NetSuite's AMD loader cannot resolve a folder to its index.js the way Node
 * does. Every relative dependency in build/ must point at a real .js file,
 * otherwise the script fails when NetSuite loads it. Run after `npm run build`.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'build');
if (!fs.existsSync(root)) {
  console.error('build/ missing. Run npm run build first.');
  process.exit(1);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []
  );

let bad = 0;
for (const file of walk(root)) {
  const m = fs.readFileSync(file, 'utf8').match(/define\(\[([^\]]*)\]/);
  if (!m) continue;
  for (const dep of m[1].split(',').map((s) => s.trim().replace(/["']/g, ''))) {
    if (!dep.startsWith('.')) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), dep) + '.js')) {
      console.error(`  ${path.relative(root, file)} -> ${dep} (use an explicit path, e.g. './folder/index')`);
      bad++;
    }
  }
}

if (bad) {
  console.error(`${bad} unresolvable AMD import(s).`);
  process.exit(1);
}
console.log('AMD imports: all resolve');
