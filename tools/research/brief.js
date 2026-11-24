#!/usr/bin/env node
'use strict';
/* Prism research, step 3: check and pack. No AI here.

     node tools/research/brief.js check <company folder> <brief.json>     checks one brief against the filings
     node tools/research/brief.js pack <out.json> <company folder> ...    packs the checked briefs for Prism

   A brief is written by a reader (READING.md). Every point in it carries a passage said to be copied from a filing.
   `check` looks each passage up in the text of the filing it names. A point whose passage is not there is thrown
   away, and the brief says how many were. Nothing a reader wrote reaches Prism without passing this.
   `pack` puts the checked briefs into one research file, with each company's ten-year table of reported figures,
   for the "Load a research file" button on Prism's page. */
const fs = require('fs'), path = require('path');

const SECTIONS = ['stands', 'rivals', 'namedBy', 'worries', 'run', 'owners', 'strengths', 'warnings'];
/* Text as the eye reads it: one case, plain quotes and dashes, no table bars, single spaces. */
const norm = t => String(t == null ? '' : t).toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-').replace(/ /g, ' ')
  .replace(/\s*\|\s*/g, ' ').replace(/[*•]/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,.;:)%])/g, '$1').replace(/([($])\s+/g, '$1').trim();
/* Is the passage in the text? Parts split by " ... " must each be there, in order. A part needs at least 12 characters. */
function found(passage, text) {
  const parts = String(passage == null ? '' : passage).split(/\s*(?:\[\.{3}\]|\.{3,}|\u2026)\s*/).map(norm).filter(Boolean); if (!parts.length) return false;
  let from = 0;
  for (const p of parts) { if (p.length < 12) return false; const i = text.indexOf(p, from); if (i < 0) return false; from = i + p.length; }
  return true;
}
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
const jread = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const isSec = u => /^https:\/\/www\.sec\.gov\//.test(String(u || ''));

function check(dir, file) {
  const b = jread(file), meta = jread(path.join(dir, 'meta.json')); if (!b || !meta) throw new Error('Cannot read the brief or the folder\'s meta.json');
  const problems = [];
  if (b.v !== 1 || !b.sym || b.sym !== meta.sym) problems.push('the brief is not for ' + meta.sym);
  /* the texts a passage may come from: the company's own filings in full, and what was collected from other companies */
  const own = {}; meta.sources.forEach(s => { own[s.id] = norm(read(path.join(dir, s.id + '.full.txt'))); });
  const others = norm((jread(path.join(dir, 'rivals.json')) || []).map(r => r.competition + '\n' + (r.mentions || []).join('\n')).join('\n') + '\n' + (jread(path.join(dir, 'namedby.json')) || []).map(r => (r.paragraphs || []).join('\n')).join('\n'));
  const known = {}; (jread(path.join(dir, 'rivals.json')) || []).concat(jread(path.join(dir, 'namedby.json')) || []).forEach(r => { known[r.url] = 1; });
  /* sources: the company's own come from the folder, never from the reader; the reader's must be ones the folder holds */
  const src = {}; meta.sources.forEach(s => { src[s.id] = {id: s.id, form: s.form, filed: s.filed, period: s.period || null, url: s.url}; });
  (b.sources || []).forEach(s => { if (!s || src[s.id] || !/^r\d+$/.test(s.id || '')) return; if (!isSec(s.url) || !known[s.url]) { problems.push('source ' + s.id + ' is not a filing in the folder'); return; }
    src[s.id] = {id: s.id, form: String(s.form || '10-K').slice(0, 12), who: String(s.who || '').slice(0, 120), filed: /^\d{4}-\d{2}-\d{2}$/.test(s.filed || '') ? s.filed : null, url: s.url}; });
  const out = {v: 1, sym: meta.sym, cik: meta.cik, name: meta.name, read: /^\d{4}-\d{2}-\d{2}$/.test(b.read || '') ? b.read : meta.fetched, sources: [], business: String(b.business || '').slice(0, 700), sections: {}, rivalSymbols: [], cant: [], kept: 0, dropped: 0};
  const used = {};
  SECTIONS.forEach(k => { out.sections[k] = [];
    ((b.sections || {})[k] || []).slice(0, 8).forEach(pt => { if (!pt || typeof pt.t !== 'string' || typeof pt.q !== 'string') { out.dropped++; return; }
      const s = src[pt.s], text = !s ? null : own[pt.s] != null ? own[pt.s] : others;
      if (!text || !found(pt.q, text)) { out.dropped++; problems.push(k + ': passage not found in ' + (pt.s || 'no source') + ': "' + pt.q.slice(0, 70) + '..."'); return; }
      out.sections[k].push({t: pt.t.slice(0, 600), q: pt.q.slice(0, 600), s: pt.s, tone: pt.tone === 'good' || pt.tone === 'warn' ? pt.tone : ''}); used[pt.s] = 1; out.kept++; }); });
  out.sources = Object.keys(src).filter(id => used[id] || own[id] != null).map(id => src[id]);
  out.rivalSymbols = (Array.isArray(b.rivalSymbols) ? b.rivalSymbols : []).map(s => String(s).toUpperCase().trim()).filter(s => /^[A-Z][A-Z0-9.\-]{0,7}$/.test(s) && s !== meta.sym).slice(0, 8);
  out.cant = (Array.isArray(b.cant) ? b.cant : []).map(s => String(s).slice(0, 300)).filter(Boolean).slice(0, 8);
  const ty = jread(path.join(dir, 'tenyears.json')); if (ty) out.tenYears = ty;
  /* the brief must not say what to do with the shares: the rule is Prism's, and a reader can slip */
  const all = [out.business].concat(SECTIONS.map(k => out.sections[k].map(p => p.t).join(' ')), out.cant).join(' ');
  const advice = all.match(/\b(buy|sell|hold) (the |these |this |its )?(shares?|stock)\b|\bundervalued\b|\bovervalued\b|\bprice target\b|\bwe recommend\b|\bshould (buy|sell|invest)\b/i);
  if (advice) problems.push('it reads like advice: "' + advice[0] + '"');
  fs.writeFileSync(path.join(dir, 'brief.checked.json'), JSON.stringify(out, null, 1));
  return {out, problems, advice: !!advice};
}

function pack(outFile, dirs, skipped) {
  const briefs = {}; let n = 0;
  dirs.forEach(d => { const b = jread(path.join(d, 'brief.checked.json')); if (!b || !b.sym || !b.kept) { if (skipped) skipped.push(path.basename(d)); return; } briefs[b.sym] = b; n++; });
  fs.writeFileSync(outFile, JSON.stringify({v: 1, app: 'prism-research', made: new Date().toISOString().slice(0, 10), briefs}));
  return n;
}

module.exports = {norm, found, check, pack, SECTIONS};
if (require.main === module) {
  const [cmd, a, ...rest] = process.argv.slice(2);
  if (cmd === 'check' && a && rest[0]) { const r = check(a, rest[0]); console.log(r.out.sym + ': ' + r.out.kept + ' points kept, ' + r.out.dropped + ' thrown away'); r.problems.forEach(p => console.log('   ' + p)); process.exitCode = r.advice ? 2 : 0; }
  else if (cmd === 'pack' && a && rest.length) { const skipped = [], n = pack(a, rest, skipped); console.log('Packed ' + n + ' briefs into ' + a + (skipped.length ? '. No checked brief, left out: ' + skipped.join(', ') : '')); }
  else { console.log('usage: node tools/research/brief.js check <company folder> <brief.json> | pack <out.json> <company folder> ...'); process.exitCode = 1; }
}
