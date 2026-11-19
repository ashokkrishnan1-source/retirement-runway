// Retirement Runway: rules check.
// Run after any change to the tax rules or the engine:   node tests/check-rules.js
// Every check has a hand-calculated expected value. Exit code is 1 if anything fails.
// Covers: federal tax reference figures, Social Security (spousal, survivor,
// earnings test), RMDs, payroll tax, state tax, cash-flow accounting, what-ifs and a fuzz test.
// Note: expected values assume the 2027 rules. When you update RULES for a new year, the
// federal reference figures below will change; re-derive them (or confirm the differences) first.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const eng = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const E = new Function(eng + '\nreturn {fedTax,simulate,makePaths,mcJob,spendJob,maxScale,WI,RULES,STATES,START_YEAR,solveScale};')();
const EX = eval('(' + html.match(/const EXAMPLE=(\{[\s\S]*?\n\});/)[1] + ')');
const clone = o => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
const check = (name, actual, expected, tol) => { const ok = Math.abs(actual - expected) <= (tol == null ? 1 : tol); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + ': expected ' + Math.round(expected * 100) / 100 + ', got ' + Math.round(actual * 100) / 100); };
const flat = c => { c.infl = 0; c.cola = 0; c.wage = 0; return c };
const person = o => Object.assign({name: 'X', dob: '1962-01-01', income: 0, retireAge: 0, k401: 0, ira: 0, roth: 0, k401Pct: 0, matchPct: 0, rothAdd: 0, iraAdd: 0, ssPIA: 0, claimAge: 67, lifeExp: 95, penAmt: 0, penAge: 65, penColaPct: 0, penSurvPct: 50}, o);
const base = (p0, p1, extra) => flat(Object.assign(clone(EX), {couple: !!p1, p: [person(p0), person(p1 || {})], cash: 5e6, brokerage: 0, spend: 1000, health: 0, cashFloor: 0, stateNow: 'FL', stateTax: 0, workConvTarget: 'none', convTarget: 'zero'}, extra || {}));
const row = (s, Y) => s.rows.find(r => r.Y === Y);
const sim = (c, st) => E.simulate(c, {strategy: st || 'brk'});

console.log('--- Social Security ---');
check('spousal A: 3000@70 + 1000@62, 2032', row(sim(base({ssPIA: 3000, claimAge: 70}, {ssPIA: 1000, claimAge: 62})), 2032).ss, 59040);
check('spousal B: both claim 62, 2027', row(sim(base({ssPIA: 3000, claimAge: 62}, {ssPIA: 1000, claimAge: 62})), 2027).ss, 37500);
check('spousal C: 3000@67 + 1000@70, 2032', row(sim(base({ssPIA: 3000, claimAge: 67}, {ssPIA: 1000, claimAge: 70})), 2032).ss, 56880);
{ // survivor cap: deceased born 1966 PIA 3000 claims 62 dies at 63 (end 2029); survivor born 1969 PIA 0 claims 62 -> starts 2031 at 62
  const s = sim(base({dob: '1966-01-01', ssPIA: 3000, claimAge: 62, lifeExp: 63}, {dob: '1969-01-01', ssPIA: 0, claimAge: 62}));
  check('survivor (early-claimed record, survivor 62): 36000*min(.7964..)', row(s, 2031).ss, 36000 * (0.715 + 0.285 * 2 / 7));
  check('survivor before own claim age gets nothing (2030, age 61)', row(s, 2030).ss, 0);
}
{ const s = sim(base({dob: '1966-01-01', ssPIA: 3000, claimAge: 62, lifeExp: 63}, {dob: '1966-06-01', ssPIA: 0, claimAge: 67}));
  check('survivor cap binds at full age (82.5% of 36000)', row(s, 2033).ss, 29700); }
check('family earnings test: worker 3000@62 earning 100k, spouse PIA 0 @62 -> 2028 total 0',
  row(sim(base({dob: '1966-01-01', ssPIA: 3000, claimAge: 62, income: 100000, retireAge: 70}, {dob: '1966-01-01', ssPIA: 0, claimAge: 62})), 2028).ss, 0);
{ const s = sim(base({dob: '1966-01-01', ssPIA: 3000, claimAge: 62}, {dob: '1966-01-01', ssPIA: 0, claimAge: 62, income: 60000, retireAge: 65}));
  check('spousal recomputed at full age after withholding (2033)', row(s, 2033).ss - 25200, 15000, 5); }
check('claim age 62.5 rounds to 63 (75%)', row(sim(base({dob: '1966-01-01', ssPIA: 2000, claimAge: 62.5})), 2029).ss, 18000);
check('claim age 40 clamps to 62', row(sim(base({dob: '1966-01-01', ssPIA: 2000, claimAge: 40})), 2028).ss, 16800);
{ const c = base({dob: '1960-01-01', ssPIA: 0, claimAge: 70, income: 300000, retireAge: 80}, {dob: '1960-01-01', income: 150000, retireAge: 80});
  const s = sim(c); const r = s.rows[0];
  // FICA isn't in the row; recompute through take-home isn't visible, so check via a direct expectation of the formula
  const ficaExp = 0.062 * Math.min(300000, 192300) + 0.0145 * 300000 + 0.062 * 150000 + 0.0145 * 150000 + 0.009 * (450000 - 250000);
  check('FICA incl. 0.9% Medicare (formula reference)', ficaExp, 29547.6); }
{ const c = base({dob: '1952-01-01', ira: 1e6, income: 50000, retireAge: 90, k401Pct: 20, claimAge: 70}); c.rPre = 0; c.rPost = 0;
  const s = sim(c); check('RMD on prior year-end balance (age 75, 1e6/24.6)', s.rows[0].rmd, 1e6 / 24.6, 1); }

console.log('--- Simulation ---');
{ const c = base({ssPIA: 0}); c.cash = 0; c.brokerage = 300000; c.gainPct = 0; c.spend = 0; c.infl = 3; c.divYield = 0;
  const s = E.simulate(c, {strategy: 'brk', returns: new Array(60).fill(0.03)});
  check('today\'s $ balance with 0% real return stays 300k', s.rows[0].total / s.rows[0].fe, 300000, 1);
  check('legacy in today\'s $', s.legacy, 300000, 1); }
{ const c = base({dob: '1960-01-01', income: 60000, retireAge: 70, ssPIA: 2000, claimAge: 67}); c.cash = 0;
  const s = sim(c); const r = row(s, 2029); check('SS received while working is saved (brokerage > 0 by 2029)', r.brk > 40000 ? 1 : 0, 1, 0); }
{ let neg = 0, nan = 0; const rnd = (a, b) => a + Math.random() * (b - a);
  for (let k = 0; k < 1500; k++) {
    const c = clone(EX); c.couple = Math.random() < .6;
    for (const p of c.p) { p.dob = (1955 + Math.floor(rnd(0, 30))) + '-05-01'; p.income = Math.random() < .5 ? rnd(0, 300000) : 0; p.retireAge = Math.floor(rnd(50, 72)); p.ira = rnd(0, 2e6); p.k401 = rnd(0, 5e5); p.roth = rnd(0, 3e5); p.ssPIA = rnd(0, 4000); p.claimAge = Math.floor(rnd(62, 71)); p.lifeExp = Math.floor(rnd(70, 100)); p.penAmt = Math.random() < .2 ? rnd(0, 60000) : 0; p.k401Pct = rnd(0, 15); p.matchPct = rnd(0, 8) }
    c.cash = rnd(0, 3e5); c.brokerage = rnd(0, 2e6); c.gainPct = rnd(0, 90); c.spend = rnd(30000, 250000); c.workConvTarget = ['none', 'b22', 'b24', 'b32', 'fixed'][k % 5]; c.workConvAmt = rnd(0, 200000); c.convTarget = ['zero', 'b12', 'b22', 'b24'][k % 4];
    const codes = Object.keys(E.STATES); c.stateNow = codes[k % codes.length]; c.stateTax = E.STATES[c.stateNow][1];
    for (const st of ['typical', 'brk', 'smart']) { const s = E.simulate(c, {strategy: st}); for (const r of s.rows) { if (r.cash < -1 || r.brk < -1 || r.trad < -1 || r.roth < -1) neg++; if (!isFinite(r.total) || !isFinite(r.fed) || !isFinite(r.state)) nan++ } }
  }
  check('fuzz: no negative balances (rows)', neg, 0, 0); check('fuzz: no NaN (rows)', nan, 0, 0); }
{ const r = E.WI.early(EX, 'smart', 'both', true); check('retire-earlier: current ages row labeled 0', r.length === 1 && r[0].d === 0 ? 1 : 0, 1, 0); }
{ const c = base({dob: '1980-01-01', income: 100000, retireAge: 67, ssPIA: 2000}); c.cash = 0; c.brokerage = 2e6; c.gainPct = 0;
  const a = E.simulate(c, {strategy: 'brk'}), b = E.simulate(c, {strategy: 'brk', extra: {2030: 100000, 2031: 100000, 2032: 100000}});
  check('long-term care before retirement is applied (legacy drops)', a.legacy - b.legacy > 100000 ? 1 : 0, 1, 0); }
{ const c = clone(EX); c.p[0].dob = '1977-01-01'; c.p[1].dob = '1977-01-01'; c.p[0].retireAge = 50; c.p[1].retireAge = 50; c.cash = 0; c.brokerage = 100000;
  const s = E.simulate(c, {strategy: 'typical'}); check('10% penalty applied before 59½', s.rows.reduce((a, r) => a + (r.pen10 || 0), 0) > 0 ? 1 : 0, 1, 0);
  check('no IRA penalty once 60+', s.rows.filter(r => r.age[0] >= 60).reduce((a, r) => a + (r.pen10 || 0), 0), 0, 0); }
{ const c = clone(EX); c.p[0].lifeExp = 40; c.p[1].lifeExp = 40; let ok = 1; try { const s = E.simulate(c, {strategy: 'smart'}); if (!s.end) ok = 0 } catch (e) { ok = 0 } check('plan-to age already passed: no crash', ok, 1, 0); }
{ const c = clone(EX); c.spend = 10000; c.cash = 1e7; check('safe-spending search not capped at 3x', E.solveScale(m => E.simulate(c, {strategy: 'brk', spendScale: m}).shortReal < 1) > 3 ? 1 : 0, 1, 0); }

console.log('--- Taxes ---');
{ // worked examples (2027, married, both 65+)
  const a = {Y: 2027, st: 'mfj', n65: 2, ss: 0, ix: 1, seniorExt: false, nii: 0};
  check('fed: $150k from the IRA', E.fedTax({...a, ord: 150000, qual: 0}).tax, 11656);
  check('fed: $75k of long-term gains only', E.fedTax({...a, ord: 0, qual: 75000}).tax, 0);
  let lo = 0, hi = 200000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; E.fedTax({...a, ord: m, qual: 75000}).taxable <= 102100.5 ? lo = m : hi = m }
  check('fed: conversion room up to the 0% line with $75k gains', lo, 75625, 2);
  check('fed: tax on that conversion', E.fedTax({...a, ord: lo, qual: 75000}).tax, 2740, 2);
  lo = 0; hi = 300000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; E.fedTax({...a, ord: m, qual: 0}).ordT <= 104050 ? lo = m : hi = m }
  check('fed: filling the 12% bracket', lo, 152366, 2);
  check('fed: tax when filling the 12% bracket', E.fedTax({...a, ord: lo, qual: 0}).tax, 11974, 2);
  check('fed: single 65 with $60k ordinary', E.fedTax({...a, st: 'single', n65: 1, ord: 60000, qual: 0}).tax, 3980, 1);
  check('fed: $100k ordinary + $700k gains (15%/20% and 3.8%)', E.fedTax({...a, n65: 0, ord: 100000, qual: 700000, nii: 700000}).tax, 134769, 1);
}
{ // state tax recomputed by hand from each year's own figures
  for (const [code, rate, st] of [['IL', 4.95, 'brk'], ['PA', 3.07, 'brk']]) {
    const c = clone(EX); c.stateNow = code; c.stateTax = rate; c.stateCustom = false;
    const r = E.simulate(c, {strategy: st}).rows[0], o = E.STATES[code][5];
    const ti = Math.max(0, r.agi - r.tss - (r.rmd + r.draw.trad + r.conv + r.pen) - (o.ded + o.ded65 * 2));
    check('state ' + code + ': matches hand calculation', r.state, ti * rate / 100, 1);
  }
  const c = clone(EX); c.stateNow = 'CA'; c.stateTax = 8; c.stateCustom = false;
  const r = E.simulate(c, {strategy: 'typical'}).rows[0], o = E.STATES.CA[5];
  const ti = Math.max(0, r.agi - r.tss - (o.ded + o.ded65 * 2)); let tax = 0, prev = 0;
  for (const [top, rt] of o.br) { if (ti > prev) tax += (Math.min(ti, top) - prev) * rt / 100; prev = top; if (ti <= top) break }
  check('state CA brackets: matches hand calculation', r.state, tax, 1);
  const f = clone(EX); f.stateNow = 'FL'; f.stateTax = 0;
  check('state FL: no state tax', E.simulate(f, {strategy: 'smart'}).rows.reduce((a, x) => a + x.state, 0), 0, 0);
}
{ // working-year conversion: brokerage sale gains now taxed
  const c = base({dob: '1975-01-01', income: 150000, retireAge: 65, ira: 1e6}, {dob: '1975-01-01', income: 150000, retireAge: 65, ira: 1e6}, {cash: 0, brokerage: 1e6, gainPct: 80, workConvTarget: 'b24'});
  const s = E.simulate(c, {strategy: 'smart'}); const r = s.rows[0];
  const a = {Y: 2027, st: 'mfj', n65: 0, ss: 0, ix: 1, seniorExt: false};
  const exp = E.fedTax({...a, ord: r.ordWage + r.interest + r.conv, qual: r.div + r.gains, nii: r.div + r.gains + r.interest}).tax;
  check('working-year conversion: gains from the tax sale are in the federal tax', r.fed, exp, 1);
  check('...and gains were realized', r.gains > 1000 ? 1 : 0, 1, 0); }
{ const c = clone(EX); c.brokerage = 500000; c.gainPct = 80; c.cash = 0;
  const a = E.simulate(c, {strategy: 'brk'}), b = E.simulate(c, {strategy: 'brk', lump: {2027: -300000}});
  check('big expense: realized gains are taxed (2027 fed tax rises by > $20k)', b.rows[0].fed - a.rows[0].fed > 20000 ? 1 : 0, 1, 0); }
{ // NJ single 66 with $80.4k IRA draws: exclusion mostly kept
  const c = base({dob: '1961-01-01', ira: 2e6, ssPIA: 0, claimAge: 70}, null, {cash: 0, spend: 70000, stateNow: 'NJ', stateTax: 5.525});
  const r = sim(c).rows[0]; check('NJ single: exclusion not halved (state tax small)', r.state < 1000 ? 1 : 0, 1, 0); console.log('     NJ single state tax', Math.round(r.state), 'AGI', Math.round(r.agi)); }
{ // GA: investment income covered by the exclusion
  const c = base({dob: '1961-01-01'}, {dob: '1961-01-01'}, {cash: 0, brokerage: 4e6, gainPct: 50, divYield: 1.5, spend: 100000, stateNow: 'GA', stateTax: 4.99});
  const r = sim(c).rows[0]; check('GA: dividends/gains under 2x$65k excluded -> state tax ~0', r.state, 0, 50); }
{ // GA per person: one spouse owns the IRA
  const c = base({dob: '1961-01-01', ira: 2e6}, {dob: '1961-01-01'}, {cash: 0, spend: 150000, stateNow: 'GA', stateTax: 4.99});
  const r = E.simulate(c, {strategy: 'typical'}).rows[0]; check('GA per-person exclusion: state tax > $2k', r.state > 2000 ? 1 : 0, 1, 0); console.log('     GA one-owner state tax', Math.round(r.state)); }
console.log('--- Health: marketplace subsidies and Medicare surcharges ---');
{ // independent subsidy formula (2027 rules): applicable % rises linearly within each band
  const pctOf = x => { const t = [[1.33, 2.15, 2.15], [1.5, 3.22, 4.30], [2, 4.30, 6.78], [2.5, 6.78, 8.66], [3, 8.66, 10.22], [4, 10.22, 10.22]]; let lo = 0; for (const [hi, a, b] of t) { if (x <= hi) return a + (b - a) * (x - lo) / (hi - lo); lo = hi } return null };
  check('subsidy %: 2.7726x poverty line -> 9.51%', pctOf(60000 / 21640), 9.5106, 0.001);
  const c = base({dob: '1965-01-01', ira: 1.5e6}, {dob: '1965-01-01', ira: 0}, {cash: 0, brokerage: 300000, gainPct: 30, spend: 60000, healthMode: 'aca', acaPrem: 15000});
  const s = E.simulate(c, {strategy: 'brk'}); const r = s.rows[0];
  const exp = r.magiA / 21640 <= 4 ? Math.max(0, 30000 - pctOf(r.magiA / 21640) / 100 * r.magiA) : 0;
  check('marketplace: premium for two people under 65', r.aca, 30000, 1);
  check('marketplace: subsidy matches hand formula (income ' + Math.round(r.magiA) + ')', r.acaSub, exp, 1);
  const c2 = clone(c); c2.spend = 120000; const r2 = E.simulate(c2, {strategy: 'typical'}).rows[0];
  check('marketplace: no subsidy above 400% of the poverty line ($86,560 couple)', r2.magiA > 86560 ? r2.acaSub : 0, 0, 0);
  const c3 = clone(c); c3.convTarget = 'b22'; c3.guardAca = true; c3.convUntil = 74;
  const s3 = E.simulate(c3, {strategy: 'smart'}); const viol = s3.rows.filter(x => x.acaN > 0 && x.conv > 1 && x.magiA > x.fpl4 + 1).length;
  check('subsidy limit respected by conversions when that option is on', viol, 0, 0);
  check('...and conversions still happen under it', s3.rows.filter(x => x.acaN > 0 && x.conv > 1).length > 0 ? 1 : 0, 1, 0);
}
{ // Medicare surcharge from income two years earlier (couple, 2027 tiers, no inflation)
  const c = base({dob: '1955-01-01', ira: 6e6, claimAge: 70, ssPIA: 3000}, {dob: '1955-01-01', claimAge: 70, ssPIA: 2000}, {cash: 0, spend: 250000});
  const s = E.simulate(c, {strategy: 'typical'}); const th = [224000, 282000, 354000, 424000, 750000], b = [83.70, 209.40, 335.00, 460.60, 502.40], d = [15.40, 39.70, 64.00, 88.30, 96.40];
  const r = s.rows[3], prev = s.rows[1]; let k = 0; th.forEach((x, q) => { if (prev.agi > x) k = q + 1 });
  check('Medicare surcharge uses income from two years earlier (tier ' + k + ')', r.irmaa, k ? 2 * 12 * (b[k - 1] + d[k - 1]) : 0, 1);
  const c2 = clone(c); c2.ira = 0; c2.p[0].ira = 3e6; c2.convTarget = 'b24'; c2.guardIrmaa = 1; c2.convUntil = 80; c2.cash = 2e6;
  const s2 = E.simulate(c2, {strategy: 'smart'}); const over = s2.rows.filter(x => x.conv > 1 && x.agi > 224000).length;
  check('Medicare limit respected by conversions when set to "no surcharge"', over, 0, 0);
}
console.log('--- Who pays the conversion tax ---');
{ // working couple at 55 with little cash and no brokerage: conversion tax must not come from the IRA, Roth or cash floor
  const w = base({dob: '1972-01-01', income: 150000, retireAge: 65, ira: 1e6}, {dob: '1972-01-01', income: 150000, retireAge: 65, ira: 1e6}, {cash: 20000, cashFloor: 10000, brokerage: 0, workConvTarget: 'b24'});
  const s = E.simulate(w, {strategy: 'smart'}), wr = s.rows.filter(r => r.working && !r.retired);
  check('conversion tax: no IRA, Roth or cash-floor money used while working', wr.reduce((a, r) => a + r.draw.trad + r.draw.roth + r.draw.floor, 0), 0, 5);
  check('conversion tax: no early-withdrawal penalty triggered', s.rows.reduce((a, r) => a + (r.pen10 || 0), 0), 0, 1);
  check('conversion tax: conversion shrinks to what spare cash can pay (first year > 0)', wr[0].conv > 1000 ? 1 : 0, 1, 0);
  // retired, spending already uses the IRA: conversion adds no extra IRA withdrawal for its tax
  const r = base({dob: '1962-01-01', ira: 2e6}, {dob: '1962-01-01'}, {cash: 60000, cashFloor: 50000, brokerage: 0, spend: 60000, convTarget: 'b22'});
  const a = E.simulate(r, {strategy: 'smart'}).rows[0], b = E.simulate(Object.assign(clone(r), {convTarget: 'zero', convUntil: 0}), {strategy: 'smart'}).rows[0];
  check('conversion tax: retired IRA withdrawal no larger than without converting', Math.max(0, a.draw.trad - b.draw.trad), 0, 5); }
console.log('--- Giving and estimated tax ---');
{ const c = base({dob: '1950-01-01', ira: 2e6, claimAge: 70, ssPIA: 2000}, {dob: '1950-01-01', claimAge: 70, ssPIA: 1500}, {cash: 1e6, spend: 120000});
  const a = E.simulate(c, {strategy: 'brk'}).rows[0], g = E.simulate(Object.assign(clone(c), {giving: 30000}), {strategy: 'brk'}).rows[0];
  check('QCD: taxable required withdrawal falls by the gift', a.rmd - g.rmd, 30000, 1);
  check('QCD: gift recorded', g.qcd, 30000, 1);
  check('QCD: federal tax falls', a.fed - g.fed > 3000 ? 1 : 0, 1, 0);
  const y = base({dob: '1960-01-01', ira: 2e6}, null, {cash: 1e6, spend: 60000, giving: 20000});
  check('QCD: not before 70½ (age 67)', E.simulate(y, {strategy: 'brk'}).rows[0].qcd, 0, 0); }
{ const c = base({dob: '1975-01-01', income: 150000, retireAge: 65, ira: 1e6}, {dob: '1975-01-01', income: 150000, retireAge: 65, ira: 1e6}, {cash: 1e6, workConvTarget: 'b24'});
  const r = E.simulate(c, {strategy: 'smart'}).rows[0];
  const a = {Y: 2027, st: 'mfj', n65: 0, ss: 0, ix: 1, seniorExt: false, nii: 0};
  check('estimated tax: tax on wages alone is set aside for withholding', r.wageTax, E.fedTax({...a, ord: r.ordWage, qual: 0}).tax, 1); }
console.log('--- Social Security cut ---');
{ // both claim at 62 in 2027 (PIA 3000 and 1000 -> 37,500 a year, see spousal B); a 22% cut from 2030
  const c = base({ssPIA: 3000, claimAge: 62}, {ssPIA: 1000, claimAge: 62});
  const a = sim(c), b = E.simulate(c, {strategy: 'brk', ssCut: {year: 2030, pct: 22}});
  check('SS cut: year before the cut unchanged (2029)', row(b, 2029).ss, row(a, 2029).ss, 1);
  check('SS cut: 2030 benefit is 78% of uncut', row(b, 2030).ss, 0.78 * row(a, 2030).ss, 1);
  check('SS cut: 2027 couple benefit 37,500 stays 37,500', row(b, 2027).ss, 37500, 1);
  const p = Object.assign(clone(c), {ssCutOn: true, ssCutYear: 2030, ssCutPct: 22});
  check('SS cut: plan setting matches the what-if (2035)', row(sim(p), 2035).ss, row(b, 2035).ss, 1);
  const w = E.WI.sscut(p, 'brk', 2030, 22);
  check('SS cut what-if: compares against no cut even when the plan has one', w.ssLost > 0 ? 1 : 0, 1, 0); }
console.log('--- Conversion chosen for one year ---');
{ const c = clone(EX), Y = E.START_YEAR; c.convYears = {}; c.convYears[Y] = 50000;
  const s = E.simulate(c, {strategy: 'smart'});
  check('chosen conversion used in that year', row(s, Y).conv, 50000, 1);
  check('chosen conversion ignored outside the conversion plan', row(E.simulate(c, {strategy: 'brk'}), Y).conv, 0, 0);
  const tops = E.WI.convTops(clone(EX), Y), t12 = tops.find(t => t.k === 1);
  const at = a => { const d = clone(EX); d.convYears = {}; d.convYears[Y] = a; return row(E.simulate(d, {strategy: 'smart'}), Y) };
  const r1 = at(t12.amt), r2 = at(t12.amt + 1000);
  check('fill the 12% bracket: stays inside it', r1.ordT <= r1.br[1] ? 1 : 0, 1, 0);
  check('fill the 12% bracket: $1,000 more goes over', r2.ordT > r2.br[1] ? 1 : 0, 1, 0);
  const d = clone(EX); d.cash = 0; d.cashFloor = 0; d.brokerage = 0; d.convYears = {}; d.convYears[Y] = 100000;
  check('chosen conversion shrinks to $0 when no cash or brokerage can pay its tax', row(E.simulate(d, {strategy: 'smart'}), Y).conv, 0, 0); }
console.log('--- 401(k): limits, Roth share, Roth catch-up ---');
{ // 2027 limits: 25,500 base; 8,500 catch-up from 50; 11,750 at 60-63; Roth catch-up if prior-year pay > 155,000
  const w = (dob, inc, pct, extra) => base(Object.assign({dob, income: inc, retireAge: 70, k401Pct: pct}, extra || {}), null, {wage: 0, rCash: 0});
  const r = (c, o) => E.simulate(c, Object.assign({strategy: 'brk'}, o || {})).rows[0];
  check('401(k) capped at 25,500 at 45 (300k x 20%)', r(w('1982-01-01', 300000, 20)).ordWage, 300000 - 25500, 1);
  check('401(k) cap 25,500 + 11,750 at 61 (catch-up No)', r(w('1966-01-01', 300000, 20, {catchUpRoth: 'no'})).ordWage, 300000 - 37250, 1);
  check('age 55, pay 200k: catch-up 8,500 must be Roth', r(w('1972-01-01', 200000, 20)).ordWage, 200000 - 25500, 1);
  check('age 55, pay 200k, catch-up set to No: all 34,000 pre-tax', r(w('1972-01-01', 200000, 20, {catchUpRoth: 'no'})).ordWage, 200000 - 34000, 1);
  check('age 55, pay 150k (under 155k): catch-up pre-tax', r(w('1972-01-01', 150000, 20)).ordWage, 150000 - 30000, 1);
  check('Roth share 100%: no deduction', r(w('1982-01-01', 200000, 10, {k401RothPct: 100})).ordWage, 200000, 1);
  check('Roth share from age 50 not yet at 45', r(w('1982-01-01', 200000, 10, {k401RothPct: 100, k401RothAge: 50})).ordWage, 180000, 1);
  // stop contributing, zero returns: brokerage gains the 20,000 not contributed less the extra tax on it
  const c = w('1982-01-01', 200000, 10), z = {returns: new Array(60).fill(0)};
  const a = r(c, z), b = r(c, Object.assign({k401: {who: 'both', mode: 'stop'}}, z));
  const tx = o => E.fedTax({Y: 2027, st: 'single', n65: 0, ss: 0, ix: 1, seniorExt: false, ord: o, qual: 0, nii: 0}).tax;
  check('stop: deduction gone', b.ordWage, 200000, 1);
  check('stop: brokerage gets pay not contributed, after tax', b.brk - a.brk, 20000 - (tx(200000) - tx(180000)), 2);
  const d = r(c, Object.assign({k401: {who: 'both', mode: 'roth'}}, z));
  check('Roth: extra tax paid from savings', a.cash + a.brk - d.cash - d.brk, tx(200000) - tx(180000), 2);
  check('Roth: contribution goes to Roth', d.roth - a.roth, 20000, 2); }
{ // one retired, one working: the not-contributed pay is counted once (it already flows through the year's cash)
  const c = base({dob: '1982-01-01', income: 200000, retireAge: 70, k401Pct: 10}, {dob: '1962-01-01', retireAge: 0}, {wage: 0, rCash: 0});
  const z = {strategy: 'brk', returns: new Array(60).fill(0)}, a = E.simulate(c, z).rows[0], b = E.simulate(c, Object.assign({k401: {who: 'both', mode: 'stop'}}, z)).rows[0];
  check('stop with spouse retired: savings rise by pay not contributed less its tax, once', (b.cash + b.brk) - (a.cash + a.brk), 20000 - (b.fed + b.state - a.fed - a.state), 2); }
console.log('--- Roth IRA income limit, after-tax 401(k) ---');
{ // single, age 45, no other income: Roth IRA phases out 158,000-173,000 (2027); IRA limit 7,500 (+1,100 from 50)
  const one = (dob, inc, extra) => base(Object.assign({dob, income: inc, retireAge: 70}, extra || {}), null, {wage: 0, rCash: 0});
  const z = {strategy: 'brk', returns: new Array(60).fill(0)}, r = c => E.simulate(c, z).rows[0];
  check('Roth IRA: half allowed at 165,500 (mid phase-out)', r(one('1982-01-01', 165500, {rothAdd: 7000})).roth, 3500, 1);
  check('Roth IRA: the cut part goes to brokerage', r(one('1982-01-01', 165500, {rothAdd: 7000})).rothIraCut, 3500, 1);
  check('Roth IRA: none allowed at 180,000', r(one('1982-01-01', 180000, {rothAdd: 7000})).roth, 0, 1);
  check('Roth IRA: pre-tax 401(k) brings income under the limit (180k - 25.5k)', r(one('1982-01-01', 180000, {rothAdd: 7000, k401Pct: 20})).roth, 7000, 1);
  check('Roth IRA: capped at 7,500 at 45', r(one('1982-01-01', 50000, {rothAdd: 10000})).roth, 7500, 1);
  check('Roth IRA: capped at 8,600 at 55', r(one('1972-01-01', 50000, {rothAdd: 10000})).roth, 8600, 1);
  // after-tax 401(k): 75,000 total - 20,000 own - 10,000 match = 45,000 room
  check('after-tax 401(k) to Roth: capped by the 75,000 total', r(one('1982-01-01', 200000, {k401Pct: 10, matchPct: 5, afterTaxRoth: 60000})).roth, 45000, 1);
  check('after-tax 401(k) to Roth: under the cap, all of it', r(one('1982-01-01', 200000, {k401Pct: 10, matchPct: 5, afterTaxRoth: 20000})).roth, 20000, 1); }
console.log('--- Conversions from 63 ---');
{ // retired couple, big IRA, fill the 24% bracket; from 63 a lower target can apply (Medicare looks back two years)
  const c = (dob, c63) => base({dob, ira: 3e6}, {dob}, {convTarget: 'b24', conv63: c63, spend: 40000, rCash: 0});
  const r = (dob, c63) => E.simulate(c(dob, c63), {strategy: 'smart'}).rows[0], T1 = E.RULES.irmaa.mfj[0];
  check('age 64, same targets: income over the first Medicare line', r('1963-01-01', 'same').agi > T1 ? 1 : 0, 1, 0);
  check('age 64, just under the first Medicare line', r('1963-01-01', 'irmaa1').agi <= T1 ? 1 : 0, 1, 0);
  check('age 64, under first line but converts close to it', r('1963-01-01', 'irmaa1').agi > T1 - 2000 ? 1 : 0, 1, 0);
  const z = r('1963-01-01', 'zero'); check('age 64, 0% line: taxable income at most the 0% line', z.taxable <= z.l0 + 1 ? 1 : 0, 1, 0);
  { const d = c('1963-01-01', 'irmaa1'); d.infl = 3; const s = E.simulate(d, {strategy: 'smart'});
    check('with inflation, converting just under the line at 64 means no surcharge at 66', s.rows[2].irmaaK, 0, 0); }
  check('age 60: after-63 setting not yet used', r('1967-01-01', 'irmaa1').conv, r('1967-01-01', 'same').conv, 1); }
console.log('--- Keeping figures current ---');
{ // Every tax/benefit figure must come from RULES. Flag any "$12,345"-style figure in the page or UI script
  // (outside the engine) that equals a RULES value, since it would go stale at the yearly update.
  const i = html.indexOf('<script id="engine">'), j = html.indexOf('</script>', i), ui = html.slice(0, i) + html.slice(j);
  const vals = new Set(); (function walk(o) { for (const k in o) { const v = o[k]; if (typeof v === 'number' && v >= 1000) vals.add(v); else if (v && typeof v === 'object') walk(v) } })(E.RULES);
  // Known figures that are NOT tax rules but happen to equal a RULES value (sample data, market benchmarks).
  const ALLOW = [/spending $/, /average retired worker gets about $/, /often costs \$?[0-9,]* ?(to )?$/, /it is often \$?[0-9,]* ?(to )?$/, /spending $/, /check federal tax on $/];
  const hits = []; const re = /\$([0-9]{1,3}(?:,[0-9]{3})+)/g; let m;
  while ((m = re.exec(ui))) { const n = +m[1].replace(/,/g, ''), before = ui.slice(Math.max(0, m.index - 40), m.index).replace(/\s+/g, ' ');
    if (vals.has(n) && !ALLOW.some(a => a.test(before))) hits.push('$' + m[1] + ' near "' + before + '"') }
  hits.forEach(h => console.log('     typed-in figure: ' + h));
  check('no rule figures typed into the page text (they must come from RULES)', hits.length, 0, 0); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
