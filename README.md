# Financial Tools of Life

Plain tools for the money decisions that matter. Each one is a single page that runs in the
browser: nothing a user types or loads is sent anywhere.

| Tool | What it does | Source |
|---|---|---|
| **Retirement Runway** | How long your money lasts, which account should pay the bills, and how much to move into a Roth each year, using real federal and state tax rules. | `index.html` |
| **Open This First** | A short interview that makes a one-page guide for your family: who to call, where things are, and what not to do yet. | `open-this-first/index.html` |
| **Prism** | Turns a whole-market stock screener download into a short reading list: the few companies that pass five separate tests. Bring your own screener file; none is included. | `prism/index.html` |

**Use them online:** https://ashokkrishnan1-source.github.io/retirement-runway/

## Retirement Runway: what it does

- Year-by-year projection for a single person or a couple: wages, 401(k)/IRA/Roth,
  brokerage with cost basis, cash, Social Security (own, spousal, survivor, earnings
  test), pensions, required minimum distributions.
- Three withdrawal plans compared: IRA first, brokerage first, and brokerage first with
  Roth conversions (while working and in retirement, sized to a bracket or the 0%
  capital-gains line).
- 2027 federal tax rules, simplified rules for all 50 states plus DC, 1,000 simulated
  markets, and what-if calculators (spend it all, retire earlier, bad market timing,
  long-term care, spending more early, best Social Security ages, windfalls).
- Four views of the same plan: **Plan** (projection, comparison, what-ifs), **This year**
  (monthly paycheck, tax payments, dated to-do list), **Health** (marketplace premiums and
  subsidies before 65, Medicare surcharges from 65) and **Legacy** (what heirs receive by
  account type, heirs' tax rates, charitable giving from an IRA).

## Files

| File | What it is |
|---|---|
| `index.html` | Retirement Runway, the whole app. |
| `open-this-first/index.html`, `prism/index.html`, `home/index.html` | The other tools and the home page. |
| `tests/check-rules.js` | Retirement Runway's checks against hand-worked answers. Run with `node tests/check-rules.js`. |
| `tests/check-prism.js` | Prism's engine checks, on invented companies. Run with `node tests/check-prism.js`. |
| `tests/README.md` | How to run the checks and what to update each year. |
| `tools/build-pages.js` | Builds the standalone website into `_site/`. |
| `.github/workflows/pages.yml` | Runs the checks, then publishes to GitHub Pages on every push to `main`. |
| `CLAUDE.md` | Project notes for Claude sessions: structure, accuracy rules, yearly update steps. |

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

Planning tools, not tax, legal or investment advice. Use them to explore decisions and to start
a conversation with a tax preparer or adviser. Prism lists companies to research; it does not
say what to buy, and its thresholds have not been tested against later returns.
