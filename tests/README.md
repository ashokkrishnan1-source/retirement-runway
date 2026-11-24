# Retirement Runway rules check

A set of checks that compare the app's calculations with hand-worked answers.
Run it after every change to the tax rules or the engine, and before republishing.

## How to run

You need [Node.js](https://nodejs.org) installed (version 18 or newer). From the
`retirement-runway` folder:

```bash
node tests/check-rules.js
```

Each line prints `PASS` or `FAIL` with the expected and actual value, followed by
a total. The run ends with an error code if anything fails.

## What it checks

- **Federal tax:** worked examples ($150k from the IRA, the
  0% capital-gains line, filling the 12% bracket), single filers, and large gains
  with the 15%/20% rates and the 3.8% investment income tax.
- **State tax:** Illinois, Pennsylvania and California recomputed by hand from
  each year's figures; Florida has none; New Jersey single-filer limits; Georgia
  exclusions, including one-spouse ownership.
- **Social Security:** spousal top-ups, survivor benefits after early claims,
  the earnings test (including on a spouse's benefit), claim-age rounding.
- **Required withdrawals and payroll tax:** prior-year balance, the 0.9%
  Medicare surtax.
- **Simulation:** today's-dollar balances, Social Security saved while working,
  care costs before retirement, the 10% early-withdrawal penalty, conversion tax
  paid from brokerage with gains taxed, big one-time expenses, edge cases, and a
  fuzz test of 1,500 random plans for negative balances or missing numbers.
- **The guide:** every button, heading, view and calculator that the guide
  (`guide/index.html`) names must be on the page, word for word, and the guide
  must carry no tax figures of its own. If you rename something on the page, this
  check tells you which line of the guide to change.

Prism has its own file, run the same way: `node tests/check-prism.js`. It checks
Prism's engine on invented companies, and holds Prism's guide
(`prism/guide/index.html`) to the same rule: every menu choice, tag, heading and
named list it mentions must be on Prism's page, word for word.
It also works through the signs that a business is winning by hand: the figure a
year before, the allowance, the record kept from report to report, a share split,
and the reader's own signs. It does the same for the tests of a bank, for a
company's standing against its industry and for where a year's cash went, and
it checks the research tools in `tools/research/` on invented filings, without
touching the network. That includes the queue of companies waiting to be read: the
reading list holds names and the regulator's numbers only, and what comes back
from the online store is cleaned like any research file.

## After the yearly update

The federal reference figures are for the **2027** rules. When you update the
`RULES` block for a new tax year, those expected values change. Work out the new
answers (or confirm that the differences match the new brackets) and update the
expected numbers in `check-rules.js` before relying on a pass. All other checks
should keep passing unchanged.
