// Reverts HTTrack's URL rewriting inside Next.js/Turbopack JS chunks and HTML pages.
const fs = require('fs');
const path = require('path');
const site = path.join(__dirname, '..', 'svisyv.in.ua');
const dir = path.join(site, '_next', 'static', 'chunks');
const backupRoot = path.join(__dirname, '..', '.httrack-backup');

function backupAndWrite(p, src, out, sub) {
  const b = path.join(backupRoot, sub, path.basename(p));
  fs.mkdirSync(path.dirname(b), { recursive: true });
  if (!fs.existsSync(b)) fs.writeFileSync(b, src);
  fs.writeFileSync(p, out);
  console.log('fixed', sub + '/' + path.basename(p));
}

const jsRules = [
  [/"static\/chunks\/([0-9a-f]+)\.html"/g, '"static/chunks/$1.js"'],
  [/"_next\/index\.html"/g, '"/_next/"'],
  [/"ROOT\/node_modules\/next\/dist\/compiled\/process\/index\.html"/g, '"/ROOT/node_modules/next/dist/compiled/process/"'],
];

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const p = path.join(dir, f);
  const src = fs.readFileSync(p, 'utf8');
  let out = src;
  for (const [re, rep] of jsRules) out = out.replace(re, rep);
  if (out !== src) backupAndWrite(p, src, out, 'chunks');
}

// Top-level HTML pages: make _next asset URLs absolute again (as in the original site)
const htmlRules = [
  [/(src|href)="_next\//g, '$1="/_next/'],
];
for (const f of fs.readdirSync(site)) {
  if (!f.endsWith('.html')) continue;
  const p = path.join(site, f);
  const src = fs.readFileSync(p, 'utf8');
  let out = src;
  for (const [re, rep] of htmlRules) out = out.replace(re, rep);
  if (out !== src) backupAndWrite(p, src, out, 'pages');
}
