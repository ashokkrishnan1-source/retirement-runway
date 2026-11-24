// Prism: engine check.
// Run after any change to the engine in prism/index.html:   node tests/check-prism.js
// Every check has a hand-worked expected value. Exit code is 1 if anything fails.
// The companies below are invented; no screener data is stored in this repository.
// It also checks that the guide (prism/guide/index.html) names only what is really on the page.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'prism', 'index.html'), 'utf8');
const eng = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const E = new Function(eng + '\nreturn {CONTROLS,FIELDS,VERIFIED,LENS,LISTS,MINING,normHeader,parseCSV,toNumber,toDate,mapTable,derive,strengthOf,annuity,impliedGrowth,bucketOf,laneOf,rankGroup,run,memberships,gradeOf,saleOf,moonOf,judge,daysBetween,median,cardStep,cardStats,slipOf,slipState,crowd,changes,dividendOf};')();
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

console.log('--- The provider\'s full download ---');
// The headings of the 74 columns Prism reads, spelled as the provider's full download (336 columns, 2026-11-20) spells
// them. Headings only: the values below are invented.
{ const FULL = ['Symbol', 'Company Name', 'Sector', 'Industry', 'Stock Price', 'Market Cap', 'Avg. Volume', 'Revenue', 'PE Ratio', 'EV/EBITDA',
    'Debt / EBITDA', 'Total Cash', 'Total Debt', 'Net Cash', 'FCF Yield', 'ROIC', 'Rev. Growth', 'FCF Growth', 'Shares Ch. (YoY)', 'Return 1Y',
    'Country', 'Exchange', 'CIK Code', 'Price Date', 'Last Split Date', 'Ent. Value', 'FCF', 'SBC', 'Shares', 'Forward PE', 'EV/FCF', 'PB Ratio',
    'Int. Cov.', 'Z-Score', 'F-Score', 'Analysts', 'Earnings Yield', 'ROIC (5Y)', 'ROE', 'Gross Margin', 'Oper. Margin', 'FCF Margin',
    'Rev. Growth 3Y', 'Rev. Growth 5Y', 'EPS Growth', 'Buyback Yield', '52W High Chg', 'Shares Insiders', 'Short % Float',
    'Profit Years', 'Rev. Growth 10Y', 'Operating CF', 'Net Income', 'ND / EBITDA', 'PE (5Y)', 'PE (10Y)', 'Return 1W', 'Return 1M', '50MA Chg %', 'ATR',
    'Options', 'Next Earnings', 'Rev Gr. Next Y', 'Rev. Growth (Q)', 'OpInc Growth', 'EPS Growth (Q)',
    'Div. Yield', 'Dividend', 'Div. Years', 'Div. Gr. Years', 'FCF Payout', 'Div. Growth', 'Ex-Div Date', 'Payout Freq.'];
  // look-alike headings that are also in the download and must not be mistaken for the ones above
  const DECOYS = ['Shares Ch. (QoQ)', 'FCF Growth 3Y', 'EPS Growth 3Y', 'Rev. Growth (QoQ)', 'OpInc Growth (Q)', 'EPS Growth (QoQ)', 'Return 3M', 'PE (3Y)', 'Short % Shares', 'FCF / EV', 'ND / Equity', 'ROE (5Y)', '200MA Chg %', 'Rev Gr. Next Q', 'Earnings Date',
    'Div. Growth 3Y', 'Div. Growth 5Y', 'Div. Growth 10Y', 'Payout Ratio', 'Payment Date', 'Last Div.', 'Shareh. Yield'];
  const row = FULL.map(() => ''), set = (h, v) => { row[FULL.indexOf(h)] = v; };
  set('Symbol', 'zzz.x'); set('Stock Price', '40'); set('Market Cap', '2000000000'); set('FCF Yield', '9.00%'); set('FCF', '100000000'); set('ROIC', '12.50%');
  set('Shares Ch. (YoY)', '-0.21%'); set('CIK Code', '0000123456'); set('Price Date', '2026-11-19'); set('Ent. Value', '2500000000'); set('Int. Cov.', '-4.5');
  set('Z-Score', '2.75'); set('F-Score', '7'); set('52W High Chg', '-10.88%'); set('Short % Float', '0.82%');
  set('Profit Years', '35'); set('50MA Chg %', '-4.18%'); set('Options', 'Yes'); set('Next Earnings', '2027-01-27'); set('ND / EBITDA', '-0.0356');
  set('Div. Yield', '2.50%'); set('Dividend', '1'); set('Div. Years', '12'); set('Div. Gr. Years', '5'); set('FCF Payout', '40.00%'); set('Div. Growth', '-11.80%'); set('Ex-Div Date', '2026-12-01'); set('Payout Freq.', 'Semi-Annual');
  const m = E.mapTable(FULL.concat(DECOYS), [row.concat(DECOYS.map(() => '99'))]), r = m.rows[0];
  check('full download: every column Prism reads is found', Object.keys(m.report.found).length, E.FIELDS.length);
  check('full download: none missing', m.report.missing, []);
  check('full download: none matched on a guessed spelling', m.report.guessed, []);
  check('full download: look-alike columns are left alone', m.report.unknown, DECOYS);
  check('full download: "12.50%" is 0.125', r.roic, 0.125); check('full download: "-0.21%" is -0.0021', r.sh, -0.0021, 1e-12);
  check('full download: "-10.88%" below the 52-week high', r.dd, -0.1088, 1e-12); check('full download: "0.82%" short interest', r.short, 0.0082, 1e-12);
  check('full download: CIK keeps its leading zeros', r.cik, '0000123456'); check('full download: price date', r.pdate, '2026-11-19');
  check('full download: enterprise value', r.ev, 2.5e9); check('full download: interest cover can be negative', r.cov, -4.5);
  check('full download: Altman score', r.altman, 2.75); check('full download: Piotroski score', r.piotroski, 7);
  check('full download: profit years', r.py, 35); check('full download: "-4.18%" against the 50-day average', r.ma50, -0.0418, 1e-12);
  check('full download: options and the next earnings date', [r.opt, r.earn], ['Yes', '2027-01-27']); check('full download: net debt over EBITDA can be negative', r.ndlev, -0.0356);
  check('full download: percentages carry a % sign, so no whole-number conversion', m.report.percentUnits, false);
  check('full download: the dividend columns', [r.dy, r.div, r.dyrs, r.dgyrs, r.fpay, Math.round(r.dg1 * 1e6) / 1e6, r.exdiv, r.dfreq], [0.025, 1, 12, 5, 0.4, -0.118, '2026-12-01', 'Semi-Annual']);
  // a spelling that is only a guess is reported as one: "Ticker" and "Enterprise Value" are not the provider's headings
  check('a guessed spelling is reported', E.mapTable(['Ticker', 'Enterprise Value'], [['x', '5']]).report.guessed, ['sym', 'ev']);
  // The yield is free cash flow over the whole company's market value: 100m / 2,000m = 5%, though the file's column says 9%
  E.derive(r); check('yield: company cash flow over company value', r.fcfy, 0.05); check('yield: the file\'s own figure is kept', r.fcfy_file, 0.09);
  E.derive(r); check('yield: unchanged when worked out again', [r.fcfy, r.fcfy_file], [0.05, 0.09]);
  // with no free-cash-flow column the file's yield is used: 8% of 1,000 is 80
  const y = {fcfy: 0.08, cap: 1000}; E.derive(y); check('yield only: kept', y.fcfy, 0.08); check('yield only: cash flow is yield x value', y.fcf, 80, 1e-9);
  // with no yield column: 30 / 600 = 5%
  const c = {fcf: 30, cap: 600}; E.derive(c); check('cash flow only: yield is 30 / 600', c.fcfy, 0.05); check('cash flow only: no file figure', c.fcfy_file, null);
}
console.log('--- Financial companies that are fee businesses ---');
// In a mixed financial industry, a company with EBITDA-based figures in the file reports like an ordinary company.
check('lane: a card network with debt over EBITDA given is scored', E.laneOf({sector: 'Financials', industry: 'Credit Services', lev: 0.7}), 'standard');
check('lane: a fund manager with EV over EBITDA given is scored', E.laneOf({sector: 'Financials', industry: 'Asset Management', ev_ebitda: 14}), 'standard');
check('lane: a lender in the same industry, with neither figure, is set aside', E.laneOf({sector: 'Financials', industry: 'Credit Services'}), 'financial');
check('lane: a bank stays set aside even with the figure', E.laneOf({sector: 'Financials', industry: 'Banks - Regional', lev: 2}), 'financial');
check('lane: an insurer stays set aside', E.laneOf({sector: 'Financials', industry: 'Insurance - Life', lev: 2}), 'financial');

console.log('--- The A-list: six tests of the business ---');
// Lines: 15% return on capital over five years and 12% now; 10 profitable years; sales up 4% a year over five and ten years;
// cash from operations at least 80% of profit; share count up at most 2%; net cash, or net debt up to 3 x EBITDA with interest covered 5 times.
{ const C = E.CONTROLS, base = {roic5: 0.20, roic: 0.18, py: 12, revg5: 0.06, revg10: 0.05, ni: 100, ocf: 110, sh: 0, netcash: -50, ndlev: 1, cov: 10};
  const G = o => E.gradeOf(Object.assign({}, base, o), C);
  check('A: a company that passes all six', [G({}).yes, G({}).no, G({}).unk], [6, [], []]);
  check('A: 11% return this year is under the 12% line', G({roic: 0.11}).no, ['returns']);
  check('A: no five-year return in the file is unknown, not a pass', [G({roic5: null}).yes, G({roic5: null}).unk], [5, ['returns']]);
  check('A: nine profitable years is one short', G({py: 9}).no, ['profitable']);
  check('A: 3% growth over ten years fails though five years pass', G({revg10: 0.03}).no, ['grows']);
  check('A: with no ten-year figure, five years decide', G({revg10: null}).yes, 6);
  check('A: cash of 70 on profit of 100 is under 80%', G({ocf: 70}).no, ['cash']);
  check('A: a loss fails the cash test', G({ni: -5}).no, ['cash']);
  check('A: share count up 3% is over the 2% line', G({sh: 0.03}).no, ['shares']);
  check('A: net debt of 3.5 x EBITDA is over 3', G({ndlev: 3.5}).no, ['debt']);
  check('A: more cash than debt passes whatever the ratio says', G({netcash: 10, ndlev: 9}).yes, 6);
  check('A: interest covered 4 times is under 5', G({cov: 4}).no, ['debt']);
  check('A: with no net-debt ratio the plain debt ratio is used', [G({ndlev: null, lev: 2}).yes, G({ndlev: null, lev: 4}).no], [6, ['debt']]);
  check('A: net debt with negative EBITDA fails', G({ndlev: -1}).no, ['debt']);
}
console.log('--- On sale: two of three signs ---');
// P/E at most 75% of its own ten-year average; price implies growth at least 5 points under the record; 25% under the high.
{ const C = E.CONTROLS, base = {pe: 12, pe10: 20, revg5: 0.10, revg10: 0.08, impg: 0.02, dd: -0.30}, Z = o => E.saleOf(Object.assign({}, base, o), C);
  check('sale: P/E 12 against a usual 20, growth 2% against a record of 8%, 30% off the high', [Z({}).own, Z({}).implied, Z({}).high, Z({}).n], [true, true, true, 3]);
  check('sale: P/E 16 is above 75% of 20', Z({pe: 16}).own, false);
  check('sale: implied 4% is not 5 points under a record of 8%', Z({impg: 0.04}).implied, false);
  check('sale: the record is the lower of five and ten years', Z({}).rec, 0.08);
  check('sale: 20% off the high is not enough', [Z({dd: -0.20}).high, Z({dd: -0.20}).n], [false, 2]);
  check('sale: with no ten-year average the five-year one is used (12 against 16)', Z({pe10: null, pe5: 16}).own, true);
  check('sale: a loss-making company has no P/E to compare', Z({pe: null}).own, null);
  // its own past is the lower of the two averages: 14 here, so 12 is not a quarter under it (the line is 10.5)
  check('sale: the lower of the five- and ten-year averages is used', [Z({pe10: 30, pe5: 14}).ownPE, Z({pe10: 30, pe5: 14}).own], [14, false]);
  // an average of 138 comes from a few thin years: it counts as 40, so the line is a P/E of 30
  check('sale: an absurd average counts as 40', [Z({pe10: 138, pe: 31}).ownPE, Z({pe10: 138, pe: 31}).own, Z({pe10: 138, pe: 29}).own], [40, false, true]);
  // with no implied growth worked out yet, it comes from the yields: a cash yield that needs no growth implies 0%
  const y0 = 1 / E.annuity(0, C.exp_r, C.exp_gT, C.exp_N);
  check('sale: implied growth worked out from the cash yield when missing', Z({impg: null, fcfy: y0}).imp, 0, 1e-6);
}
console.log('--- Rising or falling, the put desk, pins ---');
{ const C = E.CONTROLS, mk = o => Object.assign({sym: 'X', scored: true, primary: true, price: 10, pool: 'main', roic5: 0.20, roic: 0.18, py: 12, revg5: 0.06, ni: 100, ocf: 110, sh: 0, netcash: 5, pe: 30, pe10: 30, dd: -0.05, impg: 0.08, blocks: [], lists: [], flags: [], hold: false}, o);
  const J = (o, opt) => { const r = mk(o); E.judge([r], C, Object.assign({today: '2026-11-19'}, opt)); return r; };
  check('trend: under its 50-day average and down over a month is falling', J({ma50: -0.02, ret1m: -0.03}).trend, 'down');
  check('trend: above its 50-day average is rising', J({ma50: 0.01, ret1m: -0.03}).trend, 'up');
  check('trend: under the average but up over the month is neither', J({ma50: -0.02, ret1m: 0.01}).trend, 'flat');
  check('trend: unknown without the figures', J({}).trend, null);
  check('earnings: 2026-11-19 to 2026-12-09 is 20 days', J({earn: '2026-12-09'}).earnIn, 20);
  check('A-list: grade A is on it', [J({}).grade, J({}).alist], ['A', true]);
  check('A-list: the reader can take a company off', J({}, {pins: {X: 'out'}}).alist, false);
  check('A-list: the reader can add a company that fails a test', [J({py: 3}).grade, J({py: 3}).alist, J({py: 3}, {pins: {X: 'in'}}).alist], ['B', false, true]);
  check('A-list: one missed test counts only when that option is on', J({py: 3}, {tierB: true}).alist, true);
  check('A-list: two missed tests never count', [J({py: 3, sh: 0.05}).grade, J({py: 3, sh: 0.05}, {tierB: true}).alist], [null, false]);
  check('put desk: A-list but not on sale and not down is off the desk', J({ret1w: -0.02}).put, false);
  check('put desk: A-list and down 9% in a week is on it', J({ret1w: -0.09}).put, true);
  check('put desk: A-list and on sale is on it', [J({pe: 12, dd: -0.30}).onSale, J({pe: 12, dd: -0.30}).put], [true, true]);
  check('put desk: no listed options keeps it off', J({ret1w: -0.09, opt: 'No'}).put, false);
  check('put desk: not on the A-list keeps it off', J({py: 3, ret1w: -0.09}).put, false);
}
console.log('--- Is the business slipping? ---');
// Signs: the latest quarter's sales growth, or next year's forecast, under half the company's own pace and at least 5 points
// under it; return on capital under 80% of its five-year average; operating profit down more than 5%.
{ const C = E.CONTROLS, base = {revg5: 0.12, revg10: 0.10, revgq: 0.11, revgn: 0.09, roic: 0.19, roic5: 0.20, oig: 0.08}, Z = o => E.slipOf(Object.assign({}, base, o), C);
  check('slip: the pace is the lower of five- and ten-year growth', Z({}).pace, 0.10);
  check('slip: nothing wrong', [Z({}).n, Z({}).known, E.slipState(Z({}))], [0, 4, 'steady']);
  // pace 10%: half is 5%, five points under is 5%, so the line is 5%
  check('slip: 4% in the latest quarter against a 10% pace is a sign', Z({revgq: 0.04}).s.growth, true);
  check('slip: 6% is not', Z({revgq: 0.06}).s.growth, false);
  // pace 20%: half is 10%, five points under is 15%: the line is the lower, 10%
  check('slip: against a 20% pace, 12% is fine and 9% is a sign', [Z({revg5: 0.20, revg10: null, revgq: 0.12}).s.growth, Z({revg5: 0.20, revg10: null, revgq: 0.09}).s.growth], [false, true]);
  // pace 4%: half is 2%, five points under is -1%: only shrinking sales count
  check('slip: a slow grower is flagged only when sales shrink', [Z({revg5: 0.04, revg10: 0.04, revgq: 0}).s.growth, Z({revg5: 0.04, revg10: 0.04, revgq: -0.02}).s.growth], [false, true]);
  check('slip: return of 15% against a five-year 20% is under 80% of it', [Z({roic: 0.15}).s.returns, Z({roic: 0.17}).s.returns], [true, false]);
  check('slip: a 3% forecast against a 10% pace is a sign', Z({revgn: 0.03}).s.forecast, true);
  check('slip: operating profit down 6% is a sign, down 4% is not', [Z({oig: -0.06}).s.profit, Z({oig: -0.04}).s.profit], [true, false]);
  check('slip: without operating profit, quarterly earnings per share stand in', [Z({oig: null, epsgq: -0.10}).s.profit, Z({oig: null}).s.profit], [true, null]);
  check('slip: two signs is slipping', [Z({revgq: 0.04, revgn: 0.03}).n, E.slipState(Z({revgq: 0.04, revgn: 0.03}))], [2, 'slipping']);
  check('slip: one sign is one weak spot', E.slipState(Z({roic: 0.15})), 'one');
  check('slip: too little to judge says nothing', [Z({revgq: null, revgn: null}).known, E.slipState(Z({revgq: null, revgn: null}))], [2, null]);
}
console.log('--- One worry, many names; what changed ---');
{ const C = E.CONTROLS, mk = (sec, ind) => ({sector: sec, industry: ind});
  const ten = [mk('Technology', 'Software - Application'), mk('Technology', 'Software - Application'), mk('Technology', 'Software - Application'), mk('Technology', 'Semiconductors'),
    mk('Healthcare', 'Medical Devices'), mk('Healthcare', 'Medical Devices'), mk('Healthcare', 'Biotechnology'), mk('Industrials', 'Railroads'), mk('Industrials', 'Railroads'), mk('Industrials', 'Airlines')];
  check('crowd: four of ten in one sector, three of them one industry', E.crowd(ten, C), {sector: 'Technology', count: 4, of: 10, inds: [['Software - Application', 3]]});
  check('crowd: three in a sector is under the minimum of four', E.crowd(ten.slice(1), C), null);
  check('crowd: four of twenty is under the 30% share', E.crowd(ten.concat(Array.from({length: 10}, (_, i) => mk('Sector ' + i, 'x'))), C), null);
  check('crowd: an empty list', E.crowd([], C), null);
  check('changes: who joined and who left, only for lists both files have', E.changes({x: ['A', 'B'], y: ['C']}, {x: ['B', 'D'], z: ['E']}), {x: {in: ['D'], out: ['A']}});
  check('changes: nothing to compare without an earlier file', E.changes(null, {x: ['A']}), {});
  const row = o => Object.assign({sym: 'S', scored: true, pool: 'main', hold: false, blocks: [], lists: [], g: {}}, o);
  const m = E.memberships([row({sym: 'S1', slipping: 'slipping'}), row({sym: 'S2', slipping: 'one'}), row({sym: 'U1', ceiling: 50, price: 40}), row({sym: 'U2', ceiling: 50, price: 60})], []);
  check('members: slipping companies and those under their ceiling are remembered', [m.slip, m.under], [['S1'], ['U1']]);
}

console.log('--- Moonshots ---');
// Up to $20B in size, $100M of sales, sales up 30% (20% over three years and expected next year), gross margin 50%,
// more cash than debt, three years of cash, share count up at most 8%, and growth plus cash margin of at least 40 points.
{ const C = E.CONTROLS, base = {scored: true, hold: false, cyc: false, cap: 2e9, rev: 2e8, revg: 0.60, revg3: 0.30, revgn: 0.25, gm: 0.70, netcash: 1e8, cash: 3e8, fcf: -5e7, fcfm: -0.15, sh: 0.03};
  const M = o => { const r = Object.assign({}, base, o); return [E.moonOf(r, C), r.runway]; };
  check('moon: passes, with cash of 300 for a burn of 50 a year: six years', M({}), [true, 6]);
  check('moon: cash for two years is too little', M({cash: 1e8}), [false, 2]);
  check('moon: a company that earns cash needs no runway', M({fcf: 1e7, fcfm: 0.05}), [true, 99]);
  check('moon: gross margin of 45% is under 50%', M({gm: 0.45})[0], false);
  check('moon: more debt than cash fails', M({netcash: -1})[0], false);
  check('moon: share count up 10% fails', M({sh: 0.10})[0], false);
  check('moon: too big at $30B', M({cap: 3e10})[0], false);
  check('moon: sales of $50M are too small to judge', M({rev: 5e7})[0], false);
  check('moon: a cyclical industry is left out', M({cyc: true})[0], false);
  check('moon: 10% expected next year is too slow', M({revgn: 0.10})[0], false);
  check('moon: no forecast in the file is not held against it', M({revgn: null})[0], true);
  check('moon: growth 30% and cash margin -15% add to 15, under 40', M({revg: 0.30})[0], false);
}
console.log('--- The scorecard ---');
check('days: 2026-11-10 to 2026-12-10 is 30', E.daysBetween('2026-11-10', '2026-12-10'), 30);
check('median of 3, 1, 2', E.median([3, 1, 2]), 2); check('median of 1, 2, 3, 10', E.median([1, 2, 3, 10]), 2.5); check('median of nothing', E.median([]), null);
{ // 25 large companies at $10 on day one. Thirty days later C0 is $12, C1 is $9 and the other 23 are $11.
  const day = (px, extra) => Array.from({length: 25}, (_, i) => Object.assign({sym: 'C' + i, scored: true, pool: 'main', price: px(i)}, (extra || {})['C' + i]));
  const d1 = day(() => 10), d2px = i => i === 0 ? 12 : i === 1 ? 9 : 11, d2 = day(d2px);
  let card = E.cardStep(null, '2026-11-10', d1, {x: ['C0', 'C1']});
  check('card: the index starts at 100', card.idx, [['2026-11-10', 100, 0]]);
  check('card: the entry price is remembered', card.ent.x, {C0: ['2026-11-10', 10], C1: ['2026-11-10', 10]});
  check('card: nothing to report after one file', E.cardStats(card, d1), null);
  const c2 = E.cardStep(card, '2026-12-10', d2, {x: ['C0', 'C1', 'C2']});
  // the typical company: the median of 25 changes, 23 of which are +10%
  check('card: the typical company rose 10%, so the index is 110', c2.idx[1][1], 110, 1e-9); check('card: same run of the index', [c2.idx[1][0], c2.idx[1][2]], ['2026-12-10', 0]);
  check('card: a company joining later is entered at that day\'s price', c2.ent.x.C2, ['2026-12-10', 11]);
  check('card: the first card is left untouched', [card.idx.length, Object.keys(card.ent.x).length], [1, 2]);
  const st = E.cardStats(c2, d2).lists.x;
  // C0 +20% and C1 -10%: median +5%. Against +10% for the typical company: +10 and -20 points, median -5. One of two ahead.
  check('card: two measured, the newcomer not yet', [st.n, st.dropped], [2, 0]);
  check('card: median change since joining is +5%', st.ret, 0.05, 1e-9); check('card: the typical company over the same days: +10%', st.bench, 0.10, 1e-9);
  check('card: behind by 5 points', st.excess, -0.05, 1e-9); check('card: one of two ahead', st.ahead, 0.5); check('card: thirty days', st.days, 30);
  check('card: the same file again changes nothing', E.cardStep(c2, '2026-12-10', d2, {x: ['C5']}).idx.length, 2);
  check('card: an older file changes nothing', E.cardStep(c2, '2026-11-01', d1, {x: ['C5']}).ent.x.C5, undefined);
  // a share split after joining makes the two prices incomparable: the company is dropped from the count
  const sp = day(d2px, {C0: {split: '2026-12-01'}}), cs = E.cardStep(card, '2026-12-10', sp, {x: []});
  check('card: a split since joining drops the company', [E.cardStats(cs, sp).lists.x.n, E.cardStats(cs, sp).lists.x.dropped], [1, 1]);
  check('card: an older split does not', E.cardStats(E.cardStep(card, '2026-12-10', day(d2px, {C0: {split: '2020-01-01'}}), {x: []}), d2).lists.x.n, 2);
  const gone = d2.filter(r => r.sym !== 'C1');
  check('card: a company that left the file is dropped', [E.cardStats(E.cardStep(card, '2026-12-10', gone, {x: []}), gone).lists.x.n, E.cardStats(E.cardStep(card, '2026-12-10', gone, {x: []}), gone).lists.x.dropped], [1, 1]);
  // with too few companies to compare, the typical company can't be carried forward: no comparison is claimed
  const few = d2.slice(0, 10), cf = E.cardStep(card, '2026-12-10', few, {x: []}), sf = E.cardStats(cf, few).lists.x;
  check('card: too few companies starts a new run of the index', cf.idx[1][2], 1); check('card: and no comparison is made across it', [sf.n, sf.bench, sf.excess], [2, null, null]);
}
console.log('--- Membership of the newer lists ---');
{ const row = o => Object.assign({sym: 'S', scored: true, pool: 'main', hold: false, blocks: [], lists: [], g: {Q: true, V: true, S: true, P: true, T: true}}, o);
  const m = E.memberships([row({sym: 'A1', alist: true}), row({sym: 'A2', alist: true, onSale: true, put: true}), row({sym: 'M1', moon: true, pool: 'small'}), row({sym: 'H1', alist: true, hold: true}), row({sym: 'S1', alist: true, pool: 'ext'}), row({sym: 'B1', alist: true, blocks: ['burn']})], ['Q', 'V', 'S', 'P', 'T']);
  check('members: the A-list keeps large companies without data warnings, blocked or not', m.A, ['A1', 'A2', 'B1']);
  check('members: on sale and put desk', [m.sale, m.put], [['A2'], ['A2']]);
  check('members: a moonshot can be small', m.moon, ['M1']);
  check('members: the all-five list still leaves out blocked companies', m.all, ['A1', 'A2']);
}

console.log('--- Strong enough to wait: interest cover ---');
// Limits: debt up to 3 x EBITDA, share count up to +3%, and with net debt, profit must cover interest 3 times.
{ const C = E.CONTROLS, S = o => E.strengthOf(Object.assign({netcash: -100, lev: 2, sh: 0}, o), C, C.s_lev).ok;
  check('cover 5 times with net debt: yes', S({cov: 5}), true);
  check('cover 2 times with net debt: no', S({cov: 2}), false);
  check('negative cover (an operating loss) with net debt: no', S({cov: -2}), false);
  check('cover unknown: judged on debt and share count alone', S({}), true);
  check('negative cover but more cash than debt: yes', S({cov: -2, netcash: 50}), true);
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

console.log('--- Dividends ---');
{ // What the file says about a dividend. Worked by hand; the companies are invented.
  const C = E.CONTROLS, T = '2026-11-19', dv = (o, t) => E.dividendOf(Object.assign({price: 100}, o), C, t === undefined ? T : t);
  // $2 a share a year on a $100 share is 2%; four payments of $0.50; 19 Nov to 1 Dec is 12 days
  let d = dv({dy: 0.02, div: 2, dfreq: 'Quarterly', dyrs: 12, dgyrs: 5, fpay: 0.4, dg1: 0.05, exdiv: '2026-12-01'});
  check('dividend: it pays, $2 a year, 2% of the price', [d.pays, d.amount, d.yld], [true, 2, 0.02]);
  check('dividend: quarterly, so about $0.50 each time', [d.times, d.freq, d.each], [4, 'quarterly', 0.5]);
  check('dividend: paid 12 years running, raised 5', [d.years, d.raised], [12, 5]);
  check('dividend: takes 40% of the spare cash, by the file\'s own column', [d.share, d.shareOwn, d.none, d.over], [0.4, false, false, false]);
  check('dividend: not lower than a year ago', d.down, null);
  check('dividend: goes ex-dividend in 12 days', [d.exIn, d.next, d.last], [12, '2026-12-01', null]);
  // the date in the file is the last one until the next is declared: nothing is guessed
  d = dv({dy: 0.02, div: 2, exdiv: '2026-11-12'}); check('dividend: a date that has passed is the last one, with no next', [d.exIn, d.next, d.last], [null, null, '2026-11-12']);
  d = dv({dy: 0.02, div: 2, exdiv: '2026-11-19'}); check('dividend: ex-dividend today counts as still ahead', [d.exIn, d.next], [0, '2026-11-19']);
  d = dv({dy: 0.02, div: 2, exdiv: '2026-12-01'}, null); check('dividend: without the file\'s date, no days are worked out', [d.exIn, d.next, d.last], [null, null, null]);
  // no payout column: the dividend against the yield worked out here. 3% against 5% is 60%; against 2% it is 150%
  d = dv({dy: 0.03, fcfy: 0.05}); check('dividend: 3% paid from a 5% cash yield takes 60%', [d.share, d.shareOwn, d.over], [0.6, true, false], 1e-12);
  d = dv({dy: 0.03, fcfy: 0.02}); check('dividend: 3% paid from a 2% cash yield takes 150%, more than there is', [Math.round(d.share * 1e6) / 1e6, d.over, d.none], [1.5, true, false]);
  d = dv({dy: 0.03, fcfy: -0.01}); check('dividend: with no spare cash it is not covered', [d.share, d.none, d.over], [null, true, true]);
  d = dv({dy: 0.03, fpay: -0.4, fcfy: 0.05}); check('dividend: a negative payout in the file means no spare cash', [d.share, d.none, d.over], [null, true, true]);
  d = dv({dy: 0.03, fpay: 1.4}); check('dividend: 140% of the spare cash is more than there is', [d.share, d.over, d.none], [1.4, true, false]);
  d = dv({dy: 0.03}); check('dividend: with neither figure, nothing is said about the cash', [d.share, d.over], [null, false]);
  // lower than a year ago: 15% counts, 1% is rounding or currency
  check('dividend: 15% lower than a year ago', dv({dy: 0.03, dg1: -0.15}).down, 0.15); check('dividend: 1% lower is not called lower', dv({dy: 0.03, dg1: -0.01}).down, null);
  // when the file also counts the past year as a year of growth, the two columns disagree and nothing is claimed
  check('dividend: lower by one column, raised by the other: not called lower', dv({dy: 0.03, dg1: -0.15, dgyrs: 3}).down, null);
  check('dividend: lower, and no year of growth: called lower', dv({dy: 0.03, dg1: -0.15, dgyrs: 0}).down, 0.15);
  // either figure will do: a 2.5% yield on an $80 share is $2 a year; $3 a year on a $60 share is 5%
  check('dividend: the amount from the yield', E.dividendOf({dy: 0.025, price: 80}, C, T).amount, 2, 1e-12); check('dividend: the yield from the amount', E.dividendOf({div: 3, price: 60}, C, T).yld, 0.05, 1e-12);
  d = dv({dy: 0.04, div: 4, dfreq: 'Semi-Annual'}); check('dividend: twice a year, $2 each', [d.times, d.each], [2, 2]);
  d = dv({dy: 0.04, div: 4, dfreq: 'Irregular'}); check('dividend: an unknown rhythm gives no payment size', [d.times, d.freq, d.each], [null, null, null]);
  d = dv({dy: 0.04, div: 4, dyrs: 0, dgyrs: 0}); check('dividend: no years to speak of', [d.years, d.raised], [null, null]);
  d = dv({dy: null, div: 0, dyrs: 9, exdiv: '2026-12-01'}); check('dividend: a company that pays none', [d.pays, d.amount, d.years, d.exIn], [false, null, null, null]);
  // dividends play no part in any test, list or order: the same companies, with and without them, land in the same places
  const plain = E.run(universe(), {}, {today: T}), rich = E.run(universe().map((r, i) => Object.assign(r, {dy: 0.09, div: 9, dyrs: 40, dgyrs: 40, fpay: i % 2 ? 3 : 0.1, dg1: -0.5, exdiv: '2026-11-25', dfreq: 'Quarterly'})), {}, {today: T});
  const key = r => [r.sym, r.Q, r.V, r.P, r.T, r.g, r.n5, r.lists, r.grade, r.alist, r.onSale, r.put, r.moon, r.slipping, r.ceiling, r.blocks];
  check('dividend: every company is graded and listed the same with or without one', rich.rows.map(key), plain.rows.map(key));
  check('dividend: the lists are the same', E.memberships(rich.rows, ['Q', 'V', 'S', 'P', 'T']), E.memberships(plain.rows, ['Q', 'V', 'S', 'P', 'T']));
  check('dividend: every company carries its dividend facts', [rich.rows.every(r => r.dividend && r.dividend.pays && r.dividend.exIn === 6), plain.rows.every(r => r.dividend && !r.dividend.pays)], [true, true]);
  check('dividend: the file is known to have dividend columns, or not', [rich.can.div, plain.can.div], [true, false]); }

console.log('--- The guide keeps step with the page ---');
{ // prism/guide/index.html is a page of lessons about Prism. It must not drift from it. Every name it sets as a label
  // (class "k") must be on the page, word for word. Every "Show me" link must name a real list, a real order and a real
  // part of the page. Every named list must be in the guide under its own name. And it must keep the lines Prism always
  // carries: it lists companies to research and does not say what to buy, most moonshots disappoint, and nothing here
  // has been tested against later returns.
  const guide = fs.readFileSync(path.join(__dirname, '..', 'prism', 'guide', 'index.html'), 'utf8');
  const ui = html.slice(html.indexOf('</script>', html.indexOf('<script id="engine">')));   // the page script, after the engine
  const plain = t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const onPage = n => [n, n.replace(/&/g, '&amp;'), n.replace(/'/g, "\\'")].some(v => html.includes(v));
  const all = (re, src) => { const o = []; let x; while ((x = re.exec(src))) o.push(x); return o; };
  const names = all(/<(b|span|a)\b[^>]*\bclass="k(?: s)?"[^>]*>([\s\S]*?)<\/\1>/g, guide).map(x => plain(x[2]));
  const missing = [...new Set(names)].filter(n => !onPage(n));
  missing.forEach(n => console.log('     the guide names "' + n + '", which is not on the page'));
  check('guide: it names menus, tags and headings (at least 80 of them)', names.length >= 80, true);
  check('guide: every name is on the page, word for word', missing, []);
  // what the page offers: the lists of the Show menu, the orders, and the parts a lesson may point at
  const LI = new Function(ui.match(/const LI = \{[\s\S]*?\n\};/)[0] + '\nreturn LI;')();
  const sorts = Object.keys(new Function(ui.match(/const SORTS = \{[\s\S]*?\n\};/)[0] + '\nreturn SORTS;')());
  check('guide: the page has nine named lists', Object.keys(LI).length, 9);
  check('guide: the engine and the page agree on the named lists', Object.keys(LI).slice().sort(), E.LISTS.slice().sort());
  const lists = ['sale', 'put', 'A', '', 'near', 'moon'].concat(Object.keys(LI)), parts = ['detail', 'vform'];
  const gos = all(/<a\b[^>]*\bdata-go='([^']+)'[^>]*>([\s\S]*?)<\/a>/g, guide).map(x => [JSON.parse(x[1]), plain(x[2])]);
  const bad = gos.filter(([g]) => (g.list !== undefined && !lists.includes(g.list)) || (g.sort !== undefined && !sorts.includes(g.sort)) || (g.open !== undefined && g.open !== 'first') ||
    (g.box !== undefined && g.box !== 'self') || !g.el || !(parts.includes(g.el) || html.includes('id="' + g.el + '"')) || (parts.includes(g.el) && g.open !== 'first'));
  bad.forEach(([g, t]) => console.log('     "' + t + '" points at something the page does not have: ' + JSON.stringify(g)));
  check('guide: it has "Show me" links (at least 30)', gos.length >= 30, true);
  check('guide: every "Show me" link names a real list, order and part of the page', bad, []);
  const unlisted = Object.keys(LI).filter(k => !gos.some(([g, t]) => g.list === k && t === LI[k][0]));
  check('guide: every named list is in the guide under its own name', unlisted, []);
  const menu = ['A-list on sale', 'Put desk', 'The whole A-list', 'Yes to all five questions', 'Near misses: one question short', 'Moonshots'];
  check('guide: the other lists of the Show menu are named', menu.filter(n => !names.includes(n) || !onPage(n)), []);
  const verdicts = new Function(ui.match(/const VERDICTS = \[[^\]]*\];/)[0] + '\nreturn VERDICTS;')();
  check('guide: all five verdicts are named', verdicts.filter(v => !names.includes(v)), []);
  const GQ = new Function(ui.match(/const GQ = \{[\s\S]*?\n\};/)[0] + '\nreturn GQ;')();
  check('guide: the five questions are named as the page asks them', Object.keys(GQ).length === 5 ? Object.keys(GQ).map(k => GQ[k][0]).filter(q => !names.includes(q)) : ['not five'], []);
  // The pass marks are settings: they live on the page, where a change to one updates every note. None is typed here.
  const words = plain(guide.slice(guide.indexOf('<div class="wrap"'), guide.indexOf('<script>')));
  check('guide: no pass marks or prices typed in', (words.match(/[0-9][0-9.,]*\s?%|\$\s?[0-9]/g) || []), []);
  check('guide: it says Prism does not tell you what to buy', /Prism lists companies to research\. It does not tell you what to buy/.test(words), true);
  check('guide: it says most moonshots disappoint', /Most companies like these disappoint/.test(words), true);
  check('guide: it says nothing has been tested against later returns, and that it is not advice', /tested against later returns/.test(words) && /not investment advice/.test(words), true);
  check('guide: it never calls a list proven', /\bproven\b/i.test(words), false);
  check('guide: the page reads the note the guide leaves', /ftolShow\('prism'\)/.test(html) && /data-tool="prism"/.test(guide) && /localStorage\.setItem\('ftol-show'/.test(guide), true); }

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
