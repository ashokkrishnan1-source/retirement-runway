#!/usr/bin/env node
'use strict';
/* Prism research, step 1: fetch. No AI here.

   For each company on a reading list it fetches, from the SEC's EDGAR system, the latest annual report and proxy
   statement, cuts them into the parts worth reading, works out a ten-year table of where the cash went from the
   figures the company reported, and collects what other companies' annual reports say about it. Everything lands in
   a folder per company, ready to be read (see READING.md).

     SEC_CONTACT="Your Name you@example.com" node tools/research/edgar.js fetch reading-list.json [SYM ...]

   SEC_CONTACT is required. The SEC asks every automated reader to say who it is, in each request, and blocks those
   that do not. It is never stored in this repository: pass it in the environment.
   RESEARCH_DIR says where the files go (default: .research/ at the top of the repository, which git ignores).
   Requests are made one at a time, a few a second, and every file is kept, so nothing is fetched twice. */
const fs = require('fs'), path = require('path'), cp = require('child_process');

const DIR = process.env.RESEARCH_DIR || path.join(__dirname, '..', '..', '.research');
const CONTACT = process.env.SEC_CONTACT || '';
const pad = cik => String(cik).replace(/\D/g, '').padStart(10, '0');
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const mk = d => { fs.mkdirSync(d, {recursive: true}); return d; };

/* One request, through curl (it honours the machine's proxy settings). The answer is kept on disk: a second call for
   the same address reads the file. maxAge, in days, refetches a listing that goes stale. */
function get(url, file, maxAge) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0 && (!maxAge || (Date.now() - fs.statSync(file).mtimeMs) < maxAge * 864e5)) return file;
  if (!/^\S+ \S+@\S+\.\S+$|\S+@\S+\.\S+/.test(CONTACT)) throw new Error('Set SEC_CONTACT to a name and an email address: the SEC requires it.');
  if (!/^https:\/\/(www|data|efts)\.sec\.gov\//.test(url)) throw new Error('Not an SEC address: ' + url);
  mk(path.dirname(file)); sleep(180);
  const code = cp.execFileSync('curl', ['-sS', '--compressed', '-m', '120', '-A', CONTACT, '-o', file + '.part', '-w', '%{http_code}', url], {encoding: 'utf8'}).trim();
  if (code !== '200') { try { fs.unlinkSync(file + '.part'); } catch (e) {} throw new Error('HTTP ' + code + ' for ' + url); }
  fs.renameSync(file + '.part', file); return file;
}
const json = (url, file, maxAge) => JSON.parse(fs.readFileSync(get(url, file, maxAge), 'utf8'));

/* ---------- from a filing's HTML to plain text ---------- */
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', bull: '*', middot: '*', reg: '', trade: '', copy: '', sect: 'S', hellip: '...'};
function toText(html) {
  let t = String(html).replace(/<ix:header[\s\S]*?<\/ix:header>/gi, ' ').replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/<\/(td|th)>/gi, ' | ').replace(/<\/(p|div|tr|li|h[1-6]|table)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  t = t.replace(/&#(\d+);/g, (m, n) => { n = +n; return n === 160 ? ' ' : n === 8217 || n === 8216 ? "'" : n === 8220 || n === 8221 ? '"' : n === 8211 || n === 8212 ? '-' : n === 8226 || n === 183 ? '*' : n < 128 ? String.fromCharCode(n) : ' '; })
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const n = parseInt(h, 16); return n === 0xa0 ? ' ' : n === 0x2019 || n === 0x2018 ? "'" : n === 0x201c || n === 0x201d ? '"' : n === 0x2013 || n === 0x2014 ? '-' : n < 128 ? String.fromCharCode(n) : ' '; })
    .replace(/&([a-z]+);/gi, (m, k) => (k.toLowerCase() in ENT ? ENT[k.toLowerCase()] : ' '));
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/ /g, ' ');
  return t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').replace(/( \| )+$/g, '').replace(/^( \| )+/, '').trim()).filter((l, i, a) => l || (i && a[i - 1])).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- the parts of an annual report ---------- */
/* An annual report on Form 10-K names its parts "Item 1", "Item 1A" and so on, and lists them once in a table of
   contents before the parts themselves. For each part wanted, every heading that could start it is tried, and the one
   followed by the most text before the next part's heading wins: in the table of contents the next heading is on the
   next line. */
const ITEMS = [['1', /^\s*item\s*1\s*[.:\-]?\s*(business|$)/i], ['1a', /^\s*item\s*1a\s*[.:\-]?\s*(risk|$)/i], ['1b', /^\s*item\s*1b\b/i], ['1c', /^\s*item\s*1c\b/i], ['2', /^\s*item\s*2\s*[.:\-]?\s*(propert|$)/i],
  ['3', /^\s*item\s*3\s*[.:\-]?\s*(legal|$)/i], ['4', /^\s*item\s*4\b/i], ['5', /^\s*item\s*5\b/i], ['7', /^\s*item\s*7\s*[.:\-]?\s*(management|$)/i], ['7a', /^\s*item\s*7a\b/i], ['8', /^\s*item\s*8\b/i], ['9', /^\s*item\s*9\b/i],
  ['9a', /^\s*item\s*9a\b/i], ['9b', /^\s*item\s*9b\b/i], ['9c', /^\s*item\s*9c\b/i], ['10', /^\s*item\s*10\b/i]];
function items10K(text) {
  const lines = text.split('\n'), at = []; let pos = 0;
  lines.forEach(l => { if (l.length < 140) for (const [id, re] of ITEMS) if (re.test(l)) { at.push({id, pos}); break; } pos += l.length + 1; });
  const out = {};
  for (const want of ['1', '1a', '3', '7', '9a']) { let best = '';
    at.forEach((h, i) => { if (h.id !== want) return; const next = at.slice(i + 1).find(x => x.id !== want); const body = text.slice(h.pos, next ? next.pos : text.length); if (body.length > best.length) best = body; });
    out[want] = best; }
  return out;
}
/* A proxy statement has no fixed parts. These headings find the ones that answer "how do the managers treat
   themselves, and how do they treat the owners"; each gets the text that follows it, up to a limit. */
const PROXY = [['pay', /compensation discussion (and|&) analysis/i, 70000], ['table', /summary compensation table/i, 14000], ['versus', /pay versus performance/i, 9000],
  ['owners', /(security|stock|share|beneficial) ownership of|ownership of (certain|our|directors|management|common)|beneficial owners/i, 9000], ['dealings', /(certain relationships and related|related[- ](person|party) transactions|transactions with related)/i, 12000], ['ratio', /pay ratio/i, 2500]];
/* Some proxies set the title of the pay section as a picture, so it is not in the text. The headings that usually open
   that section are then tried instead. */
const PAY_ALSO = /(compensation philosophy|components of compensation|elements of (our |executive )*compensation|executive compensation highlights|executive compensation program|how we pay|what we pay)/i;
function partsProxy(text) {
  const out = {};
  for (const [id, re0, max] of PROXY.concat([['pay2', PAY_ALSO, 70000]])) { if (id === 'pay2' && out.pay) continue; const re = re0; let best = '', m; const g = new RegExp(re.source, 'gi');
    while ((m = g.exec(text))) { const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index)); if (line.length > 160) continue;      /* a heading, not a mention in a sentence */
      const body = text.slice(m.index, m.index + max); const dots = (body.slice(0, 400).match(/\.{4,}|\s\d{1,3}\n/g) || []).length;   /* a table of contents is all dots and page numbers */
      if (dots < 3 && body.length > best.length) best = body; if (best.length === max) break; }
    out[id === 'pay2' ? 'pay' : id] = best; }
  return out;
}

/* ---------- ten years of reported figures ---------- */
/* Companies tag the figures in their reports, and change tags over the years. For each line of the table and each
   year, the tags are tried in order and the first that has a value for that year is used. Each value is a full
   year's (a period of about twelve months from an annual report), or a year-end balance. */
const TAGS = {
  sales: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'RevenuesNetOfInterestExpense'],
  profit: ['NetIncomeLoss', 'ProfitLoss'],
  made: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  kept: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements'],
  bought: ['PaymentsToAcquireBusinessesNetOfCashAcquired', 'PaymentsToAcquireBusinessesAndInterestInAffiliates', 'PaymentsToAcquireBusinessesGross'],
  paid: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends', 'PaymentsOfOrdinaryDividends'],
  back: ['PaymentsForRepurchaseOfCommonStock', 'PaymentsForRepurchaseOfEquity'],
  stock: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  shares: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'],
  debt: ['LongTermDebt', 'LongTermDebtNoncurrent', 'DebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligations'],
  goodwill: ['Goodwill'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']
};
const BALANCE = {debt: 1, goodwill: 1, equity: 1};
function annual(facts, tags, balance) {
  const gaap = (facts.facts || {})['us-gaap'] || {};
  const out = {};
  for (const tag of tags) { const f = gaap[tag]; if (!f || !f.units) continue; const unit = f.units.USD || f.units.shares || f.units[Object.keys(f.units)[0]]; const by = {};
    unit.forEach(x => { if (!/^(10-K|10-K\/A|20-F|40-F)/.test(x.form || '') || x.val == null || !x.end) return;
      if (!balance) { if (!x.start) return; const days = (Date.parse(x.end) - Date.parse(x.start)) / 864e5; if (days < 340 || days > 380) return; }
      const y = x.end.slice(0, 4); if (!by[y] || (x.filed || '') > (by[y].filed || '')) by[y] = {end: x.end, val: x.val, filed: x.filed}; });
    Object.keys(by).forEach(y => { if (!out[y]) out[y] = by[y]; }); }
  return out;
}
function tenYears(facts) {
  const rows = {}, years = {};
  Object.keys(TAGS).forEach(k => { rows[k] = annual(facts, TAGS[k], !!BALANCE[k]); Object.keys(rows[k]).forEach(y => { years[y] = 1; }); });
  const ys = Object.keys(years).sort().slice(-10); if (ys.length < 3) return null;
  const out = {years: ys, rows: {}};
  Object.keys(rows).forEach(k => { const a = ys.map(y => rows[k][y] ? rows[k][y].val : null); if (a.filter(v => v != null).length >= 3) out.rows[k] = a; });
  return Object.keys(out.rows).length >= 4 ? out : null;
}

/* ---------- what other companies' annual reports say about it ---------- */
/* The name a rival would use: the company's name without its legal tail. "Holdings", "Group" and "Trust" go too, but
   only when at least two words are left: a single word left over may be an everyday one ("Booking", "Match", "Block"),
   which other reports use all the time without meaning the company. */
function shortName(name) {
  const base = String(name || '').replace(/[,.]/g, ' ').replace(/\b(incorporated|inc|corporation|corp|company|co|plc|ltd|limited|n ?v|s ?a|ag|se|lp|llc|the)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const less = base.replace(/\b(holdings?|group|trust)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return less.split(' ').length >= 2 ? less : base;
}
function mentions(text, name, max) {
  /* as the name is written, capitals and all: "Apple" is the company, "apple" is not */
  const out = [], re = new RegExp('(^|[^A-Za-z])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z]|$)');
  text.split(/\n+/).forEach(p => { if (out.length < max && p.length > 60 && re.test(p)) out.push(p.length > 900 ? p.slice(0, 900) + ' [...]' : p); });
  return out;
}
/* Who names it when speaking of competition. The SEC's full-text search finds the annual reports that mention the
   name at all; most do so in passing (a director who once worked there, a partner). So each report found is fetched
   and kept only when a paragraph names the company and speaks of competing. Companies in the same line of business
   (the same SIC code) are tried first. */
function namedBy(co, dir, today, sic) {
  const name = co.aka || shortName(co.name); if (name.length < 4) return [];
  const from = new Date(Date.parse(today) - 420 * 864e5).toISOString().slice(0, 10);
  const url = 'https://efts.sec.gov/LATEST/search-index?q=' + encodeURIComponent('"' + name + '"') + '&forms=10-K&dateRange=custom&startdt=' + from + '&enddt=' + today;
  let hits = []; try { hits = (json(url, path.join(dir, 'search.json'), 30).hits || {}).hits || []; } catch (e) { return []; }
  const seen = {}, out = [], mine = pad(co.cik), near = h => { const x = ((h._source || {}).sics || [])[0] || ''; return sic && x === String(sic) ? 0 : sic && x.slice(0, 2) === String(sic).slice(0, 2) ? 1 : 2; };
  hits = hits.filter(h => /^10-K/.test((h._source || {}).file_type || '')).sort((a, b) => near(a) - near(b));
  let tried = 0;
  for (const h of hits) { const s = h._source || {}, cik = pad((s.ciks || [])[0] || ''); if (!cik || cik === mine || seen[cik]) continue; seen[cik] = 1;
    const [adsh, file] = String(h._id).split(':'); if (!adsh || !/\.html?$/i.test(file || '')) continue;
    if (++tried > 25) break;
    const u = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + adsh.replace(/-/g, '') + '/' + file;
    let text; try { text = toText(fs.readFileSync(get(u, path.join(dir, 'named', cik + '-' + file)), 'utf8')); } catch (e) { continue; }
    const m = mentions(text, name, 12).filter(p => /compet/i.test(p)).slice(0, 3); if (m.length) out.push({name: String((s.display_names || [''])[0]).replace(/\s*\(CIK.*$/, '').trim(), cik, filed: s.file_date, url: u, paragraphs: m});
    if (out.length >= 6) break; }
  return out;
}

/* ---------- one company ---------- */
function latest(sub, forms) {
  const r = sub.filings.recent;
  for (let i = 0; i < r.form.length; i++) if (forms.includes(r.form[i])) return {form: r.form[i], acc: r.accessionNumber[i], filed: r.filingDate[i], period: r.reportDate[i], doc: r.primaryDocument[i]};
  return null;
}
function fetchCompany(co, today) {
  const cik = pad(co.cik), dir = mk(path.join(DIR, co.sym.replace(/[^A-Za-z0-9.\-]/g, '_'))), raw = mk(path.join(dir, 'raw'));
  const sub = json('https://data.sec.gov/submissions/CIK' + cik + '.json', path.join(raw, 'submissions.json'), 3);
  const meta = {sym: co.sym, cik, name: sub.name || co.name, sic: sub.sicDescription || null, fetched: today, sources: [], parts: {}};
  const doc = (f, id) => { const url = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + f.acc.replace(/-/g, '') + '/' + f.doc;
    const text = toText(fs.readFileSync(get(url, path.join(raw, f.acc + '-' + f.doc)), 'utf8')); fs.writeFileSync(path.join(dir, id + '.full.txt'), text);
    meta.sources.push({id, form: f.form, filed: f.filed, period: f.period || null, url}); return text; };
  const save = (name, text, max) => { if (!text || text.length < 500) return; const t = text.length > max ? text.slice(0, max) + '\n[... cut here: ' + (text.length - max) + ' more characters in the filing ...]' : text; fs.writeFileSync(path.join(dir, name), t); meta.parts[name] = t.length; };
  const k = latest(sub, ['10-K', '20-F', '40-F']);
  if (k) { const text = doc(k, 'k');
    if (k.form === '10-K') { const it = items10K(text); save('k.business.txt', it['1'], 70000); save('k.risks.txt', it['1a'], 90000); save('k.discussion.txt', it['7'], 60000); save('k.legal.txt', it['3'], 12000); save('k.controls.txt', it['9a'], 9000); }
    else save('k.report.txt', text, 150000); }
  const p = latest(sub, ['DEF 14A', 'DEFA14A'].slice(0, 1));
  if (p) { const parts = partsProxy(doc(p, 'p')); save('p.pay.txt', parts.pay, 70000); save('p.rest.txt', ['table', 'versus', 'ratio', 'owners', 'dealings'].map(x => parts[x] ? '===== ' + x + ' =====\n' + parts[x] : '').filter(Boolean).join('\n\n'), 60000); }
  try { const ty = tenYears(json('https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json', path.join(raw, 'facts.json'), 30)); if (ty) { fs.writeFileSync(path.join(dir, 'tenyears.json'), JSON.stringify(ty)); meta.parts['tenyears.json'] = ty.years.length; } } catch (e) { meta.noFacts = String(e.message || e).slice(0, 80); }
  /* what its rivals' annual reports say: Prism's picks first, in full where they speak of competition; then whoever names it */
  const rv = [];
  (co.rivals || []).slice(0, 6).forEach(r => { if (!r.cik) return; try { const rc = pad(r.cik), rsub = json('https://data.sec.gov/submissions/CIK' + rc + '.json', path.join(raw, 'rival-' + rc + '.json'), 3), rk = latest(rsub, ['10-K']); if (!rk) return;
    const url = 'https://www.sec.gov/Archives/edgar/data/' + (+rc) + '/' + rk.acc.replace(/-/g, '') + '/' + rk.doc, text = toText(fs.readFileSync(get(url, path.join(raw, 'rival-' + rk.acc + '-' + rk.doc)), 'utf8'));
    const biz = items10K(text)['1'] || '', i = biz.search(/\n\s*competit(ion|ive|ors)[^\n]{0,60}\n/i), comp = i >= 0 ? biz.slice(i, i + 5000) : '';
    rv.push({sym: r.sym, name: rsub.name || r.name, filed: rk.filed, url, competition: comp, mentions: mentions(text, co.aka || shortName(co.name), 3)}); } catch (e) {} });
  if (rv.length) { fs.writeFileSync(path.join(dir, 'rivals.json'), JSON.stringify(rv, null, 1)); meta.parts['rivals.json'] = rv.length; }
  const nb = namedBy(co, dir, today, sub.sic); if (nb.length) { fs.writeFileSync(path.join(dir, 'namedby.json'), JSON.stringify(nb, null, 1)); meta.parts['namedby.json'] = nb.length; }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  return meta;
}

module.exports = {toText, items10K, partsProxy, annual, tenYears, shortName, mentions, pad, DIR};
if (require.main === module) {
  const [cmd, listFile, ...only] = process.argv.slice(2);
  if (cmd !== 'fetch' || !listFile) { console.log('usage: SEC_CONTACT="Name email" node tools/research/edgar.js fetch reading-list.json [SYM ...]'); process.exit(1); }
  const list = JSON.parse(fs.readFileSync(listFile, 'utf8')), today = new Date().toISOString().slice(0, 10);
  (list.companies || []).filter(c => !only.length || only.includes(c.sym)).forEach(co => {
    if (!co.cik) { console.log(co.sym + ': no CIK number on the reading list, skipped'); return; }
    try { const m = fetchCompany(co, today); console.log(co.sym + ': ' + m.sources.map(s => s.form + ' filed ' + s.filed).join(', ') + ' | ' + Object.keys(m.parts).map(k => k + ' ' + m.parts[k]).join(', ')); }
    catch (e) { console.log(co.sym + ': FAILED ' + (e.message || e)); } });
}
