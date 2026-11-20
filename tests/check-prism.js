// Prism: engine check.
// Run after any change to the engine in prism/index.html:   node tests/check-prism.js
// Every check has a hand-worked expected value. Exit code is 1 if anything fails.
// The companies below are invented; no screener data is stored in this repository.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'prism', 'index.html'), 'utf8');
const eng = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const E = new Function(eng + '\nreturn {CONTROLS,FIELDS,VERIFIED,LENS,LISTS,MINING,normHeader,parseCSV,toNumber,toDate,mapTable,annuity,impliedGrowth,bucketOf,laneOf,rankGroup,run,memberships};')();
let pass = 0, fail = 0;
const check = (name, actual, expected, tol) => {
  const ok = typeof expected === 'number' ? Math.abs(actual - expected) <= (tol == null ? 1e-6 : tol) : JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
};

console.log('--- Reading a download ---');
check('header: punctuation and case ignored', E.normHeader('Shares Ch. (YoY)'), 'shareschyoy');
check('CSV: quotes, commas and doubled quotes', E.parseCSV('a,b\n"x,1","y ""q"""\n'), [['a', 'b'], ['x,1', 'y "q"']]);
check('CSV: Windows line ends and a blank last line', E.parseCSV('a,b\r\n1,2\r\n\r\n'), [['a', 'b'], ['1', '2']]);
check('CSV: semicolons and a byte-order mark', E.parseCSV('\uFEFFa;b\n1;2'), [['a', 'b'], ['1', '2']]);
check('CSV: empty last cell kept', E.parseCSV('a,b\n1,'), [['a', 'b'], ['1', '']]);
// The case-notes file keeps a note's line breaks inside a quoted cell; the row must not split there.
check('CSV: a line break inside quotes stays in the cell', E.parseCSV('a,b\n"line one\nline two",2\n'), [['a', 'b'], ['line one\nline two', '2']]);
check('number: thousands separators', E.toNumber('1,234'), 1234);
check('number: $5.2B', E.toNumber('$5.2B'), 5.2e9, 1);
check('number: 3.4M', E.toNumber('3.4M'), 3.4e6, 1e-3);
check('number: 12.5% is 0.125', E.toNumber('12.5%'), 0.125);
check('number: dash is unknown', E.toNumber('-'), null);
check('number: n/a is unknown', E.toNumber('n/a'), null);
check('number: text is unknown, never zero', E.toNumber('abc'), null);
// Excel day 25569 is 1970-01-01. 46330 - 25569 = 20761 days = 56 years (20454 days, 14 of them leap days) + 307 days = November 4, 2026
check('date: Excel serial 46330 is 2026-11-04', E.toDate(46330), '2026-11-04');
check('date: text date', E.toDate('2026-11-04'), '2026-11-04');
{ // aliases must not be claimed by two fields
  const seen = {}; let dup = 0, bad = 0;
  E.FIELDS.forEach(f => f.slice(2).forEach(a => { if (seen[a]) dup++; seen[a] = 1; if (a !== E.normHeader(a)) bad++; }));
  check('columns: no header spelling claimed twice', dup, 0); check('columns: spellings are letters and digits only', bad, 0);
}
{ const H = ['Symbol', 'Company Name', 'Sector', 'Industry', 'Market Cap', 'Stock Price', 'FCF Yield', 'Return 1Y', 'Mystery Column'];
  const m = E.mapTable(H, [['abc', 'Abc Co', 'Technology', 'Software - Application', '$5.2B', '10', '6%', '-20%', 'x'], ['', 'blank symbol', '', '', '', '', '', '', ''], ['ABC', 'duplicate', '', '', '', '', '', '', '']]);
  check('map: symbol upper-cased, blank and duplicate rows dropped', m.rows.map(r => r.sym), ['ABC']);
  check('map: market cap read from "$5.2B"', m.rows[0].cap, 5.2e9, 1);
  check('map: "6%" read as 0.06', m.rows[0].fcfy, 0.06);
  check('map: unknown column reported', m.report.unknown, ['Mystery Column']);
  check('map: no Symbol column is an error', !!E.mapTable(['Name'], [['x']]).error, true);
  // percentages written as whole numbers (12 for 12%) are detected for the whole file
  const rows = []; for (let i = 0; i < 40; i++) rows.push(['S' + i, 'Co ' + i, 'Technology', 'Software - Application', 1e9, 10, 4 + i / 10, -30 + i * 2, '']);
  const p = E.mapTable(H, rows);
  check('map: whole-number percentages detected', p.report.percentUnits, true);
  check('map: 4.0 becomes 0.04', p.rows[0].fcfy, 0.04); check('map: -30 becomes -0.30', p.rows[0].ret1y, -0.30);
  const f = E.mapTable(H, rows.map(r => r.slice(0, 6).concat([r[6] / 100, r[7] / 100, ''])));
  check('map: fractions left alone', f.report.percentUnits, false); check('map: 0.04 stays 0.04', f.rows[0].fcfy, 0.04);
}

console.log('--- What the price implies ---');
// value of 1 growing at g for 10 years then 2.5% for ever, discounted at r
// g=0, r=10%: (1-1.1^-10)/0.1 = 6.144567, plus 1.1^-10 x 1.025/0.075 = 5.269092  ->  11.413659
check('annuity: no growth at 10%', E.annuity(0, 0.10, 0.025, 10), 11.413659, 1e-5);
// g=10%, r=10%: ten payments of 1, plus 1.025/0.075 = 13.666667  ->  23.666667
check('annuity: 10% growth at 10%', E.annuity(0.10, 0.10, 0.025, 10), 23.666667, 1e-5);
// g=6%, r=12%: q = 1.06/1.12 = 0.946429; sum = 7.479969; q^10 x 1.025/0.095 = 6.221274  ->  13.701243
check('annuity: 6% growth at 12%', E.annuity(0.06, 0.12, 0.025, 10), 13.701243, 1e-5);
const C = E.CONTROLS;
check('implied growth: yield 8.7614% needs none', E.impliedGrowth(1 / 11.413659, C), 0, 1e-5);
check('implied growth: yield 4.2254% needs 10% a year', E.impliedGrowth(1 / 23.666667, C), 0.10, 1e-5);
check('implied growth: capped at 40%', E.impliedGrowth(0.001, C), 0.40);
check('implied growth: floored at -15%', E.impliedGrowth(0.5, C), -0.15);
check('implied growth: no positive yield, no answer', E.impliedGrowth(-0.02, C), null);
check('bucket: -1% is decline', E.bucketOf(-0.01, C), 'decline'); check('bucket: 3% is stagnation', E.bucketOf(0.03, C), 'stagnation');
check('bucket: 8% is moderate', E.bucketOf(0.08, C), 'moderate'); check('bucket: 15% is high', E.bucketOf(0.15, C), 'high'); check('bucket: 25% is perfection', E.bucketOf(0.25, C), 'perfection');

console.log('--- Ranking and routing ---');
{ const g = [{x: 1, pc: {}}, {x: 2, pc: {}}, {x: 2, pc: {}}, {x: 4, pc: {}}, {x: null, pc: {}}];
  E.rankGroup(g, 'x', false);
  // four known values: 1 -> (0+0.5)/4 = 12.5; the two 2s share (1+1)/4 = 50; 4 -> (3+0.5)/4 = 87.5; unknown gets no rank
  check('rank: ties share the middle rank', g.map(r => r.pc.x === undefined ? null : r.pc.x), [12.5, 50, 50, 87.5, null]);
  E.rankGroup(g, 'x', true); check('rank: lower-is-better reverses', g.slice(0, 4).map(r => r.pc.x), [87.5, 50, 50, 12.5]);
}
const lane = (sector, industry, extra) => E.laneOf(Object.assign({sym: 'T', sector, industry}, extra || {}), null, null);
check('lane: bank is set aside as financial', lane('Financials', 'Banks - Regional'), 'financial');
check('lane: insurance broker is scored', lane('Financials', 'Insurance Brokers'), 'standard');
check('lane: REIT is property', lane('Real Estate', 'REIT - Retail'), 'property');
check('lane: shell company', lane('Financials', 'Shell Companies'), 'shell');
check('lane: health insurer is financial', lane('Healthcare', 'Healthcare Plans'), 'financial');
check('lane: software is standard', lane('Technology', 'Software - Application'), 'standard');
check('lane: no sector or industry', lane(null, null), 'unknown');
check('lane: industry left out by the user', E.laneOf({sym: 'T', sector: 'Materials', industry: 'Gold'}, null, {Gold: 1}), 'excluded');
check('lane: symbol override wins', E.laneOf({sym: 'T', sector: 'Technology', industry: 'Software - Application'}, {T: 'financial'}, null), 'financial');

console.log('--- The five questions on an invented sector ---');
// 30 ordinary companies with values spread evenly, plus special cases. All in one sector, all $5B.
const mk = (sym, o) => Object.assign({sym, name: sym + ' Inc', sector: 'Technology', industry: 'Software - Application', cap: 5e9, price: 100, vol: 1e6,
  rev: 2e9, pe: 20, ev_ebitda: 12, lev: 1, cash: 2e8, debt: 5e8, netcash: -3e8, fcfy: 0.04, roic: 0.10, revg: 0.05, fcfg: 0.05, sh: 0.00, ret1y: 0.10}, o || {});
const universe = () => { const a = [];
  for (let i = 0; i < 30; i++) a.push(mk('F' + i, {roic: 0.02 + i * 0.005, fcfy: 0.01 + i * 0.002, pe: 40 - i, ev_ebitda: 25 - i * 0.5, revg: -0.02 + i * 0.004, fcfg: i * 0.005, sh: 0.02 - i * 0.001, ret1y: -0.10 + i * 0.02}));
  a.push(mk('STAR', {roic: 0.40, fcfy: 0.06, pe: 10, ev_ebitda: 6, revg: 0.10, fcfg: 0.30, sh: -0.05, ret1y: -0.30, netcash: 5e8, cash: 6e8, debt: 1e8, lev: 0.2}));
  a.push(mk('DEBT', {netcash: -4e9, lev: 7}));                       // debt above 6x EBITDA
  a.push(mk('DILU', {sh: 0.20}));                                    // share count +20%
  a.push(mk('BURN', {fcfy: -0.03}));                                 // negative free cash flow
  a.push(mk('SHRK', {revg: -0.25}));                                 // sales down 25%
  a.push(mk('ODD', {fcfy: 0.40}));                                   // implausible cash yield
  a.push(mk('BANK', {sector: 'Financials', industry: 'Banks - Regional'}));
  a.push(mk('TINY', {cap: 1e8}));
  a.push(mk('TWOA', {name: 'Two Class Co', vol: 5e6})); a.push(mk('TWOB', {name: 'Two Class Co', vol: 1e5}));
  a.push(mk('NODATA', {roic: null, rev: null}));
  return a; };
const res = E.run(universe(), {}, {}), by = {}; res.rows.forEach(r => { by[r.sym] = r; });
check('scored: 30 ordinary + 8 special', res.scored, 38);
check('set aside: bank', by.BANK.aside, 'financial'); check('set aside: under $300M', by.TINY.aside, 'micro');
check('share classes: the more traded line is scored', [by.TWOA.aside, by.TWOB.aside], [null, 'class']);
check('STAR passes all five', by.STAR.g, {Q: true, V: true, S: true, P: true, T: true}); check('STAR: five of five', by.STAR.n5, 5);
// STAR: free cash flow = 6% x $5B = $300M; sales $2B -> margin 15%. Enterprise value = 5B - 0.5B = 4.5B -> 6.667%.
check('STAR: free-cash-flow margin 15%', by.STAR.fcfm, 0.15); check('STAR: cash flow / enterprise value 6.667%', by.STAR.fcf_ev, 0.3e9 / 4.5e9);
// STAR: growth per share = 1.30/0.95 - 1 = 36.84%
check('STAR: FCF per share growth 36.84%', by.STAR.fcfps_g, 1.30 / 0.95 - 1);
// STAR ceiling: sales growth 10% is capped at 6%; 100 x 0.06 x 13.701243 = 82.21
check('STAR: entry ceiling $82.21', by.STAR.ceiling, 82.2075, 0.001);
// conservative value / price at a 10% return: 0.06 x annuity(6%, 10%) = 0.06 x 17.639234 = 1.0584
check('STAR: conservative value is 1.058 x price', by.STAR.vp, 1.058354, 1e-5);
// what the price implies: average of the cash-flow reading (yield 6%) and the earnings reading (yield 10%)
check('STAR: implied growth is the average of two readings', by.STAR.impg, (E.impliedGrowth(0.06, C) + E.impliedGrowth(0.10, C)) / 2);
check('STAR: is on "quality on sale" and "fallen quality"', ['qos', 'fallen'].every(id => by.STAR.lists.includes(id)), true);
check('STAR: shrinking share count list', by.STAR.lists.includes('cannibal'), true);
check('blocked: heavy debt', by.DEBT.blocks, ['lev']); check('blocked: dilution', by.DILU.blocks, ['dil']);
check('blocked: negative cash flow', by.BURN.blocks, ['burn']); check('blocked: shrinking sales', by.SHRK.blocks, ['shrink']);
check('blocked companies are on no list', [by.DEBT, by.DILU, by.BURN, by.SHRK].every(r => r.lists.length === 0), true);
check('data warning: 40% cash yield is held back', [by.ODD.flags.includes('fcf_hi'), by.ODD.hold, by.ODD.ceiling], [true, true, null]);
check('unknown is not a pass: no return on capital, no answer on quality', by.NODATA.g.Q, null);
check('strength: debt 7x EBITDA fails', by.DEBT.g.S, false); check('strength: +20% shares fails', by.DILU.g.S, false);
// F29 is the best ordinary company on every measure but has not fallen: timing must be "no"
check('F29: good business yes, out of favor no', [by.F29.g.Q, by.F29.g.T], [true, false]);
check('F0: weakest ordinary company fails quality', by.F0.g.Q, false);
{ const m = E.memberships(res.rows, ['Q', 'V', 'S', 'P', 'T']); check('memberships: STAR is the only all-five name', m.all, ['STAR']); }
{ // a stricter bar changes answers; settings are honoured
  const strict = E.run(universe(), {gate: 99.9}, {}); let star = strict.rows.find(r => r.sym === 'STAR');
  check('settings: a bar of 99.9 fails STAR on progress', star.g.P, false);
  const out = E.run(universe(), {}, {overrides: {STAR: 'excluded'}}); check('settings: a left-out symbol is set aside', out.rows.find(r => r.sym === 'STAR').aside, 'excluded');
}
{ // cyclical industries lose 15 points on quality and price, and get no entry ceiling
  const u = universe(); u.forEach(r => { if (r.sym === 'STAR') r.industry = 'Steel'; });
  const a = E.run(universe(), {}, {}).rows.find(r => r.sym === 'STAR'), b = E.run(u, {}, {}).rows.find(r => r.sym === 'STAR');
  check('cyclical: quality rank 15 points lower', a.Q - b.Q, 15); check('cyclical: no entry ceiling', b.ceiling, null);
}
{ // a weak business with fast-rising cash flow is a repair candidate, but not when its sales figure is missing
  const u = universe(); u.push(mk('FIXA', {roic: 0.01, fcfy: 0.07, pe: 60, ev_ebitda: 30, fcfg: 0.40, revg: 0.00})); u.push(mk('FIXB', {roic: 0.01, fcfy: 0.07, pe: 60, ev_ebitda: 30, fcfg: 0.40, revg: null}));
  const rr = E.run(u, {}, {}).rows; check('repair list: weak returns, cash flow up 40%', rr.find(r => r.sym === 'FIXA').lists.includes('repair'), true);
  check('repair list: unknown sales growth is not a pass', rr.find(r => r.sym === 'FIXB').lists.includes('repair'), false); }
check('engine has no reference to the page', /\b(document|window|localStorage)\b/.test(eng), false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
