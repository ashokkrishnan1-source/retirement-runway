// Copies the shared snippets into the pages that carry them, between START and END markers.
// Run after editing a snippet:   node tools/sync-vault.js
// `node tools/sync-vault.js --check` exits 1 if a page is out of date (used by the checks).
//   VAULT     tools/vault-snippet.js   every tool, the home page and the guides: encrypted copies, the link back to the
//                                      home page, the note that lets a refresh return to the page that was open, and
//                                      opening a tool at the place a guide asks for
//   GUIDECSS  tools/guide-snippet.css  the guides: their layout (each guide sets its own colors)
//   GUIDEJS   tools/guide-snippet.js   the guides: "Show me" links and the lesson that was open last
// A guide has nothing to save; it carries the VAULT snippet for the link back and the refresh note.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const tools = ['index.html', 'open-this-first/index.html', 'home/index.html', 'prism/index.html'];
const guides = ['guide/index.html', 'prism/guide/index.html'];
const sets = [['VAULT', 'vault-snippet.js', tools.concat(guides)], ['GUIDECSS', 'guide-snippet.css', guides], ['GUIDEJS', 'guide-snippet.js', guides]];
let stale = 0;
const text = {}, read = f => text[f] === undefined ? (text[f] = fs.readFileSync(path.join(root, f), 'utf8')) : text[f], before = {};
for (const [name, file, pages] of sets) {
  const snip = fs.readFileSync(path.join(__dirname, file), 'utf8').trim();
  const re = new RegExp('/\\* ' + name + ':START[\\s\\S]*?/\\* ' + name + ':END \\*/');
  if (!re.test(snip) || snip.replace(re, '') !== '') throw new Error(file + ' must start with the ' + name + ':START marker and end with ' + name + ':END');
  for (const f of pages) {
    const s = read(f); if (before[f] === undefined) before[f] = s;
    if (!re.test(s)) throw new Error(f + ' has no ' + name + ' markers');
    text[f] = s.replace(re, () => snip);
  }
}
for (const f of Object.keys(text)) if (text[f] !== before[f]) {
  stale++;
  if (!process.argv.includes('--check')) { fs.writeFileSync(path.join(root, f), text[f]); console.log('Updated ' + f); } else console.log('Out of date: ' + f);
}
if (process.argv.includes('--check') && stale) process.exit(1);
