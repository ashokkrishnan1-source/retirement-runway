#!/usr/bin/env node
'use strict';
/* Prism research, the online route: the queue comes out of the store of the owner's claude.ai link, and the briefs go
   back into it. No AI and no network here: this only checks and shapes files. The store itself is read and written
   by the session, with its tool for an artifact's data, as the owner.

     node tools/research/desk.js list <queue document.json> <reading-list.json>
         The queue as the store holds it (the document data/users/me/prism-queue). Checks its shape, writes the
         reading list that edgar.js takes, and says which companies it holds.
     node tools/research/desk.js docs <out folder> <reader> <company folder> ... [--index <index document.json>]
         For each company folder that holds a checked brief, writes <out folder>/briefs/<SYMBOL>.json, the document
         for data/users/me/prism-read/briefs/<SYMBOL>. And <out folder>/prism-read.json, the index document
         data/users/me/prism-read: the entries the store already has (--index) are kept, the new ones added.
         <reader> names what did the reading, for the line under each brief.

   Prism's page ("the queue" in prism/index.html) writes the queue, listens to the index, fetches each brief it does
   not hold yet and cleans it the way it cleans a research file. A company leaves the queue when the index says it
   was read after it was queued, so the index is written last. */
const fs = require('fs'), path = require('path');

const SYMOK = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/, CIKOK = /^\d{1,10}$/;
const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const str = (x, n) => typeof x === 'string' ? x.slice(0, n) : '';
const jread = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
/* a document as the store's tool saves it may be wrapped: take the part that has the wanted field */
const unwrap = (o, key) => !o || typeof o !== 'object' ? null : o[key] !== undefined ? o : ['data', 'fields', 'doc', 'document'].map(k => o[k]).find(x => x && typeof x === 'object' && x[key] !== undefined) || null;

/* one company of a reading list: names and the regulator's numbers, nothing else */
function entry(c) {
  if (!c || typeof c.sym !== 'string' || !SYMOK.test(c.sym) || !CIKOK.test(String(c.cik || ''))) return null;
  return {sym: c.sym, name: str(c.name, 120), cik: String(c.cik), industry: str(c.industry, 80), kind: str(c.kind, 30), tenk: isDay(c.tenk) ? c.tenk : null, have: isDay(c.have) ? c.have : null, asked: str(c.asked, 30) || null,
    rivals: (Array.isArray(c.rivals) ? c.rivals : []).slice(0, 8).filter(o => o && typeof o.sym === 'string' && SYMOK.test(o.sym) && CIKOK.test(String(o.cik || ''))).map(o => ({sym: o.sym, name: str(o.name, 120), cik: String(o.cik)}))};
}
function list(doc) {
  const o = unwrap(doc, 'companies'); if (!o || o.app !== 'prism-reading-list' || !Array.isArray(o.companies)) throw new Error('That is not a queue from Prism');
  const seen = {}, companies = o.companies.slice(0, 200).map(entry).filter(c => c && !seen[c.sym] && (seen[c.sym] = 1));
  return {v: 1, app: 'prism-reading-list', made: new Date().toISOString().slice(0, 10), fileDate: isDay(o.fileDate) ? o.fileDate : null, companies};
}
/* the documents that go back to the store: one for each brief, and the index of them */
function docs(outDir, reader, dirs, indexDoc, now) {
  const at = now || new Date().toISOString(), by = String(reader || '').replace(/[^\w .\-]/g, '').slice(0, 40), old = unwrap(indexDoc, 'done'), done = {}, wrote = [], skipped = [];
  if (old && old.done && typeof old.done === 'object') Object.keys(old.done).forEach(k => { const d = old.done[k]; if (SYMOK.test(k) && d && typeof d.at === 'string') done[k] = {at: str(d.at, 30), read: isDay(d.read) ? d.read : null, by: str(d.by, 40), k: isDay(d.k) ? d.k : null, n: +d.n > 0 ? Math.round(+d.n) : 0}; });
  fs.mkdirSync(path.join(outDir, 'briefs'), {recursive: true});
  dirs.forEach(d => { const b = jread(path.join(d, 'brief.checked.json'));
    if (!b || b.v !== 1 || typeof b.sym !== 'string' || !SYMOK.test(b.sym) || !(b.kept > 0)) { skipped.push(path.basename(d)); return; }
    const brief = Object.assign({}, b, by && !b.by ? {by} : {}), k = (brief.sources || []).find(x => x && x.id === 'k');
    fs.writeFileSync(path.join(outDir, 'briefs', b.sym + '.json'), JSON.stringify({v: 1, sym: b.sym, at, by: brief.by || '', brief}));
    done[b.sym] = {at, read: isDay(b.read) ? b.read : null, by: brief.by || '', k: k && isDay(k.filed) ? k.filed : null, n: b.kept}; wrote.push(b.sym); });
  fs.writeFileSync(path.join(outDir, 'prism-read.json'), JSON.stringify({v: 1, at, done}));
  return {wrote, skipped, at};
}

module.exports = {list, docs, entry, unwrap};
if (require.main === module) {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  if (cmd === 'list' && a && b) { const l = list(jread(a)); fs.writeFileSync(b, JSON.stringify(l, null, 1));
    console.log(l.companies.length + (l.companies.length === 1 ? ' company' : ' companies') + ' in the queue' + (l.companies.length ? ': ' + l.companies.map(c => c.sym + (c.have ? ' (read before, report of ' + c.have + ')' : '')).join(', ') : '') + '\nWrote ' + b); }
  else if (cmd === 'docs' && a && b && rest.length) { const i = rest.indexOf('--index'), idx = i >= 0 ? jread(rest[i + 1]) : null, dirs = i >= 0 ? rest.slice(0, i).concat(rest.slice(i + 2)) : rest;
    if (i >= 0 && !idx) { console.error('Cannot read the index document ' + rest[i + 1]); process.exit(1); }
    const r = docs(a, b, dirs, idx);
    console.log('Wrote ' + r.wrote.length + ' brief' + (r.wrote.length === 1 ? '' : 's') + ' under ' + path.join(a, 'briefs') + (r.wrote.length ? ': ' + r.wrote.join(', ') : '') + (r.skipped.length ? '\nNo checked brief, left out: ' + r.skipped.join(', ') : '') +
      '\nWrote the index, ' + path.join(a, 'prism-read.json') + '\nSet each brief at data/users/me/prism-read/briefs/<SYMBOL>, then the index at data/users/me/prism-read.'); }
  else { console.log('usage: node tools/research/desk.js list <queue document.json> <reading-list.json>\n       node tools/research/desk.js docs <out folder> <reader> <company folder> ... [--index <index document.json>]'); process.exitCode = 1; }
}
