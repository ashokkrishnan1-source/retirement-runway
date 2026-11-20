// Copies tools/vault-snippet.js (the shared "Encrypted copies" code) into every tool page, between the
// VAULT:START and VAULT:END markers. Run after editing the snippet:   node tools/sync-vault.js
// `node tools/sync-vault.js --check` exits 1 if a page is out of date (used by the checks).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const snip = fs.readFileSync(path.join(__dirname, 'vault-snippet.js'), 'utf8').trim();
const re = /\/\* VAULT:START[\s\S]*?\/\* VAULT:END \*\//;
let stale = 0;
for (const f of ['index.html', 'open-this-first/index.html', 'home/index.html', 'prism/index.html']) {
  const p = path.join(root, f), s = fs.readFileSync(p, 'utf8');
  if (!re.test(s)) throw new Error(f + ' has no VAULT markers');
  const out = s.replace(re, () => snip);
  if (out !== s) { stale++; if (!process.argv.includes('--check')) { fs.writeFileSync(p, out); console.log('Updated ' + f) } else console.log('Out of date: ' + f) }
}
if (process.argv.includes('--check') && stale) process.exit(1);
