// Prism: engine check.
// Run after any change to the engine in prism/index.html:   node tests/check-prism.js
// Every check has a hand-worked expected value. Exit code is 1 if anything fails.
// The companies below are invented; no screener data is stored in this repository.
// It also checks that the guide (prism/guide/index.html) names only what is really on the page.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'prism', 'index.html'), 'utf8');
const eng = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const E = new Function(eng + '\nreturn {CONTROLS,FIELDS,VERIFIED,LENS,LISTS,MINING,normHeader,parseCSV,toNumber,toDate,mapTable,derive,strengthOf,annuity,impliedGrowth,bucketOf,laneOf,rankGroup,run,memberships,gradeOf,saleOf,moonOf,judge,daysBetween,median,cardStep,cardStats,slipOf,slipState,crowd,changes,dividendOf,SIGNS,KINDS,KIND_OF,kindOf,signNow,signAgo,signsFor,signKeys,monthsBack,trackStep,signSeries,signCompare,readSign,signFromFile,readOwn,ownYearKey,signTally,signsRead,A_TESTS,L_TESTS,gradeLender,RUN_MEASURES,runFig,debtFig,peerKey,peerGroups,standing,rivalsOf,runRead,cashUse,paidOut,ownersRead};')();
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
// The headings of the 93 columns Prism reads, spelled as the provider's full download (336 columns, 2026-11-20) spells
// them. Headings only: the values below are invented.
{ const FULL = ['Symbol', 'Company Name', 'Sector', 'Industry', 'Stock Price', 'Market Cap', 'Avg. Volume', 'Revenue', 'PE Ratio', 'EV/EBITDA',
    'Debt / EBITDA', 'Total Cash', 'Total Debt', 'Net Cash', 'FCF Yield', 'ROIC', 'Rev. Growth', 'FCF Growth', 'Shares Ch. (YoY)', 'Return 1Y',
    'Country', 'Exchange', 'CIK Code', 'Price Date', 'Last Split Date', 'Ent. Value', 'FCF', 'SBC', 'Shares', 'Forward PE', 'EV/FCF', 'PB Ratio',
    'Int. Cov.', 'Z-Score', 'F-Score', 'Analysts', 'Earnings Yield', 'ROIC (5Y)', 'ROE', 'Gross Margin', 'Oper. Margin', 'FCF Margin',
    'Rev. Growth 3Y', 'Rev. Growth 5Y', 'EPS Growth', 'Buyback Yield', '52W High Chg', 'Shares Insiders', 'Short % Float',
    'Profit Years', 'Rev. Growth 10Y', 'Operating CF', 'Net Income', 'ND / EBITDA', 'PE (5Y)', 'PE (10Y)', 'Return 1W', 'Return 1M', '50MA Chg %', 'ATR',
    'Options', 'Next Earnings', 'Rev Gr. Next Y', 'Rev. Growth (Q)', 'OpInc Growth', 'EPS Growth (Q)',
    'Div. Yield', 'Dividend', 'Div. Years', 'Div. Gr. Years', 'FCF Payout', 'Div. Growth', 'Ex-Div Date', 'Payout Freq.',
    'Rev / Employee', 'Empl. Growth', 'FCF / Share', 'GP Growth', 'Asset Turnover', 'Inv. Turnover', 'BV / Share', 'EPS', 'ROE (5Y)', 'Last Report Date', 'Last Earnings',
    'ROA', 'Equity', 'Assets', 'CapEx', 'Investing CF', 'Debt Growth (YoY)', 'Goodwill', '10K Date'];
  // look-alike headings that are also in the download and must not be mistaken for the ones above
  const DECOYS = ['Shares Ch. (QoQ)', 'FCF Growth 3Y', 'EPS Growth 3Y', 'Rev. Growth (QoQ)', 'OpInc Growth (Q)', 'EPS Growth (QoQ)', 'Return 3M', 'PE (3Y)', 'Short % Shares', 'FCF / EV', 'ND / Equity', '200MA Chg %', 'Rev Gr. Next Q', 'Earnings Date',
    'Div. Growth 3Y', 'Div. Growth 5Y', 'Div. Growth 10Y', 'Payout Ratio', 'Payment Date', 'Last Div.', 'Shareh. Yield',
    'Prof / Employee', 'Empl. Change', 'Employees', 'FCF Growth (Q)', 'GP Growth 3Y', 'GP Growth (Q)', 'WC Turnover', 'TBV / Share', 'EPS Growth (Qtrs)', 'Est. EPS', 'ROA (5Y)', 'Earnings Time',
    'Debt Growth (QoQ)', 'Debt Growth (3Y)', 'Financing CF', 'LT Assets', 'Curr. Assets', 'Debt / Equity', 'ROCE', 'TBV'];
  const row = FULL.map(() => ''), set = (h, v) => { row[FULL.indexOf(h)] = v; };
  set('Symbol', 'zzz.x'); set('Stock Price', '40'); set('Market Cap', '2000000000'); set('FCF Yield', '9.00%'); set('FCF', '100000000'); set('ROIC', '12.50%');
  set('Shares Ch. (YoY)', '-0.21%'); set('CIK Code', '0000123456'); set('Price Date', '2026-11-19'); set('Ent. Value', '2500000000'); set('Int. Cov.', '-4.5');
  set('Z-Score', '2.75'); set('F-Score', '7'); set('52W High Chg', '-10.88%'); set('Short % Float', '0.82%');
  set('Profit Years', '35'); set('50MA Chg %', '-4.18%'); set('Options', 'Yes'); set('Next Earnings', '2027-01-27'); set('ND / EBITDA', '-0.0356');
  set('Div. Yield', '2.50%'); set('Dividend', '1'); set('Div. Years', '12'); set('Div. Gr. Years', '5'); set('FCF Payout', '40.00%'); set('Div. Growth', '-11.80%'); set('Ex-Div Date', '2026-12-01'); set('Payout Freq.', 'Semi-Annual');
  set('Rev / Employee', '250000'); set('Empl. Growth', '2.00%'); set('FCF / Share', '4.125'); set('GP Growth', '-3.50%'); set('Asset Turnover', '0.85'); set('Inv. Turnover', '6.2'); set('BV / Share', '18.75'); set('EPS', '-1.2'); set('ROE (5Y)', '14.00%'); set('Last Report Date', '2026-09-30'); set('Last Earnings', '2026-11-05');
  set('ROA', '1.25%'); set('Equity', '900'); set('Assets', '10000'); set('CapEx', '-200'); set('Investing CF', '-500'); set('Debt Growth (YoY)', '10.00%'); set('Goodwill', '300'); set('10K Date', '2026-02-13');
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
  check('full download: the columns behind the signs', [r.rpe, r.emplg, r.fcfps, Math.round(r.gpg * 1e6) / 1e6, r.ato, r.invt, r.bvps, r.eps, Math.round(r.roe5 * 1e6) / 1e6, r.lastrep, r.lastearn], [250000, 0.02, 4.125, -0.035, 0.85, 6.2, 18.75, -1.2, 0.14, '2026-09-30', '2026-11-05']);
  check('full download: the columns behind a bank\'s tests and the use of cash', [r.roa, r.equity, r.assets, r.capex, r.invcf, Math.round(r.debtg * 1e6) / 1e6, r.goodwill, r.tenk], [0.0125, 900, 10000, -200, -500, 0.1, 300, '2026-02-13']);
  check('the engine reads 93 columns', E.FIELDS.length, 93);
  // a spelling that is only a guess is reported as one: "Ticker" and "Enterprise Value" are not the provider's headings
  check('a guessed spelling is reported', E.mapTable(['Ticker', 'Enterprise Value'], [['x', '5']]).report.guessed, ['sym', 'ev']);
  // The yield is free cash flow over the whole company's market value: 100m / 2,000m = 5%, though the file's column says 9%
  E.derive(r); check('yield: company cash flow over company value', r.fcfy, 0.05); check('yield: the file\'s own figure is kept', r.fcfy_file, 0.09);
  E.derive(r); check('yield: unchanged when worked out again', [r.fcfy, r.fcfy_file], [0.05, 0.09]);
  // the owners' money as a share of everything held: 900 / 10,000
  check('owners\' money over assets is 9%', r.eqa, 0.09);
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

console.log('--- Signs that a business is winning ---');
{ // Which figures show that a business is winning depends on the kind of business. Worked by hand; the companies are invented.
  const SG = E.SIGNS, K = E.KINDS, r6 = x => x == null ? x : Math.round(x * 1e6) / 1e6;
  // the kinds of business
  check('kinds: a consultancy is a people business', E.kindOf({industry: 'Information Technology Services'}), 'people');
  check('kinds: a chip maker, a bank and an office landlord', ['Semiconductors', 'Banks - Regional', 'REIT - Office'].map(i => E.kindOf({industry: i})), ['hardware', 'lender', 'property']);
  check('kinds: an industry Prism does not know, or none at all, gets the general signs', [E.kindOf({industry: 'Zeppelin Makers'}), E.kindOf({}), E.kindOf(null)], ['general', 'general', 'general']);
  check('kinds: every industry points at a real kind', Object.keys(E.KIND_OF).filter(i => !K[E.KIND_OF[i]]), []);
  { const src = eng.slice(eng.indexOf('var KIND_OF'), eng.indexOf('function kindOf')), labels = src.match(/'[A-Z][^']*'/g) || [];
    check('kinds: no industry is filed under two kinds', labels.length, Object.keys(E.KIND_OF).length); }
  check('kinds: every kind but the general one has industries', Object.keys(K).filter(k => k !== 'general' && !Object.keys(E.KIND_OF).some(i => E.KIND_OF[i] === k)), []);
  check('kinds: each calls only on signs that exist', Object.keys(K).filter(k => E.signKeys(k).some(s => !SG[s])), []);
  check('kinds: each shows four or five signs', Object.keys(K).filter(k => K[k].signs.length < 4 || K[k].signs.length > 5), []);
  check('kinds: every sign is used by some kind', Object.keys(SG).filter(s => !Object.keys(K).some(k => E.signKeys(k).includes(s))), []);
  check('kinds: each has a name, a sentence on what winning looks like, and its own-report signs as [name, higher is better]',
    Object.keys(K).filter(k => !K[k].name || !/\.$/.test(K[k].what) || !Array.isArray(K[k].own) || K[k].own.some(a => typeof a[0] !== 'string' || typeof a[1] !== 'boolean')), []);
  check('signs: each has a name, a question, a direction, a unit and an allowance', Object.keys(SG).filter(s => !SG[s].name || !/\?$/.test(SG[s].ask) || typeof SG[s].up !== 'boolean' || !/^(rate|pct|usd|x|count)$/.test(SG[s].unit) || !/^(abs|rel)$/.test(SG[s].tol[0]) || !(SG[s].tol[1] > 0)), []);
  check('signs: the people business has the four the owner named', E.signKeys('people'), ['grow', 'rpe', 'gm', 'cash']);
  // the figure now
  const Z = {revgq: 0.08, revg: 0.05, gm: 0.40, gpg: 0.10, om: 0.20, oig: 0.25, rpe: 300000, emplg: 0.02, fcfps: 5, fcfg: 0.20, sh: -0.04, shares: 96e6, eps: 4.4, epsg: 0.10, roic: 0.18, roic5: 0.21, roe: 0.15, roe5: 0.12, ato: 0.9, invt: 6, bvps: 20, ndlev: 1.5, netcash: -100};
  check('now: sales growth is the latest quarter\'s', E.signNow(Z, 'grow'), 0.08);
  check('now: without a quarterly figure, the year\'s', E.signNow({revg: 0.05}, 'grow'), 0.05);
  check('now: the plain figures', ['rpe', 'gm', 'om', 'cash', 'roic', 'turn', 'stock', 'shares', 'debt', 'roe', 'book', 'eps'].map(k => E.signNow(Z, k)), [300000, 0.40, 0.20, 5, 0.18, 0.9, 6, 96e6, 1.5, 0.15, 20, 4.4]);
  // without a per-share column: 200 of spare cash over 50 shares is 4
  check('now: spare cash per share from the totals', E.signNow({fcf: 200, shares: 50}, 'cash'), 4);
  check('now: more cash than debt is a figure below zero', E.signNow({ndlev: -0.4, netcash: 50}, 'debt'), -0.4);
  check('now: net debt with a loss where the earnings should be has no figure', E.signNow({ndlev: -2, netcash: -100}, 'debt'), null);
  check('now: nothing in the file, no figure', ['grow', 'rpe', 'cash', 'shares', 'debt'].map(k => E.signNow({}, k)), [null, null, null, null, null]);
  // a year before, from the same file. Gross margin: 0.40 x 1.05 / 1.10 = 0.381818. Operating margin: 0.20 x 1.05 / 1.25 = 0.168.
  check('a year before: gross margin 38.18%', E.signAgo(Z, 'gm'), 0.40 * 1.05 / 1.10, 1e-12); check('a year before: gross margin, to six places', r6(E.signAgo(Z, 'gm')), 0.381818);
  check('a year before: operating margin 16.8%', E.signAgo(Z, 'om'), 0.168, 1e-12);
  // sales per employee: 300,000 x 1.02 / 1.05 = 291,428.57
  check('a year before: sales per employee 291,429', E.signAgo(Z, 'rpe'), 291428.571429, 1e-5);
  // spare cash per share: cash grew 20% on 4% fewer shares, so 5 x 0.96 / 1.20 = 4.00
  check('a year before: spare cash per share 4.00', E.signAgo(Z, 'cash'), 4, 1e-12);
  check('a year before: 100m shares, 4% more than now', E.signAgo(Z, 'shares'), 1e8, 1e-3);
  check('a year before: profit per share 4.00', E.signAgo(Z, 'eps'), 4, 1e-12);
  check('set against: sales growth, the year as a whole', [E.signAgo(Z, 'grow'), SG.grow.ago], [0.05, 'whole']);
  check('set against: returns, their five-year average', [E.signAgo(Z, 'roic'), E.signAgo(Z, 'roe'), SG.roic.ago, SG.roe.ago], [0.21, 0.12, 'avg5', 'avg5']);
  check('set against: nothing, for turnover, debt and book value', ['turn', 'stock', 'debt', 'book'].map(k => E.signAgo(Z, k)), [null, null, null, null]);
  check('a year before: without the growth figure, unknown', [E.signAgo({gm: 0.4, revg: 0.05}, 'gm'), E.signAgo({fcfps: 5, sh: 0.01}, 'cash'), E.signAgo({revg: 0.05}, 'grow')], [null, null, null]);
  check('a year before: a share count that moved by more than half is a split, not a trend', [E.signAgo({shares: 2e8, sh: 1}, 'shares'), E.signAgo({fcfps: 5, fcfg: 0.2, sh: 1}, 'cash')], [null, null]);
  check('a year before: a loss has no rate of change to undo', [E.signAgo({eps: -1, epsg: 0.5}, 'eps'), E.signAgo({om: -0.05, revg: 0.1, oig: 0.2}, 'om')], [null, null]);
  // 0.90 x 1.50 / 1.10 = 1.227: a margin above 100% is no margin
  check('a year before: an impossible margin is dropped', E.signAgo({gm: 0.9, revg: 0.5, gpg: 0.1}, 'gm'), null);
  // which signs a company gets
  check('signs for a shop that reports its inventory', E.signsFor({invt: 6, ato: 1.5}, 'shops'), ['grow', 'om', 'stock', 'roic', 'cash']);
  check('signs for a shop that does not: sales per dollar of assets takes its place', E.signsFor({ato: 1.5}, 'shops'), ['grow', 'om', 'turn', 'roic', 'cash']);
  check('signs for a shop with neither: the first is named, and shown as missing', E.signsFor({}, 'shops'), ['grow', 'om', 'stock', 'roic', 'cash']);
  check('both are kept on record, so the choice can change', E.signKeys('shops'), ['grow', 'om', 'stock', 'turn', 'roic', 'cash']);
  check('a fee business with no cash figure is read on profit per share', E.signsFor({eps: 3}, 'fees'), ['grow', 'om', 'rpe', 'eps', 'shares']);
  check('an unknown kind is read as the general one', E.signsFor(Z, 'nonsense'), ['grow', 'gm', 'roic', 'cash', 'shares']);
  // dates
  check('months back: a month end stays a month end', [E.monthsBack('2026-08-31', 12), E.monthsBack('2026-05-31', 3), E.monthsBack('2024-02-29', 12), E.monthsBack('2026-01-31', 3)], ['2025-08-31', '2026-02-28', '2023-02-28', '2025-10-31']);
  check('months back: any other day keeps its number', [E.monthsBack('2026-09-26', 12), E.monthsBack('2026-03-15', 6), E.monthsBack('2026-03-30', 1)], ['2025-09-26', '2025-09-15', '2026-02-28']);
  // better, worse or the same. Gross margin allows 0.3 of a point; the share count allows 0.5% and is better when lower.
  check('compare: 0.2 of a point is the same', E.signCompare(SG.gm, 0.402, 0.400), 'same'); check('compare: exactly the allowance is still the same', E.signCompare(SG.gm, 0.403, 0.400), 'same');
  check('compare: 0.31 of a point up is better, down is worse', [E.signCompare(SG.gm, 0.4031, 0.400), E.signCompare(SG.gm, 0.3969, 0.400)], ['better', 'worse']);
  check('compare: 1% fewer shares is better, 1% more is worse, 0.4% more is the same', [E.signCompare(SG.shares, 99, 100), E.signCompare(SG.shares, 101, 100), E.signCompare(SG.shares, 100.4, 100)], ['better', 'worse', 'same']);
  check('compare: debt down from 1.5 to 1.2 is better; 1.45 is the same', [E.signCompare(SG.debt, 1.2, 1.5), E.signCompare(SG.debt, 1.45, 1.5)], ['better', 'same']);
  // sales per employee allows 1%: 303,000 against 300,000 is exactly 1%, the same; 304,000 is better
  check('compare: an allowance that is a share of the earlier figure', [E.signCompare(SG.rpe, 303000, 300000), E.signCompare(SG.rpe, 304000, 300000)], ['same', 'better']);
  check('compare: a missing figure gives no answer', [E.signCompare(SG.gm, null, 0.4), E.signCompare(SG.gm, 0.4, null)], [null, null]);
  // reading one sign from five reports: up 0.4 of a point each quarter
  const five = [['2025-09-30', 0.380], ['2025-12-31', 0.384], ['2026-03-31', 0.388], ['2026-06-30', 0.392], ['2026-09-30', 0.396]].map(a => ({p: a[0], v: a[1]}));
  let x = E.readSign(SG.gm, five, 0.50);
  check('read: now, the report before and a year before', [x.now, x.period, x.prev, x.prevPeriod, x.year, x.yearPeriod], [0.396, '2026-09-30', 0.392, '2026-06-30', 0.380, '2025-09-30']);
  check('read: the record is used before the file\'s own sum', x.yearFrom, 'record');
  check('read: better than both, four reports running', [x.vsPrev, x.vsYear, x.run, x.state], ['better', 'better', 4, 'better']);
  // the same five, but the last quarter fell back by 0.5 of a point: worse than the report before, still better than a year before
  x = E.readSign(SG.gm, five.slice(0, 4).concat([{p: '2026-09-30', v: 0.387}]), null);
  check('read: slipped since the report before, still better than a year before', [x.vsPrev, x.vsYear, x.run, x.state], ['worse', 'better', 1, 'better']);
  // two reports a quarter apart: nothing on record from a year before, so the file's own sum is used (0.396 against 0.39 is 0.6 of a point)
  x = E.readSign(SG.gm, five.slice(3), 0.39);
  check('read: without a year on record, the file\'s figure', [x.year, x.yearFrom, x.vsYear, x.vsPrev, x.run, x.state], [0.39, 'year', 'better', 'better', 1, 'better']);
  x = E.readSign(SG.grow, [{p: '2026-09-30', v: 0.08}], 0.05);
  check('read: one report, sales growth against the year as a whole', [x.prev, x.vsPrev, x.year, x.yearFrom, x.vsYear, x.state], [null, null, 0.05, 'whole', 'better', 'better']);
  x = E.readSign(SG.turn, five.slice(3), null);
  check('read: with no year at all, the report before decides', [x.year, x.vsYear, x.vsPrev, x.state], [null, null, 'same', 'same']);
  x = E.readSign(SG.turn, [{p: '2026-09-30', v: 0.9}], null);
  check('read: one report and nothing to set it against is too early to say', [x.now, x.state, x.run], [0.9, null, 0]);
  x = E.readSign(SG.gm, [], 0.39); check('read: no figure, no reading', [x.now, x.state, x.year], [null, null, null]);
  // a report a year back is not "the report before"
  x = E.readSign(SG.gm, [{p: '2025-09-30', v: 0.380}, {p: '2026-09-30', v: 0.396}], null);
  check('read: a figure from a year back is the year before, not the report before', [x.prev, x.vsPrev, x.year, x.yearFrom, x.vsYear, x.run], [null, null, 0.380, 'record', 'better', 0]);
  // a run stops at a gap in the record: Mar, Jun, Sep 2026 after a lone Mar 2025
  x = E.readSign(SG.gm, [{p: '2025-03-31', v: 0.37}, {p: '2026-03-31', v: 0.388}, {p: '2026-06-30', v: 0.392}, {p: '2026-09-30', v: 0.396}], null);
  check('read: a run does not jump a gap in the record', [x.vsPrev, x.run, x.year], ['better', 2, null]);
  // headcount comes once a year: no report-to-report reading for sales per employee
  x = E.readSign(SG.rpe, [{p: '2025-09-30', v: 280000}, {p: '2026-06-30', v: 300000}, {p: '2026-09-30', v: 300000}], null);
  check('read: a yearly sign is set only against a year before', [x.prev, x.vsPrev, x.run, x.year, x.vsYear, x.state], [null, null, 0, 280000, 'better', 'better']);
  // 330 to 400 days counts as a year: a 53-week year (371 days) does, nine months (273) does not
  check('read: a 53-week year is a year', E.readSign(SG.gm, [{p: '2025-09-27', v: 0.38}, {p: '2026-10-03', v: 0.39}], null).yearFrom, 'record');
  check('read: nine months is not', E.readSign(SG.gm, [{p: '2025-12-31', v: 0.38}, {p: '2026-09-30', v: 0.39}], null).year, null);
  // the record, file by file
  const keep = n => () => n, A = (o) => Object.assign({sym: 'AAA', industry: 'Consulting Services', lastrep: '2026-06-30', revgq: 0.0612378, rpe: 250000, gm: 0.3, fcfps: 4.123456}, o);
  let rec = E.trackStep(null, [A()], {AAA: 'people'}, '2026-08-01', keep(12));
  check('record: the first file starts it, figures to five digits', rec, {AAA: {k: ['grow', 'rpe', 'gm', 'cash'], q: {'2026-06-30': [0.061238, 250000, 0.3, 4.1235]}, at: '2026-08-01', nu: '2026-08-01'}});
  const one = JSON.stringify(rec);
  let rec2 = E.trackStep(rec, [A({gm: 0.31})], {AAA: 'people'}, '2026-08-08', keep(12));
  check('record: a later file with the same report refreshes it', [rec2.AAA.q['2026-06-30'][2], Object.keys(rec2.AAA.q).length, rec2.AAA.at, rec2.AAA.nu], [0.31, 1, '2026-08-08', '2026-08-01']);
  check('record: the earlier record is not altered in place', JSON.stringify(rec), one);
  let rec3 = E.trackStep(rec2, [A({lastrep: '2026-09-30', gm: 0.32, revgq: 0.07})], {AAA: 'people'}, '2026-11-05', keep(12));
  check('record: a new report is added and dated', [Object.keys(rec3.AAA.q), rec3.AAA.q['2026-09-30'][2], rec3.AAA.at, rec3.AAA.nu], [['2026-06-30', '2026-09-30'], 0.32, '2026-11-05', '2026-11-05']);
  check('record: the same file again changes nothing', JSON.stringify(E.trackStep(rec3, [A({lastrep: '2026-09-30', gm: 0.32, revgq: 0.07})], {AAA: 'people'}, '2026-11-05', keep(12))), JSON.stringify(rec3));
  check('record: an older file changes nothing', JSON.stringify(E.trackStep(rec3, [A({gm: 0.99})], {AAA: 'people'}, '2026-08-08', keep(12))), JSON.stringify(rec3));
  check('record: no report date in the file, nothing kept', E.trackStep({}, [A({lastrep: null})], {AAA: 'people'}, '2026-08-01', keep(12)), {});
  check('record: no file date, the record is returned as it was', E.trackStep(rec3, [A()], {AAA: 'people'}, null, keep(12)) === rec3, true);
  check('record: a company nobody asked for is not recorded', E.trackStep({}, [A()], {}, '2026-08-01', keep(12)), {});
  // only the newest two are kept when two is the limit
  let rec4 = E.trackStep(rec3, [A({lastrep: '2026-12-31'})], {AAA: 'people'}, '2027-02-01', keep(2));
  check('record: only as many reports as asked for are kept, the newest', Object.keys(rec4.AAA.q), ['2026-09-30', '2026-12-31']);
  // a 2-for-1 split on 1 Dec 2026, after the last file read (5 Nov): what was recorded per share is on the old count
  let rec5 = E.trackStep(rec3, [A({lastrep: '2026-12-31', split: '2026-12-01', fcfps: 2.1})], {AAA: 'people'}, '2027-02-01', keep(12));
  check('record: after a split, earlier per-share figures are dropped and the rest kept', [rec5.AAA.q['2026-06-30'], rec5.AAA.q['2026-09-30'], rec5.AAA.q['2026-12-31'][3]], [[0.061238, 250000, 0.31, null], [0.07, 250000, 0.32, null], 2.1]);
  check('record: a split from before the last file read changes nothing', E.trackStep(rec3, [A({lastrep: '2026-12-31', split: '2026-10-01'})], {AAA: 'people'}, '2027-02-01', keep(12)).AAA.q['2026-09-30'][3], 4.1235);
  // read as another kind: the signs both kinds share keep their history, the new ones start empty
  let rec6 = E.trackStep(rec3, [A({lastrep: '2026-09-30', gm: 0.32, revgq: 0.07, om: 0.2, shares: 5e7})], {AAA: 'software'}, '2026-11-06', keep(12));
  check('record: read as another kind, shared signs keep their history', [rec6.AAA.k, rec6.AAA.q['2026-06-30'], rec6.AAA.q['2026-09-30']], [['grow', 'gm', 'om', 'cash', 'shares'], [0.061238, 0.31, null, 4.1235, null], [0.07, 0.32, 0.2, 4.1235, 5e7]]);
  // no longer wanted: kept for 200 days after the last file read (5 Nov 2026 to 24 May 2027 is 200 days), then dropped
  check('record: a company no longer wanted is kept for 200 days', [!!E.trackStep(rec3, [], {}, '2027-05-24', keep(12)).AAA, !!E.trackStep(rec3, [], {}, '2027-05-25', keep(12)).AAA], [true, false]);
  check('record: a wanted company that has left the file keeps its record', JSON.stringify(E.trackStep(rec3, [], {AAA: 'people'}, '2028-01-01', keep(12)).AAA), JSON.stringify(rec3.AAA));
  check('record: its figures for one sign, oldest first', E.signSeries(rec3.AAA, 'gm'), [{p: '2026-06-30', v: 0.31}, {p: '2026-09-30', v: 0.32}]);
  check('record: a sign that is not kept has no figures', [E.signSeries(rec3.AAA, 'om'), E.signSeries(null, 'gm')], [[], []]);
  // a company as the page reads it: the latest figures from the row, earlier reports from the record
  const row = A({lastrep: '2026-09-30', lastearn: '2026-11-04', gm: 0.32, revgq: 0.07, revg: 0.05, gpg: 0.08, emplg: 0.03, fcfg: 0.10, sh: 0});
  let R = E.signsRead(row, 'people', rec3.AAA, null, '2026-11-05');
  check('company: its kind, its report and when it came out', [R.kind, R.period, R.out, R.periods], ['people', '2026-09-30', '2026-11-04', ['2026-09-30', '2026-06-30']]);
  check('company: the four signs, in order', R.file.map(s => s.k), ['grow', 'rpe', 'gm', 'cash']);
  // growth 7% against 5% for the year: better (2 points). Sales per employee: 250,000 x 1.03 / 1.05 = 245,238, up 1.9%: better.
  // Gross margin: 0.32 x 1.05 / 1.08 = 0.3111, up 0.9 of a point: better; against 0.31 the report before, up a point: better.
  // Spare cash per share: 4.123456 / 1.10 = 3.7486, up 10%: better; against 4.1235 the report before: the same.
  check('company: sales growth', [R.file[0].now, R.file[0].year, R.file[0].yearFrom, R.file[0].state, R.file[0].vsPrev], [0.07, 0.05, 'whole', 'better', 'same']);
  check('company: sales per employee, a year before from the file', [r6(R.file[1].year), R.file[1].state, R.file[1].vsPrev], [245238.095238, 'better', null]);
  check('company: gross margin', [r6(R.file[2].year), R.file[2].prev, R.file[2].vsPrev, R.file[2].state], [0.311111, 0.31, 'better', 'better']);
  check('company: spare cash per share', [r6(R.file[3].year), R.file[3].vsYear, R.file[3].vsPrev], [3.748596, 'better', 'same']);
  check('company: four better', R.tally, {better: 4, worse: 0, same: 0, wait: 0, n: 4});
  check('company: it has reported since the file before', R.fresh, true);
  check('company: not fresh on a later file, nor with only one report on record', [E.signsRead(row, 'people', rec3.AAA, null, '2026-11-12').fresh, E.signsRead(A(), 'people', rec.AAA, null, '2026-08-01').fresh], [false, false]);
  // an older file on show: the record's later reports are left out of its reading
  R = E.signsRead(A({gm: 0.31}), 'people', rec3.AAA, null, '2026-08-08');
  check('company: an older file is read as it stands', [R.period, R.periods, R.file[2].now, R.file[2].prev, R.fresh], ['2026-06-30', ['2026-06-30'], 0.31, null, false]);
  R = E.signsRead({sym: 'BBB', gm: 0.3}, 'people', null, null, '2026-08-01');
  check('company: without a report date there is a reading and no record', [R.period, R.periods, R.file[2].now, R.file[2].state, R.tally.wait], [null, [], 0.3, null, 4]);
  R = E.signsRead(A({rpe: null}), 'people', rec3.AAA, null, '2026-08-08');
  check('company: a figure missing from this file, with the last one on record', [R.file[1].now, R.file[1].state, R.file[1].last], [null, null, null]);
  R = E.signsRead(A({lastrep: '2026-12-31', rpe: null}), 'people', rec3.AAA, null, '2027-02-01');
  check('company: the last figure on record is offered when the file has none now', R.file[1].last, {p: '2026-09-30', v: 250000});
  // the reader's own signs
  const own = {n: 'New bookings', up: true, q: {'2025-09-30': [20, '20'], '2026-06-30': [23, '23.0'], '2026-09-30': [22, '22']}};
  let o = E.readOwn(own, '2026-09-30');
  check('own sign: now, the report before and a year before, as typed', [o.now, o.text, o.prev, o.prevText, o.year, o.yearText, o.yearFrom], [22, '22', 23, '23.0', 20, '20', 'record']);
  check('own sign: better than a year before, worse than the report before', [o.vsYear, o.vsPrev, o.run, o.state, o.judged], ['better', 'worse', 1, 'better', false]);
  o = E.readOwn(Object.assign({}, own, {up: false}), '2026-09-30');
  check('own sign: when lower is better the readings turn round', [o.vsYear, o.vsPrev, o.state], ['worse', 'better', 'worse']);
  o = E.readOwn(own, '2026-12-31');
  check('own sign: nothing typed for this report yet, the last one is offered', [o.now, o.state, o.last], [null, null, {p: '2026-09-30', v: 22, t: '22'}]);
  o = E.readOwn(own, '2026-06-30');
  check('own sign: a later entry is left out when an earlier report is on show', [o.now, o.prev, o.year, o.state], [23, null, null, null]);
  o = E.readOwn({n: 'x', up: true, q: {'2026-09-30': [100.4, '100.4'], '2026-06-30': [100, '100']}}, '2026-09-30');
  check('own sign: a change of under half a percent is the same', [o.vsPrev, o.state], ['same', 'same']);
  o = E.readOwn({n: 'x', up: true}, '2026-09-30'); check('own sign: nothing typed at all', [o.now, o.state, o.last], [null, null, null]);
  o = E.readOwn(own, null); check('own sign: no report date, no reading', [o.now, o.state], [null, null]);
  const jd = {n: 'Outcome-based contracts', up: null, q: {'2026-03-31': 'same', '2026-06-30': 'better', '2026-09-30': 'better'}};
  o = E.readOwn(jd, '2026-09-30');
  check('own sign: a judgement is the reading, two reports running', [o.judged, o.now, o.state, o.run], [true, 'better', 'better', 2]);
  o = E.readOwn(jd, '2026-12-31'); check('own sign: no judgement yet for a new report', [o.now, o.state, o.last], [null, null, {p: '2026-09-30', v: 'better', t: 'better'}]);
  o = E.readOwn({n: 'x', up: null, q: {'2026-09-30': [5, '5']}}, '2026-09-30'); check('own sign: a figure where a judgement belongs is ignored', [o.now, o.state], [null, null]);
  check('own sign: a year-before figure goes on a report already used a year back', E.ownYearKey(own, '2026-09-30'), '2025-09-30');
  check('own sign: or else on the same day a year earlier', [E.ownYearKey(own, '2026-12-31'), E.ownYearKey(null, '2026-08-31')], ['2025-12-31', '2025-08-31']);
  check('tally: better, worse, the same and not yet known', E.signTally(['better', 'better', 'worse', 'same', null, undefined]), {better: 2, worse: 1, same: 1, wait: 2, n: 6});
  // the company with its own signs: one typed and better, one waiting
  R = E.signsRead(row, 'people', rec3.AAA, [own, {n: 'Staff kept busy', up: true, q: {}}], '2026-11-05');
  check('company: the reader\'s signs are counted with Prism\'s', [R.own.map(s => [s.i, s.n, s.state]), R.tally, R.todo], [[[0, 'New bookings', 'better'], [1, 'Staff kept busy', null]], {better: 5, worse: 0, same: 0, wait: 1, n: 6}, 1]);
  check('company: reports the reader has typed figures for are listed too', R.periods, ['2026-09-30', '2026-06-30', '2025-09-30']);
  // signs play no part in any test, list or order: the same companies, with and without the figures, land in the same places
  const T = '2026-11-19', plain = E.run(universe(), {}, {today: T}), rich = E.run(universe().map((r, i) => Object.assign(r, {rpe: 1e5 + i, emplg: 0.5, fcfps: 9, gpg: -0.5, ato: 3, invt: 9, bvps: 1, eps: i % 2 ? -5 : 5, roe5: 0.9, lastrep: '2026-09-30', lastearn: '2026-11-01'})), {}, {today: T});
  const key = r => [r.sym, r.Q, r.V, r.P, r.T, r.g, r.n5, r.lists, r.grade, r.alist, r.onSale, r.put, r.moon, r.slipping, r.ceiling, r.blocks];
  check('signs: every company is graded and listed the same with or without them', rich.rows.map(key), plain.rows.map(key));
  check('signs: the lists are the same', E.memberships(rich.rows, ['Q', 'V', 'S', 'P', 'T']), E.memberships(plain.rows, ['Q', 'V', 'S', 'P', 'T']));
  check('signs: the file is known to carry report dates, or not', [rich.can.signs, plain.can.signs], [true, false]);
  // the page: a note for every sign, and words for each way a single file can be read
  const ui = html.slice(html.indexOf('</script>', html.indexOf('<script id="engine">')));
  const what = new Function(ui.match(/const SGWHAT = \{[\s\S]*?\n\};/)[0] + '\nreturn SGWHAT;')(), ago = new Function(ui.match(/const SGAGO = \{[\s\S]*?\n\};/)[0] + '\nreturn SGAGO;')();
  check('page: every sign has a note saying what it measures', Object.keys(SG).filter(s => !what[s]), []);
  check('page: and no note is left over', Object.keys(what).filter(s => !SG[s]), []);
  check('page: each way a single file can be read is explained', [...new Set(Object.keys(SG).map(s => SG[s].ago || 'none'))].filter(a => !ago[a]), []);
  check('page: it never calls a company winning or losing itself', /is winning\.|is losing|a winner\b|Prism thinks/i.test(ui.replace(/Is the business winning\?/g, '').replace(/Signs that a business is winning\./g, '').replace(/show a business is winning/g, '').replace(/Whether the company is winning is your call/g, '')), false);
}

console.log('--- Banks and insurers on the A-list ---');
{ // A lender has six tests of its own. Worked by hand; the companies are invented.
  const C = E.CONTROLS, bank = o => Object.assign({roe5: 0.14, roe: 0.12, py: 15, revg5: 0.06, revg10: 0.05, roa: 0.012, sh: 0.01, eqa: 0.09}, o || {});
  let g = E.gradeLender(bank(), C);
  check('lender: a sound bank passes all six', [g.yes, g.no, g.unk, g.lender], [6, [], [], true]);
  check('lender: the six tests, by name', E.L_TESTS, ['returns', 'profitable', 'grows', 'assets', 'shares', 'cushion']);
  check('lender: 11% on the owners\' money over five years is not enough', E.gradeLender(bank({roe5: 0.11}), C).no, ['returns']);
  check('lender: nor is 9% now', E.gradeLender(bank({roe: 0.09}), C).no, ['returns']);
  check('lender: exactly 12% and 10% pass', E.gradeLender(bank({roe5: 0.12, roe: 0.10}), C).t.returns, true);
  check('lender: 0.9% on its assets fails', E.gradeLender(bank({roa: 0.009}), C).no, ['assets']);
  check('lender: owners\' money under 7% of assets fails', E.gradeLender(bank({eqa: 0.069}), C).no, ['cushion']);
  check('lender: nine years of profit, slow sales and a rising share count each fail', [E.gradeLender(bank({py: 9}), C).no, E.gradeLender(bank({revg5: 0.03}), C).no, E.gradeLender(bank({revg10: 0.03}), C).no, E.gradeLender(bank({sh: 0.03}), C).no], [['profitable'], ['grows'], ['grows'], ['shares']]);
  g = E.gradeLender(bank({roa: null, eqa: null}), C);
  check('lender: a test the file can\'t answer is not a pass', [g.yes, g.unk], [4, ['assets', 'cushion']]);
  // in a whole file: banks sit beside ordinary companies
  const fin = (sym, o) => mk(sym, Object.assign({sector: 'Financials', industry: 'Banks - Regional', lev: null, ev_ebitda: null, pe: 10, pe10: 14, roe5: 0.14, roe: 0.12, py: 15, revg5: 0.06, roa: 0.012, sh: 0.01, equity: 9e8, assets: 1e10, dd: -0.30, epsgq: 0.05}, o || {}));
  const u = universe().concat([fin('GOODB'), fin('THINB', {equity: 6e8}), fin('WEAKB', {roe5: 0.07, roe: 0.06, roa: 0.006}), fin('TINYB', {cap: 1e8}), fin('SLIPB', {roe: 0.08, revgq: -0.05, epsgq: -0.20, oig: 0.50})]);
  const res = E.run(u, {}, {today: '2026-11-19'}), by = {}; res.rows.forEach(r => { by[r.sym] = r; });
  check('bank: set aside from the five questions, and still graded', [by.GOODB.aside, by.GOODB.scored, by.GOODB.g, by.GOODB.a.lender, by.GOODB.grade, by.GOODB.alist], ['financial', false, null, true, 'A', true]);
  check('bank: thin capital is one test short', [by.THINB.a.yes, by.THINB.a.no, by.THINB.grade, by.THINB.alist], [5, ['cushion'], 'B', false]);
  check('bank: the next tier lets it on', E.run(u.map(r => Object.assign({}, r)), {}, {today: '2026-11-19', tierB: true}).rows.find(r => r.sym === 'THINB').alist, true);
  check('bank: a weak one is nowhere near', [by.WEAKB.a.yes, by.WEAKB.alist], [4, false]);
  check('bank: one too small to score is not graded', [by.TINYB.a, by.TINYB.alist], [null, false]);
  check('bank: the reader\'s own choice still wins', E.run(u.map(r => Object.assign({}, r)), {}, {today: '2026-11-19', pins: {GOODB: 'out', WEAKB: 'in'}}).rows.filter(r => /B$/.test(r.sym) && r.alist).map(r => r.sym), ['WEAKB']);
  // what its price implies comes from earnings alone (a P/E of 10 is a 10% earnings yield); a bank's cash-flow yield is left out of it
  check('bank: the price is read from earnings alone', [by.GOODB.impg, by.GOODB.impg_e, by.GOODB.ceiling], [E.impliedGrowth(0.10, res.C), E.impliedGrowth(0.10, res.C), null]);
  // on sale: P/E 10 against its own 14 is 71%, under 75%; and 30% off its high. Two signs.
  check('bank: on sale is judged as for any company', [by.GOODB.sale.own, by.GOODB.sale.high, by.GOODB.onSale], [true, true, true]);
  check('bank: on the A-list and on-sale lists, not on the five-question ones', (() => { const m = E.memberships(res.rows, ['Q', 'V', 'S', 'P', 'T']); return [m.A.includes('GOODB'), m.sale.includes('GOODB'), m.all.includes('GOODB')]; })(), [true, true, false]);
  // slipping: the return on its owners' money is 8% against 14% over five years (under 80% of it); profit per share fell 20% in the quarter.
  // A rising "operating profit" figure does not rescue a lender: that figure means little for a bank.
  check('bank: slipping is read on the owners\' money and on profit per share', [by.SLIPB.slip.s.returns, by.SLIPB.slip.s.profit, by.SLIPB.slipping], [true, true, 'slipping']);
  check('bank: a steady one is not slipping', [by.GOODB.slip.s.returns, by.GOODB.slip.s.profit], [false, false]);
  check('ordinary companies are graded exactly as before', universe().length === 0 ? null : res.rows.filter(r => r.scored).every(r => r.a && !r.a.lender), true);
  // the new columns change nothing for an ordinary company
  const plain = E.run(universe(), {}, {today: '2026-11-19'}), rich = E.run(universe().map((r, i) => Object.assign(r, {roa: 0.5, equity: 1, assets: 2, capex: -9e9, invcf: -9e9, debtg: i % 2 ? 5 : -0.5, goodwill: 9e9, tenk: '2026-02-01', insider: 0.9})), {}, {today: '2026-11-19'});
  const key = r => [r.sym, r.Q, r.V, r.P, r.T, r.g, r.n5, r.lists, r.grade, r.alist, r.onSale, r.put, r.moon, r.slipping, r.ceiling, r.blocks];
  check('the columns for the two tests of management move no ordinary company', rich.rows.map(key), plain.rows.map(key));
  check('the file is known to carry what a bank is graded on, or not', [res.can.lender, plain.can.lender, rich.can.cash, plain.can.cash], [true, false, false, false]);
}

console.log('--- How well is it run, and how does it treat its owners ---');
{ const C = E.CONTROLS, co = (sym, o) => Object.assign({sym, industry: 'Widgets', lane: 'standard', primary: true, pool: 'main', cap: 1e9}, o || {});
  // where a company stands among five with a figure: 30%, 20%, 15%, 10%, 5%, and one with none
  const G = [co('A1', {roic5: 0.30}), co('A2', {roic5: 0.20}), co('A3', {roic5: 0.15}), co('A4', {roic5: 0.10}), co('A5', {roic5: 0.05}), co('A6', {})];
  let st = E.standing(G[0], G, 'roic5', true, 5);
  check('standing: the best of five beats all four others', [st.v, st.n, st.beats, st.share, st.median, st.word], [0.30, 5, 4, 1, 0.15, 'ahead']);
  st = E.standing(G[2], G, 'roic5', true, 5); check('standing: the middle one beats two of four', [st.beats, st.share, st.word], [2, 0.5, 'middle']);
  st = E.standing(G[4], G, 'roic5', true, 5); check('standing: the worst beats none', [st.beats, st.word], [0, 'behind']);
  st = E.standing(G[5], G, 'roic5', true, 5); check('standing: no figure, no standing', [st.v, st.n, st.beats, st.word, st.median], [null, 5, null, null, 0.15]);
  check('standing: four companies are too few to rank', E.standing(G[0], G.slice(0, 4), 'roic5', true, 5).word, null);
  // when lower is better: share counts of -3%, 0%, 2%, 5%, 10%
  const H = [-0.03, 0, 0.02, 0.05, 0.10].map((v, i) => co('S' + i, {sh: v}));
  check('standing: the fastest-shrinking share count is ahead', [E.standing(H[0], H, 'sh', false, 5).beats, E.standing(H[0], H, 'sh', false, 5).word, E.standing(H[4], H, 'sh', false, 5).word], [4, 'ahead', 'behind']);
  // a tie counts as half: 10%, 10%, 5%, 5%, 1% -> the first beats three and ties one
  const T = [0.10, 0.10, 0.05, 0.05, 0.01].map((v, i) => co('T' + i, {om: v}));
  check('standing: a tie counts as half', E.standing(T[0], T, 'om', true, 5).beats, 3.5);
  // two thirds of the others is ahead, one third is behind: four companies, min 4
  const Q = [0.4, 0.3, 0.2, 0.1].map((v, i) => co('Q' + i, {om: v}));
  check('standing: beating two of three is ahead, one of three is behind', [E.standing(Q[1], Q, 'om', true, 4).word, E.standing(Q[2], Q, 'om', true, 4).word], ['ahead', 'behind']);
  // debt: a company with net debt and a negative multiple has no figure
  check('debt figure: 1.5, net cash, and a loss', [E.debtFig({ndlev: 1.5, netcash: -5}), E.debtFig({ndlev: -0.4, netcash: 5}), E.debtFig({ndlev: -2, netcash: -5}), E.debtFig({})], [1.5, -0.4, null, null]);
  // who is measured against whom
  check('peers: an ordinary company, a lender, and those with no group', [E.peerKey(co('x')), E.peerKey(co('x', {lane: 'financial'})), E.peerKey(co('x', {lane: 'property'})), E.peerKey(co('x', {pool: 'micro'})), E.peerKey(co('x', {primary: false})), E.peerKey(co('x', {industry: null}))], ['s|Widgets', 'f|Widgets', null, null, null, null]);
  const sized = [100, 80, 50, 40, 30, 20, 10].map(v => co('C' + v, {cap: v * 1e9})), pg = E.peerGroups(sized.concat([co('L1', {lane: 'financial', cap: 5e9}), co('P1', {lane: 'property'})]));
  check('peers: grouped by industry and sort, largest first', [Object.keys(pg).sort(), pg['s|Widgets'].map(r => r.sym)], [['f|Widgets', 's|Widgets'], ['C100', 'C80', 'C50', 'C40', 'C30', 'C20', 'C10']]);
  // the four nearest in size to the 40: 50 and 30, then 80 and 20, which are equally far (twice and half); listed largest first
  const by = {}; sized.forEach(r => { by[r.sym] = r; });
  check('rivals: the four nearest in size', E.rivalsOf(by.C40, sized, 4, null, by).map(r => r.sym), ['C80', 'C50', 'C30', 'C20']);
  check('rivals: the largest company looks down', E.rivalsOf(by.C100, sized, 2, null, by).map(r => r.sym), ['C80', 'C50']);
  check('rivals: the reader\'s own choice, in the reader\'s order, without itself or strangers', E.rivalsOf(by.C40, sized, 4, ['C10', 'ZZZ', 'C40', 'C100'], by).map(r => r.sym), ['C10', 'C100']);
  check('rivals: a choice with nobody from the file falls back on size', E.rivalsOf(by.C40, sized, 2, ['ZZZ'], by).map(r => r.sym), ['C50', 'C30']);
  // the whole reading for one company among six
  const W = [0.30, 0.20, 0.15, 0.10, 0.05, 0.02].map((v, i) => co('W' + i, {cap: (6 - i) * 1e9, roic5: v, roic: v, revg5: 0.10 - i * 0.01, om: v, sh: -0.02 + i * 0.01, ndlev: i * 0.5, netcash: -1}));
  let R = E.runRead(W[0], E.peerGroups(W), C, null, null);
  check('run: an ordinary company, set beside six, ahead on all six measures', [R.kind, R.of, R.ahead, R.middle, R.behind, R.measures.map(m => m.k)], ['std', 6, 6, 0, 0, ['roic5', 'roic', 'revg5', 'om', 'sh', 'debt']]);
  check('run: its four nearest rivals', R.rivals.map(r => r.sym), ['W1', 'W2', 'W3', 'W4']);
  R = E.runRead(W[5], E.peerGroups(W), C, ['W0'], (() => { const b = {}; W.forEach(r => { b[r.sym] = r; }); return b; })());
  check('run: the weakest is behind on all six, beside the rival the reader chose', [R.behind, R.rivals.map(r => r.sym), R.picked], [6, ['W0'], true]);
  check('run: a lender is read on a lender\'s measures', E.runRead(co('L', {lane: 'financial'}), {}, C, null, null).measures.map(m => m.k), ['roe5', 'roe', 'revg5', 'roa', 'sh', 'eqa']);
  check('run: a property company has no group, so no reading', E.runRead(co('P', {lane: 'property'}), {}, C, null, null), null);
  check('run: each measure has a name, a direction and a unit', Object.keys(E.RUN_MEASURES).every(k => E.RUN_MEASURES[k].length === 6 && E.RUN_MEASURES[k].every(m => typeof m[1] === 'string' && typeof m[2] === 'boolean' && /^(pct|x)$/.test(m[3]))), true);
  // where a year's cash went. The business brought in 1,000. Capital spending 200. Investing took 500 in all, so 300 went on
  // acquisitions and other investments. Dividends: 2 a share on 100 shares = 200. Buybacks: 3% of a 5,000 market value = 150.
  // Debt is 1,100 after growing 10%, so it was 1,000: it borrowed 100. Stock pay 50.
  const Z = {lane: 'standard', ocf: 1000, capex: -200, invcf: -500, div: 2, shares: 100, buyback: 0.03, cap: 5000, debt: 1100, debtg: 0.10, sbc: 50, fcf: 800, ni: 500, insider: 0.05, sh: -0.02};
  const r9 = o => { const x = {}; Object.keys(o).forEach(k => { x[k] = typeof o[k] === 'number' ? Math.round(o[k] * 1e9) / 1e9 : o[k]; }); return x; };
  check('cash: where the 1,000 went', r9(E.cashUse(Z)), {made: 1000, kept: 200, bought: 300, paid: 200, back: 150, debt: -100, stock: 50});
  check('cash: debt down from 1,000 to 800 is 200 repaid', r9(E.cashUse(Object.assign({}, Z, {debt: 800, debtg: -0.2}))).debt, 200);
  check('cash: selling more than it bought shows as money in', E.cashUse(Object.assign({}, Z, {invcf: 100})).bought, -300);
  check('cash: new shares sold show as money in', r9(E.cashUse(Object.assign({}, Z, {buyback: -0.01}))).back, -50);
  check('cash: without capital spending, two lines are unknown', [E.cashUse(Object.assign({}, Z, {capex: null})).kept, E.cashUse(Object.assign({}, Z, {capex: null})).bought], [null, null]);
  check('cash: none for a bank, and none when the business brought in no cash', [E.cashUse(Object.assign({}, Z, {lane: 'financial'})), E.cashUse(Object.assign({}, Z, {ocf: -5})), E.cashUse(Object.assign({}, Z, {ocf: null}))], [null, null, null]);
  check('dividends in dollars: per share, or from the yield, or none, or unknown', [E.paidOut({div: 2, shares: 100}), E.paidOut({dy: 0.02, cap: 5000}), E.paidOut({div: 0}), E.paidOut({})], [200, 100, 0, null]);
  // owners: 200 of dividends and 150 of buybacks is 350, which is 43.75% of 800 of spare cash; stock pay of 50 is 6.25% of it
  let O = E.ownersRead(Z);
  check('owners: what they got, against spare cash', [O.insider, O.shares, O.paid, r9({v: O.back}).v, r9({v: O.handed}).v, O.of, O.base, r9({v: O.handedShare}).v, O.stock, O.stockShare], [0.05, -0.02, 200, 150, 350, 'cash', 800, 0.4375, 50, 0.0625]);
  O = E.ownersRead(Object.assign({}, Z, {lane: 'financial'}));
  check('owners: for a bank, against profit, and no stock-pay line', [O.of, O.base, r9({v: O.handedShare}).v, O.stock, O.stockShare], ['profit', 500, 0.7, null, null]);
  O = E.ownersRead({lane: 'standard'}); check('owners: an empty file says nothing', [O.insider, O.shares, O.paid, O.back, O.handed, O.handedShare, O.stock], [null, null, null, null, null, null, null]);
  O = E.ownersRead(Object.assign({}, Z, {fcf: -10})); check('owners: with no spare cash there is nothing to take a share of', [O.handedShare, O.stockShare], [null, null]);
  // the page: a name for every test, and a rules number that keeps a rule change from being reported as news
  const ui = html.slice(html.indexOf('</script>', html.indexOf('<script id="engine">')));
  const AT = new Function(ui.match(/const AT = \{[^\n]*\};/)[0] + '\nreturn AT;')();
  check('page: every test of a business or a bank has a name', E.A_TESTS.concat(E.L_TESTS).filter(k => !AT[k]), []);
  check('page: lists are compared only between files read under the same rules', /const RULES_V = \d+;/.test(ui) && /rv: RULES_V/.test(ui) && (ui.match(/H\.prev\.rv === RULES_V/g) || []).length >= 2, true);
}

console.log('--- Research from the filings ---');
{ // The tools that fetch and check a research file (tools/research). Nothing here touches the network: the texts are invented.
  const ED = require('../tools/research/edgar.js'), BR = require('../tools/research/brief.js'), os = require('os');
  // a filing's HTML as plain text
  check('text: tags go, entities are read, a table row keeps its cells apart',
    ED.toText('<p>Item&nbsp;1.&#160;Business</p><table><tr><td>Sales</td><td>100</td></tr></table><div>We&rsquo;re &ldquo;big&rdquo; &#8212; really.</div><script>x()</script>'), 'Item 1. Business\nSales | 100\n\nWe\'re "big" - really.');
  check('text: the hidden tagging block of a filing is dropped', ED.toText('<ix:header><p>hidden</p></ix:header><p>Shown</p>'), 'Shown');
  // the parts of an annual report: the table of contents names each part once, with almost nothing after it
  const A = 'We make widgets. '.repeat(30), B = 'Demand may fall. '.repeat(30), D = 'Sales rose this year. '.repeat(30);
  const tenK = ['Table of Contents', 'Item 1. Business 3', 'Item 1A. Risk Factors 9', 'Item 7. Management\'s Discussion and Analysis 20', 'Item 8. Financial Statements 40', 'PART I',
    'Item 1. Business', A, 'Item 1A. Risk Factors', B, 'Item 1B. Unresolved Staff Comments', 'None.', 'Item 2. Properties', 'Offices.', 'Item 7. Management\'s Discussion and Analysis', D, 'Item 7A. Quantitative Disclosures', 'None.', 'Item 8. Financial Statements', 'Numbers.'].join('\n');
  const it = ED.items10K(tenK);
  check('annual report: the business part holds the business and stops before the risks', [it['1'].includes(A.trim()), it['1'].includes('Demand may fall'), it['1'].includes('Sales rose')], [true, false, false]);
  check('annual report: the risks stop before the next part', [it['1a'].includes(B.trim()), it['1a'].includes('We make widgets'), it['1a'].includes('Unresolved')], [true, false, false]);
  check('annual report: the discussion of the year stops before the next part', [it['7'].includes(D.trim()), it['7'].includes('Quantitative'), it['7'].includes('Numbers.')], [true, false, false]);
  check('annual report: a part that is not there comes back empty', ED.items10K('Nothing here.')['7'], '');
  // a proxy statement: the heading in the table of contents is followed by dots and page numbers, the real one by text
  const pay = 'The bonus depends on sales growth and on return on capital. '.repeat(20);
  const proxy = ['Compensation Discussion and Analysis ........ 30', 'Summary Compensation Table ........ 45', 'Security Ownership of Certain Beneficial Owners ........ 60', '', 'Compensation Discussion and Analysis', pay,
    'As described in the Compensation Discussion and Analysis above, and at much greater length than a heading would ever run to, the committee reviewed the programme, the peer group and the results for the year in full.',
    'Summary Compensation Table', 'Name | Year | Total', 'Chief Executive | 2026 | 21,000,000', 'Security Ownership of Certain Beneficial Owners', 'All directors and officers as a group own 1.2%.'].join('\n');
  const pp = ED.partsProxy(proxy);
  check('proxy: the pay discussion starts at its real heading, not in the table of contents', [pp.pay.startsWith('Compensation Discussion and Analysis\nThe bonus depends'), pp.table.includes('21,000,000'), pp.owners.includes('own 1.2%')], [true, true, true]);
  check('proxy: when the title is a picture, the headings that open the section are tried', ED.partsProxy('Advisory vote ........ 3\n\nExecutive Compensation Highlights\n' + pay).pay.startsWith('Executive Compensation Highlights'), true);
  // ten years of reported figures: a company changed the tag for dividends in 2023; a quarter's figure and a 10-Q are left out
  const yr = (y, v, form) => ({start: y + '-01-01', end: y + '-12-31', val: v, form: form || '10-K', filed: (y + 1) + '-02-15'}), bal = (y, v) => ({end: y + '-12-31', val: v, form: '10-K', filed: (y + 1) + '-02-15'});
  const facts = {facts: {'us-gaap': {
    Revenues: {units: {USD: [yr(2021, 100), yr(2022, 110), yr(2023, 120), yr(2024, 130), {start: '2024-10-01', end: '2024-12-31', val: 35, form: '10-K', filed: '2025-02-15'}, yr(2024, 999, '10-Q')]}},
    NetCashProvidedByUsedInOperatingActivities: {units: {USD: [yr(2021, 20), yr(2022, 22), yr(2023, 24), yr(2024, 26)]}},
    PaymentsOfDividendsCommonStock: {units: {USD: [yr(2021, 5), yr(2022, 6)]}}, PaymentsOfDividends: {units: {USD: [yr(2022, 77), yr(2023, 7), yr(2024, 8)]}},
    PaymentsForRepurchaseOfCommonStock: {units: {USD: [yr(2021, 3), yr(2022, 3), yr(2024, 4)]}},
    Goodwill: {units: {USD: [bal(2021, 50), bal(2022, 50), bal(2023, 60), bal(2024, 60)]}},
    WeightedAverageNumberOfDilutedSharesOutstanding: {units: {shares: [yr(2021, 1000), yr(2022, 990), yr(2023, 980), yr(2024, 970)]}}}}};
  const ty = ED.tenYears(facts);
  check('ten years: the years on record', ty.years, ['2021', '2022', '2023', '2024']);
  check('ten years: only a full year from an annual report counts', ty.rows.sales, [100, 110, 120, 130]);
  check('ten years: a change of tag is followed, the older tag winning where both report a year', ty.rows.paid, [5, 6, 7, 8]);
  check('ten years: a year with no figure is a gap, not a zero', ty.rows.back, [3, 3, null, 4]);
  check('ten years: a year-end balance, and a count of shares', [ty.rows.goodwill, ty.rows.shares], [[50, 50, 60, 60], [1000, 990, 980, 970]]);
  check('ten years: a line with no tag is left out, and two years are too few for a table', [ty.rows.kept, ED.tenYears({facts: {'us-gaap': {Revenues: {units: {USD: [yr(2023, 1), yr(2024, 2)]}}}}})], [undefined, null]);
  check('the name a rival would use', ['Widget Holdings, Inc.', 'The Gadget Company', 'Acme plc', 'Bolt Corp.'].map(ED.shortName), ['Widget', 'Gadget', 'Acme', 'Bolt']);
  check('mentions: whole words only, as paragraphs', ED.mentions('Our rivals include Acme and others, with whom we compete on price in every one of our markets.\nAcmeology is a different thing altogether and has nothing to do with it, in any market.\nShort Acme.', 'Acme', 5).length, 1);
  // checking a passage against a filing
  const T = BR.norm('We compete with Acme Corp. and  Bolt  Inc.\nOur “platform” grew 12% | in 2026 — a record.');
  check('passage: found word for word', BR.found('We compete with Acme Corp. and Bolt Inc.', T), true);
  check('passage: case, spacing, curly quotes, dashes and table bars do not matter', BR.found('our "platform"   GREW 12% in 2026 - a record', T), true);
  check('passage: a changed word is not found', BR.found('We compete with Acme Corp. and Nut Inc.', T), false);
  check('passage: two parts joined by dots must both be there, in order', [BR.found('We compete with Acme Corp. ... grew 12% in 2026', T), BR.found('grew 12% in 2026 ... We compete with Acme Corp.', T)], [true, false]);
  check('passage: a scrap of a few letters proves nothing', [BR.found('Acme', T), BR.found('', T)], [false, false]);
  // a whole brief against a folder
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-research-')), w = (f, o) => fs.writeFileSync(path.join(dir, f), typeof o === 'string' ? o : JSON.stringify(o));
  w('meta.json', {sym: 'WDG.X', cik: '0000000001', name: 'Widget Works Inc.', fetched: '2026-11-24', sources: [{id: 'k', form: '10-K', filed: '2026-02-01', period: '2025-12-31', url: 'https://www.sec.gov/Archives/k.htm'}, {id: 'p', form: 'DEF 14A', filed: '2026-03-01', url: 'https://www.sec.gov/Archives/p.htm'}]});
  w('k.full.txt', 'We make widgets for factories. We compete with Bolt Inc. and Nut Corp. on price.\nWe paid $900 million for Gadget Co. in 2024.');
  w('p.full.txt', 'The chief executive\'s total pay for 2025 was $21,000,000. The yearly bonus depends on sales growth.');
  w('rivals.json', [{sym: 'BLT.X', name: 'Bolt Inc.', url: 'https://www.sec.gov/Archives/bolt.htm', filed: '2026-02-10', competition: 'Our main competitor is Widget Works, which is larger than we are.', mentions: []}]);
  w('tenyears.json', ty);
  w('brief.json', {v: 1, sym: 'WDG.X', read: '2026-11-24', business: 'It makes widgets for factories.', rivalSymbols: ['blt.x', 'WDG.X', 'not a symbol!'], cant: ['Whether customers are leaving.'],
    sources: [{id: 'k', form: '10-K', url: 'https://example.com/changed'}, {id: 'r1', form: '10-K', who: 'Bolt Inc.', filed: '2026-02-10', url: 'https://www.sec.gov/Archives/bolt.htm'}, {id: 'r2', form: '10-K', who: 'Nobody', url: 'https://www.sec.gov/Archives/unknown.htm'}],
    sections: {rivals: [{t: 'It names Bolt and Nut as rivals.', q: 'We compete with Bolt Inc. and Nut Corp. on price.', s: 'k', tone: 'shouting'}],
      run: [{t: 'It paid $900 million for Gadget.', q: 'We paid $900 million for Gadget Co. in 2024.', s: 'k', tone: 'warn'}, {t: 'It paid $9 billion for Gadget.', q: 'We paid $9 billion for Gadget Co. in 2024.', s: 'k', tone: ''}],
      owners: [{t: 'The chief executive was paid $21 million.', q: 'total pay for 2025 was $21,000,000', s: 'p', tone: ''}, {t: 'A passage placed in the wrong filing.', q: 'total pay for 2025 was $21,000,000', s: 'k', tone: ''}],
      namedBy: [{t: 'Bolt calls it its main competitor.', q: 'Our main competitor is Widget Works, which is larger than we are.', s: 'r1', tone: ''}, {t: 'From a filing that is not in the folder.', q: 'Our main competitor is Widget Works', s: 'r2', tone: ''}]}});
  const R = BR.check(dir, path.join(dir, 'brief.json')), O = R.out;
  check('brief: findings whose passages are in the filing are kept, the rest thrown away', [O.kept, O.dropped], [4, 3]);
  check('brief: kept where they belong', [O.sections.rivals.length, O.sections.run.length, O.sections.owners.length, O.sections.namedBy.length, O.sections.stands.length], [1, 1, 1, 1, 0]);
  check('brief: a tone it does not know is no tone', [O.sections.rivals[0].tone, O.sections.run[0].tone], ['', 'warn']);
  check('brief: the company\'s own sources come from the folder, whatever the reader wrote', O.sources.find(x => x.id === 'k').url, 'https://www.sec.gov/Archives/k.htm');
  check('brief: a rival\'s report must be one the folder holds', [O.sources.map(x => x.id), R.problems.some(x => /source r2 is not a filing in the folder/.test(x))], [['k', 'p', 'r1'], true]);
  check('brief: rivals\' symbols are tidied, itself and nonsense left out', O.rivalSymbols, ['BLT.X']);
  check('brief: the ten-year table is added by the tool, not the reader', O.tenYears.rows.sales, [100, 110, 120, 130]);
  check('brief: nothing reads like advice', R.advice, false);
  w('advice.json', {v: 1, sym: 'WDG.X', business: 'A fine company. Investors should buy the shares.', sections: {}});
  check('brief: one that says what to do with the shares is flagged', BR.check(dir, path.join(dir, 'advice.json')).advice, true);
  BR.check(dir, path.join(dir, 'brief.json'));
  const outFile = path.join(dir, 'research.json'); check('pack: one brief packed', BR.pack(outFile, [dir, path.join(dir, 'nothing-here')]), 1);
  const packed = JSON.parse(fs.readFileSync(outFile, 'utf8')); check('pack: the file Prism loads', [packed.v, packed.app, Object.keys(packed.briefs), packed.briefs['WDG.X'].kept], [1, 'prism-research', ['WDG.X'], 4]);
  fs.rmSync(dir, {recursive: true, force: true});
  // the page: it shows the same sections, links only to the regulator, and cleans a research file both when it is loaded and when it is read back
  const ui = html.slice(html.indexOf('</script>', html.indexOf('<script id="engine">')));
  const BSEC = new Function(ui.match(/const BSEC = \[[^\]]*\];/)[0] + '\nreturn BSEC;')();
  check('page: it shows the sections a brief has', BSEC, BR.SECTIONS);
  const page = new Function('day', 'esc', ui.match(/const BSEC = [\s\S]*?\nfunction cleanBrief\(b\) \{[\s\S]*?\n\}\n/)[0] + '\nreturn {cleanBrief, secUrl};')(x => x, x => x);
  check('page: a link is made only to the regulator\'s own site', ['https://www.sec.gov/Archives/x.htm', 'http://www.sec.gov/x', 'https://www.sec.gov.evil.example/x', 'javascript:alert(1)', 'https://www.sec.gov/x" onclick="y'].map(page.secUrl), ['https://www.sec.gov/Archives/x.htm', null, null, null, null]);
  const cb = page.cleanBrief(packed.briefs['WDG.X']);
  check('page: a checked brief comes through whole', [cb.sym, cb.sections.run.length, cb.sources.length, cb.rivalSymbols, cb.tenYears.years.length, cb.cant.length], ['WDG.X', 1, 3, ['BLT.X'], 4, 1]);
  const bad = page.cleanBrief({v: 1, sym: 'WDG.X', sections: {run: [{t: 'x', q: 'y', s: 'zz'}, {t: 5, q: 'y', s: 'k'}, {t: 'ok', q: 'passage', s: 'k', tone: '<b>'}], extra: [{t: 'x', q: 'y', s: 'k'}]}, sources: [{id: 'k', form: '10-K', url: 'javascript:alert(1)', filed: 'yesterday'}, {id: '<x>', url: 'https://www.sec.gov/x'}], rivalSymbols: ['<script>', 'OK.X'], cant: [7, 'fine'], tenYears: {years: ['x', 'y', 'z'], rows: {sales: [1, 2, 3]}}});
  check('page: a careless or hostile file is cut down to what Prism knows', [bad.sections.run.map(p => [p.t, p.tone]), bad.sections.extra, bad.sources, bad.rivalSymbols, bad.cant, bad.tenYears], [[['ok', '']], undefined, [{id: 'k', form: '10-K', who: '', filed: null, period: null, url: null}], ['OK.X'], ['fine'], null]);
  check('page: what is not a brief is refused', [page.cleanBrief(null), page.cleanBrief({v: 2, sym: 'A', sections: {}}), page.cleanBrief({v: 1, sym: 'a b', sections: {}}), page.cleanBrief({v: 1, sym: 'A'})], [null, null, null, null]);
  check('page: a research file is cleaned when loaded and again when read back from the browser', (ui.match(/cleanBrief\(/g) || []).length >= 3, true);
  check('page: links to filings open apart and tell the other site nothing', /target="_blank" rel="noopener noreferrer"/.test(ui), true);
  check('page: it says the research is an AI reading, and not advice', /Read by an AI/.test(ui) && /Research, not advice/.test(ui), true);
  check('repository: research files and the folder of filings are kept out of it', (() => { const g = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8'); return /^\.research\/$/m.test(g) && /^prism-research-\*\.json$/m.test(g) && /^prism-reading-list-\*\.json$/m.test(g); })(), true);
  check('the fetch tool carries no contact of its own', /SEC_CONTACT/.test(fs.readFileSync(path.join(__dirname, '..', 'tools', 'research', 'edgar.js'), 'utf8')) && !/@(?!\S*example\.com)[a-z0-9-]+\.(com|net|org)/i.test(fs.readFileSync(path.join(__dirname, '..', 'tools', 'research', 'edgar.js'), 'utf8')), true);
}

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
  const lists = ['sale', 'put', 'A', '', 'near', 'moon'].concat(Object.keys(LI)), parts = ['detail', 'vform', 'signs', 'run', 'owners', 'stand'];
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
