#!/usr/bin/env node
'use strict';
/* Prism's cheat sheet: two pages to print or to keep on a phone. The owner asked for it on 2026-11-24.

     node tools/cheatsheet.js <out.pdf>

   It needs Playwright with Chromium to print the PDF. Without it, the page is written beside the PDF as .html, to
   print from a browser (US Letter, no margins, background graphics on).

   The sheet cannot drift from the page without this script saying so:
   - every name it sets in bold (k) or as a tag (pill) must be on Prism's page, word for word;
   - the lists, the orders, the verdicts and the five questions are read from the page, and a new one stops the script
     until it has a line here;
   - the pass marks are read from the page's own CONTROLS;
   - the text must fit on two pages.
   Nothing here comes from anybody's file: the row shown is one of the made-up companies of the built-in example. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'prism/index.html'), 'utf8');
const eng = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ui = html.slice(html.indexOf('</script>', html.indexOf('<script id="engine">')));
const C = new Function(eng + '\nreturn CONTROLS;')();
const grab = (name, re) => { const m = ui.match(re); if (!m) throw new Error('Cannot find ' + name + ' on Prism\'s page'); return new Function(m[0] + '\nreturn ' + name + ';')(); };
const LI = grab('LI', /const LI = \{[\s\S]*?\n\};/), SORTS = grab('SORTS', /const SORTS = \{[\s\S]*?\n\};/), GQ = grab('GQ', /const GQ = \{[\s\S]*?\n\};/);
const VERDICTS = grab('VERDICTS', /const VERDICTS = \[[^\n]*\];/), GK = grab('GK', /const GK = \[[^\n]*\];/);

const problems = [], named = [];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* a name as the page writes it */
const k = s => { named.push(s); return '<b class="k">' + esc(s) + '</b>'; };
/* a tag as the page shows it; `as` is the part of it that is on the page when the rest is a number */
const pill = (kind, s, as) => { named.push(as || s); return '<span class="pill ' + kind + '">' + esc(s) + '</span>'; };
const pc = x => +(Math.abs(x) * 100).toFixed(1) + '%';
const money = x => x >= 1e9 ? '$' + +(x / 1e9).toFixed(1) + 'B' : '$' + +(x / 1e6).toFixed(0) + 'M';
const need = (what, have, lines) => { have.forEach(id => { if (!lines[id]) problems.push(what + ' "' + id + '" has no line on the sheet'); });
  Object.keys(lines).forEach(id => { if (!have.includes(id)) problems.push('the sheet has a line for ' + what + ' "' + id + '", which the page no longer has'); }); };

/* ---------- what the sheet says about each list, order and verdict ---------- */
const LIST_SAYS = {
  qos: 'A strong business at a low price.',
  decl: 'The price expects shrinking cash.',
  gwr: 'Sales grew. The price did not.',
  cash: 'Net cash is much of its value.',
  cannibal: 'It buys back its shares from spare cash.',
  fallen: 'Down sharply, still a good business.',
  leader: 'Top three in its industry, cheaper than peers.',
  repair: 'A possible early repair.',
  cycle: 'Cyclical, fallen hard, little debt.'
};
const SORT_SAYS = {
  auto: 'Each list\'s own order. See the box.',
  weak: 'The company whose weakest answer is strongest, among quality, price, progress and timing.',
  V: 'Cheapest for its sector on cash flow and earnings.',
  Q: 'Highest returns on its capital, for its sector.',
  P: 'Sales and cash flow per share rising fastest.',
  T: 'Its price lagged its sector the most in a year.',
  cap: 'The biggest first.',
  room: 'Price furthest below the most to pay.',
  sym: 'By symbol.'
};
const VERDICT_SAYS = {
  'Watch': ['mute', 'Interesting. Waiting for something.'],
  'Act': ['warn', 'An order or a put is open.'],
  'Own': ['good', 'You hold the shares.'],
  'No action': ['mute', 'Fine company, wrong price.'],
  'Reject': ['mute', 'Hide it from every list.']
};
need('the named list', Object.keys(LI), LIST_SAYS); need('the order', Object.keys(SORTS), SORT_SAYS);
need('the verdict', VERDICTS, VERDICT_SAYS);
if (GK.join('') !== 'QVSPT') problems.push('the five questions have changed');

const opt = (name, says) => '<p class="opt">' + k(name) + ' ' + says + '</p>';
const grp = (name, note) => { named.push(name); return '<div class="grp">' + esc(name) + (note ? ' <i>' + note + '</i>' : '') + '</div>'; };
const today = new Date(), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asOf = today.getDate() + ' ' + MON[today.getMonth()] + ' ' + today.getFullYear();

/* ---------- page 1: the lists ---------- */
const steps = [
  [k('Load a screener file'), 'Your whole-market download.'],
  [k('Since your last file'), 'Above the list: what changed.'],
  [k('A-list on sale'), 'The page opens on it. Read down the list.'],
  ['<b>Tap a row</b>', 'Read the boxes inside. Save a verdict.'],
  [k('Your verdicts'), 'Look for a ' + k('Due') + ' date or a ' + k('New report') + ' tag.']
];
const show =
  '<div class="menu">' +
  grp('Businesses worth owning') +
  '<div class="main">' +
  opt('A-list on sale', 'A-class businesses whose price is low today. <b class="start">Start here.</b>') +
  opt('Put desk', 'A-list companies that are on sale or fell ' + pc(C.put_drop) + ' or more in a week, with listed options.') +
  opt('The whole A-list', 'Every A-class business, whatever its price.') +
  '</div>' + grp('Cheap and out of favor', 'a different test from the A-list') +
  '<div class="main">' +
  opt('Yes to all five questions', 'It passes five separate questions, most of them judged against its own sector.') +
  opt('Near misses: one question short', 'One short of that.') +
  '</div>' + grp('Long shots') +
  '<div class="main">' +
  opt('Moonshots', 'Small companies growing fast, able to pay their own way. Most disappoint.') +
  '</div>' + grp('Nine named lists', 'particular situations') +
  '<div class="nine">' + Object.keys(LI).map(id => opt(LI[id][0], LIST_SAYS[id])).join('') + '</div>' +
  '</div>';
const order = '<div class="menu"><div class="main ord">' + Object.keys(SORTS).map(id => opt(SORTS[id][0], SORT_SAYS[id])).join('') + '</div></div>';
const bestFit =
  '<div class="box"><div class="boxh">What ' + k('Best fit first') + ' puts first</div><dl class="pairs">' +
  '<dt>A-list on sale</dt><dd>Holding up first, then the most signs of a low price.</dd>' +
  '<dt>Put desk</dt><dd>The biggest fall this week.</dd>' +
  '<dt>The whole A-list</dt><dd>The largest company.</dd>' +
  '<dt>Moonshots</dt><dd>Growth plus cash margin, highest first.</dd>' +
  '<dt>The five questions</dt><dd>Fewest weak spots. Near misses too.</dd>' +
  '<dt>A named list</dt><dd>The measure that list is about.</dd></dl>' +
  '<p class="fine">A bank or an insurer has no sector rank and no entry ceiling. An order that needs one puts it last.</p></div>';
const marks =
  '<dl class="marks">' +
  '<dt>An A-class business</dt><dd>Six yeses, price left out. It earns ' + pc(C.a_roic5) + ' on its capital over five years and ' + pc(C.a_roic) + ' now. A profit in each of the last ' + C.a_years +
    ' years. Sales growing ' + pc(C.a_grow) + ' a year. Cash from operations of at least ' + pc(C.a_cash) + ' of profit. A share count growing no more than ' + pc(C.a_dil) + ' a year. Little debt. A bank or an insurer has six tests of its own.</dd>' +
  '<dt>On sale</dt><dd>Two of three signs. A P/E ' + pc(1 - C.sale_pe) + ' under the company\'s own long-run average. A price that implies growth ' + Math.round(C.sale_gap * 100) +
    ' points under its sales record. A price ' + pc(C.sale_dd) + ' below its 52-week high.</dd>' +
  '<dt>A yes to a question</dt><dd>A rank of ' + C.gate + ' or better out of 100 in its sector. Strength is a plain test of debt and new shares.</dd>' +
  '</dl><p class="fine">The lists show companies worth ' + money(C.size_main) + ' and up. Every pass mark is under ' + k('Settings') + ', where ' + k('Back to the starting values') + ' undoes your changes.</p>';
const tagRow = (pills, says) => '<div class="tag"><div>' + pills + '</div><span>' + says + '</span></div>';
const tags =
  tagRow(pill('good', 'Holding up'), 'None of four signs of weakening.') +
  tagRow(pill('mute', 'One weak spot'), 'One sign. Two would count as slipping.') +
  tagRow(pill('warn', 'Slipping'), 'Two or more. At a low price, often a trap.') +
  tagRow(pill('mute', 'Rising') + ' ' + pill('mute', 'Falling'), 'Price above its 50-day average. Or below it, and down in a month.') +
  tagRow(pill('good', 'A-list'), 'It also passes the six tests of the business.') +
  tagRow(pill('mute', 'Bank or insurer'), 'Six tests of its own. No entry ceiling.') +
  tagRow(pill('warn', 'Earnings in 12 days', 'Earnings in '), 'Put desk. Amber within ' + C.put_earn + ' days.') +
  tagRow(pill('mute', 'Ex-dividend in 9 days', 'Ex-dividend '), 'Put desk. Declared, and within ' + C.put_earn + ' days.') +
  tagRow(pill('mute', 'Tax credit') + ' ' + pill('mute', 'Quarter down') + ' ' + pill('warn', 'P/E?'), 'Cautions. Tap one for what to check.');

const page1 =
  '<section class="page"><header class="top"><div><div class="kick">Financial Tools of Life · Prism</div><h1>Prism cheat sheet</h1><div class="sub">What to tap, and what it means.</div></div>' +
  '<div class="right"><b>Page 1 of 2 · The lists</b><br>As of ' + asOf + '</div></header>' +
  '<div class="sec"><h2>With each new file</h2><div class="steps">' + steps.map((s, i) => '<div class="step"><div class="st"><span class="n">' + (i + 1) + '</span>' + s[0] + '</div><div>' + s[1] + '</div></div>').join('') + '</div>' +
  '<p class="amber">An amber note that says ' + k('Load your file again') + '? Prism has learned new columns since your file was stored. Load the same file once more.</p></div>' +
  '<div class="cols"><div class="col">' +
  '<div class="sec"><h2>' + k('Show') + ': which list? <small>The number is how many are on it.</small></h2>' + show + '</div>' +
  '<div class="sec"><h2>What counts? <small>The starting pass marks.</small></h2>' + marks + '</div>' +
  '</div><div class="col">' +
  '<div class="sec"><h2>' + k('Order') + ': who comes first? <small>It never changes who is on the list.</small></h2>' + order + bestFit + '</div>' +
  '<div class="sec"><h2>Tags <small>Tap any tag for its note.</small></h2><div class="tagl">' + tags + '</div></div>' +
  '</div></div></section>';

/* ---------- page 2: one company ---------- */
const call = (n, name, says) => '<div class="call"><span class="n">' + n + '</span><div>' + k(name) + ' ' + says + '</div></div>';
const row =
  '<div class="mock"><table><tr>' + ['Company', 'Size', 'What Prism found', 'Price implies', 'Entry ceiling', 'Verdict'].map((h, i) => '<th><span class="n">' + (i + 1) + '</span>' + h + '</th>').join('') + '</tr><tr>' +
  '<td><span class="sym">ELMB.X</span> ' + pill('new', 'New') + '<div class="m">Elm Media</div><div class="m">Entertainment</div></td>' +
  '<td class="num">$3.6B</td>' +
  '<td>P/E 8, usually 12 · priced for −3% growth a year, record 8%<div class="tags">' + pill('good', 'Holding up') + ' ' + pill('mute', 'Rising') + '</div></td>' +
  '<td>Decline<div class="m">−3.4% a year</div></td>' +
  '<td><span class="num u">$33.20</span><div class="m num">price $22.08, 33.5% under</div></td>' +
  '<td><span class="sel">Verdict… <i>▾</i></span></td></tr></table>' +
  '<div class="cap">A made-up company from ' + k('Show example') + '.</div></div>' +
  '<div class="calls">' +
  call(1, 'Company', 'Symbol, name, industry. ' + k('New') + ': not on this list in your last file.') +
  call(2, 'Size', 'What the whole company is worth.') +
  call(3, 'What Prism found', 'Why it is on this list, in words. Then its tags.') +
  call(4, 'Price implies', 'The growth today\'s price needs, if you want ' + pc(C.exp_r) + ' a year. ' + k('Decline') + ' or ' + k('No growth') + ': it expects little. ' + k('Perfection') + ': over ' + pc(C.exp_perf) + '.') +
  call(5, 'Entry ceiling', 'The most to pay. At that price you earn about ' + pc(C.exp_hurdle) + ' a year if its spare cash grows only slowly.') +
  call(6, 'Verdict', 'Your own decision, kept from file to file. Prism never sets one.') +
  '</div>';
const boxes = [
  [k('Is it an A-class business?'), 'The six tests, with the company\'s own figures. Then ' + k('Is the price low?') + ' and ' + k('Is the business slipping?') + '. ' + k('My A-list') + ' lets you overrule Prism.'],
  [k('What is the price counting on?'), 'What each price is betting on: ' + k('Growth it needs') + ', ' + k('You would earn') + '. Type what you paid, or a strike less its premium, under ' + k('Prices of your own') + '.'],
  [k('Is the business winning?'), 'Signs that fit its kind of business, each set against a year before: ' + k('Better') + ', ' + k('Worse') + ', ' + k('The same') + ' or ' + k('Too early') + '. ' +
    k('Read it as') + ' changes the kind of business. ' + k('Your own signs') + ' are figures you type from its report.'],
  [k('How well is it run?'), 'Six measures beside the typical company of its industry and its nearest rivals: ' + k('Ahead') + ', ' + k('Middle') + ' or ' + k('Behind') + '. Then ' + k('Where a year\'s cash went') + '.'],
  [k('How does it treat its owners?'), 'What insiders own, the share count, dividends and buybacks, pay in new shares.'],
  [k('Where does it stand?'), 'Only after its filings were read: what they, and its rivals\', say about it.'],
  ['<b>The five questions</b>', GK.map(q => k(GQ[q][0])).join(' ') + ' Each gets its own yes or no, with no combined score. Not asked of a bank or an insurer. Then ' + k('Ways in') + ': a first check for each named list.'],
  [k('Your verdict'), 'Your decision and your notes.']
];
const inside = '<ol class="boxes">' + boxes.map(b => '<li><span class="bh">' + b[0] + '</span> ' + b[1] + '</li>').join('') + '</ol>' +
  '<p class="fine">Tap an underlined name, or a ' + k('?') + ', for a plain note on that line. The longer lessons: ' + k('Guide: how to use this page') + ', at the top.</p>';
const verdicts =
  '<div class="vd">' + VERDICTS.map(v => '<div><span class="pill ' + VERDICT_SAYS[v][0] + '">' + esc(v) + '</span><span>' + VERDICT_SAYS[v][1] + '</span></div>').join('') + '</div>' +
  '<p class="fine">Watch, Act and Own are the companies you follow. Prism flags a review that is due, new results, earnings within ' + C.alert_earn + ' days and a sharp fall.</p>' +
  '<div class="box"><div class="boxh">If you sell a put to get in</div><ol class="mini">' +
  '<li>Choose ' + k('Act') + '. Under ' + k('Entry: what you did, or plan to do') + ', write the strike and the expiry.</li>' +
  '<li>Set ' + k('Review by') + ' to the expiry date. It becomes a ' + k('Due') + ' mark.</li>' +
  '<li>Assigned? Change it to ' + k('Own') + ', and note any call the same way.</li></ol>' +
  '<p class="fine">The file has no option prices, and Prism never suggests a strike.</p></div>';
VERDICTS.forEach(v => named.push(v));
const further = '<dl class="pairs wide">' +
  '<dt>' + k('More options') + '</dt><dd>' + k('Company size') + ', a finder, tick boxes.</dd>' +
  '<dt>' + k('Look up any stock') + '</dt><dd>Why a company is not on a list.</dd>' +
  '<dt>' + k('Scorecard: how the lists have done') + '</dt><dd>Each list against the typical large company. Price only.</dd></dl>';
const research =
  '<p class="fine"><b>Quick, nothing more to pay:</b> ' + k('Take it to a chat') + ', at the top of a company. ' + k('Copy the brief') + ' into ChatGPT or Claude. Unchecked: ask it for sources.</p>' +
  '<ol class="mini">' +
  '<li><b>Checked, and kept in Prism:</b> press ' + k('Deeper dive') + '. It joins the queue.</li>' +
  '<li>In a Claude Code session for these tools, say "read my queue": about 15 minutes and $0.50 to $1 a company.</li></ol>' +
  '<p class="fine">Off the claude.ai link: ' + k('Download the queue') + ', then ' + k('Load a research file') + '. ' + pill('warn', 'A newer annual report is out') + ' means: press ' + k('Read again') + '.</p>';
const saving =
  '<ul class="dots"><li>Verdicts, A-list choices, signs, settings and scorecard stay in this browser, with your last file.</li>' +
  '<li>For a backup or another device: ' + k('Encrypted and online copies') + ', at the foot of the page. A lost passphrase cannot be recovered.</li>' +
  '<li>Keep your screener file and your research file: a copy holds neither.</li></ul>';
const page2 =
  '<section class="page"><header class="top two"><div><h1>Prism cheat sheet</h1></div><div class="right"><b>Page 2 of 2 · One company</b><br>As of ' + asOf + '</div></header>' +
  '<div class="sec"><h2>Reading a row</h2>' + row + '</div>' +
  '<div class="cols"><div class="col">' +
  '<div class="sec"><h2>Inside a company <small>Tap a row. The boxes come in this order.</small></h2>' + inside + '</div>' +
  '<div class="sec"><h2>Saving</h2>' + saving + '</div>' +
  '</div><div class="col">' +
  '<div class="sec"><h2>Verdicts <small>Yours. Prism never sets one.</small></h2>' + verdicts + '</div>' +
  '<div class="sec"><h2>Further down the page</h2>' + further + '</div>' +
  '<div class="sec"><h2>Past what a file can say <small>The part that needs AI.</small></h2>' + research + '</div>' +
  '</div></div>' +
  '<footer class="rem"><b>Three things to remember</b><ol><li>Prism lists companies to research. It does not tell you what to buy.</li>' +
  '<li>Every pass mark is a starting point. None has been tested against later returns. A place on a list is a reason to read, not a prediction.</li>' +
  '<li>The research is an AI\'s reading of the filings: evidence to weigh, not a verdict. None of this is investment advice.</li></ol></footer></section>';

/* ---------- the names must be on the page ---------- */
const onPage = n => [n, n.replace(/&/g, '&amp;'), n.replace(/'/g, "\\'")].some(v => html.includes(v));
[...new Set(named)].forEach(n => { if (!onPage(n)) problems.push('"' + n + '" is not on Prism\'s page'); });
if (problems.length) { console.error('The cheat sheet no longer matches Prism\'s page:\n  ' + problems.join('\n  ')); process.exit(1); }

const css = fs.readFileSync(path.join(__dirname, 'cheatsheet.css'), 'utf8');
const doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Prism cheat sheet</title><style>' + css + '</style></head><body>' + page1 + page2 + '</body></html>';

(async () => {
  const out = process.argv[2]; if (!out || !/\.pdf$/i.test(out)) { console.error('usage: node tools/cheatsheet.js <out.pdf>'); process.exit(1); }
  const page = out.replace(/\.pdf$/i, '.html');
  let pw = null; try { pw = require('playwright'); } catch (e) { /* no browser to print with */ }
  if (!pw) { fs.writeFileSync(page, doc); console.log('No Playwright here. Wrote ' + page + ': open it in a browser and print it (US Letter, no margins, background graphics on).'); return; }
  const b = await pw.chromium.launch(), p = await b.newPage({viewport: {width: 816, height: 1056}});
  await p.setContent(doc); await p.evaluate(() => document.fonts.ready);
  /* does every page hold its text? The room left under each column, in points: a footer needs its own height below them. */
  const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((el, i) => { const floor = el.getBoundingClientRect().bottom - parseFloat(getComputedStyle(el).paddingBottom);
    const foot = el.querySelector('footer'), fh = foot ? foot.getBoundingClientRect().height + parseFloat(getComputedStyle(foot).marginTop) : 0;
    const cols = [...el.querySelectorAll('.col')].map(c => Math.round((floor - fh - Math.max(...[...c.querySelectorAll('*')].map(x => x.getBoundingClientRect().bottom))) * 0.75));
    return {page: i + 1, cols, spare: Math.min(...cols)}; }));
  const tight = over.filter(o => o.spare < 0);
  await p.pdf({path: out, width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true});
  await b.close();
  console.log(over.map(o => 'page ' + o.page + ': ' + o.cols.join('pt and ') + 'pt to spare under its two columns').join('; '));
  if (tight.length) { console.error('The text does not fit on page ' + tight.map(o => o.page).join(' and ') + '. Shorten it.'); process.exit(1); }
  console.log('Wrote ' + out + ' (' + [...new Set(named)].length + ' names checked against the page)');
})();
