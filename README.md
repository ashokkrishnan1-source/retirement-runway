# Retirement Runway

The first of the **Financial Tools of Life**: a single-page retirement planner that shows
how long your money lasts, which account should pay the bills, and how much to move into
a Roth each year, using real federal and state tax rules.

Everything runs in the browser. Nothing a user types is sent anywhere; inputs are saved in
that browser only, and plans can be downloaded and reopened as a report (.md), CSV or PDF.

## What it does

- Year-by-year projection for a single person or a couple: wages, 401(k)/IRA/Roth,
  brokerage with cost basis, cash, Social Security (own, spousal, survivor, earnings
  test), pensions, required minimum distributions.
- Three withdrawal plans compared: IRA first, brokerage first, and brokerage first with
  Roth conversions (while working and in retirement, sized to a bracket or the 0%
  capital-gains line).
- 2027 federal tax rules, simplified rules for all 50 states plus DC, 1,000 simulated
  markets, and what-if calculators (spend it all, retire earlier, bad market timing,
  long-term care, spending more early, best Social Security ages, windfalls).

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app. Open it in a browser, or publish it as a page. |
| `tests/check-rules.js` | 41 checks against hand-worked answers. Run with `node tests/check-rules.js`. |
| `tests/README.md` | How to run the checks and what to update each year. |

## Keeping it current

All tax and Social Security figures live in one block, `RULES`, at the top of the engine
script in `index.html`. The page's "Tax rules and sources (for maintainers)" section lists
every figure with its source and publication date, and generates a yearly checklist:

- Mid-October: SSA COLA fact sheet (wage base, earnings-test limit)
- Early November: IRS inflation adjustments (brackets, deductions, capital-gains limits)
  and retirement plan limits
- February: Tax Foundation state table

After updating, run the checks and republish.

## Disclaimer

A planning tool, not tax or investment advice. Use it to explore decisions and to start a
conversation with a tax preparer or adviser.
