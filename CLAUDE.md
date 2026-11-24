# Retirement Runway: notes for Claude

Tool #1 of **Financial Tools of Life**: a single-page retirement planner. It must work with
no AI behind it; every number is computed in the browser by the engine in `index.html`.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole app, written in the **claude.ai page format**: no `<!doctype>`, `<html>`, `<head>` or `<body>` tags (claude.ai adds them). Do not add them here. |
| `tools/build-pages.js` | Builds the collection: wraps each page in a full HTML document, writing `_site/` (GitHub Pages) and `_artifact/` (tool pages for the claude.ai collection link). Both are git-ignored. |
| `.github/workflows/pages.yml` | On every push to `main`: runs the rules check, builds, deploys to GitHub Pages. A failing check blocks deployment. |
| `guide/index.html`, `prism/guide/index.html` | The companion guides to Runway and to Prism: pages of short lessons on how to use each tool (see "The guides" below). No engine and no data of their own. |
| `tests/check-rules.js` | Checks against hand-worked answers, a scan for typed-in rule figures, and checks that the guide names only what is on the page (116 in all). Run `node tests/check-rules.js` after any change to the engine, the rules, or a name on the page. |
| `tests/check-prism.js` | Prism's engine checks on invented companies, and checks that Prism's guide names only what is on the page (383 in all). Run `node tests/check-prism.js` after any change to Prism's engine or to a name on its page. |

Inside `index.html`:
- `<script id="engine">` holds all calculations: the `RULES` block (every tax and Social Security
  figure, with sources), `fedTax`, Social Security helpers (including the optional trust-fund cut, `opt.ssCut` / `cfg.ssCutOn`), `simulate`, Monte Carlo (`makePaths`,
  `mcJob`), and the what-if calculators (`WI.*`). The engine's text is also loaded into Web Workers,
  so it must stay self-contained, ES5-style plain functions, with no references to the page.
- The second `<script>` is the UI: inputs, rendering, charts (hand-drawn SVG), exports (report .md,
  CSV, PDF via jsPDF from cdnjs, pinned versions), file import, help popovers, maintainer checklist, and the
  small part that opens the page where the guide asks (`ftolShow('runway')`, see "The guides").

## Where it's published

1. **claude.ai artifact** (the owner's private link): https://claude.ai/artifact/GhUT9d6gZtRnZ3UWhXRHfm
   Republish with the Artifact tool, passing that `url` and `index.html` as the file. It declares
   the `downloads`, `db` and `user` capabilities; keep them on redeploys.
2. **GitHub Pages**: deployed automatically from `main` by the workflow.

Both should carry the same `index.html`. After changing the app: run the checks, commit and push,
and republish the artifact.

The page detects where it runs: inside claude.ai it saves files through `claude.use('downloads')`;
on its own website (`STANDALONE`) it uses ordinary browser downloads. Keep both paths working, and
never assume `window.claude` exists.

claude.ai lets a page save only certain kinds of file: among them `txt`, `json`, `md`, `csv`, `html`, `pdf`, `xlsx`
and `zip`. Others are refused, including `.tsv` and `.ics`. So every download uses an allowed type (Prism's case
notes are a CSV), or the page says what to do instead (Open This First's calendar reminder, which only the
standalone site can save). Check the list in the `downloads` capability's type definitions before adding a new kind.

## Accuracy rules (this is about people's money)

- Every tax or benefit figure lives in `RULES` with its source and year. Never hard-code one elsewhere.
  That includes explanatory text: help notes (`HELP`), guides and "How this works" must build their
  figures from `RULES` (e.g. `full(RULES.irmaa.mfj[0])`), so the yearly update refreshes them. The rules
  check scans the page for typed-in figures that match a `RULES` value and fails if it finds one; genuine
  non-rule figures (sample data, market benchmarks) go in its `ALLOW` list with a reason.
- Prefer official sources (IRS, SSA, state revenue departments, Tax Foundation tables). When a figure
  comes from secondary sources or memory, say so to the owner and mark it in `RULES` comments.
- Verify changes with numbers: hand-compute expected values, add a check to `tests/check-rules.js`,
  and run the whole suite. Confirm the federal reference figures in the tests still match after rule changes.
- State the model's simplifications openly in the "How this works" section.
- Results compare plans on lifetime tax and after-tax value to heirs; "today's dollars" deflate flows by
  `fi` and end-of-year balances by `fe` (one more year).

## Yearly update (November)

1. Mid-October: SSA COLA fact sheet → `RULES.fica.wageBase`, `RULES.earningsTest.limit`.
2. Early November: IRS inflation adjustments → `RULES.fed` brackets, standard deduction, 65+ add-on,
   0%/15% gains thresholds; IRS plan limits → `RULES.limits`. Update `RULES.meta`.
3. February: Tax Foundation state table → `RULES.states` (rates, brackets, deductions, Social Security
   rules, exclusions) and `RULES.statesReviewed`.
4. Spring/summer: Social Security Trustees Report → `RULES.ssTrust` (depletion years and payable %, used by the
   "Social Security cut" what-if presets and the optional plan setting).
5. Watch for law changes: senior deduction (ends after 2028), RMD ages, Social Security.
6. Update the 2027-based expected values in `tests/check-rules.js`, run it, push, republish.

The page's "Tax rules and sources (for maintainers)" section lists every figure, its source and
publication date, generated from `RULES`.

## Privacy

- Never commit personal plans, reports, PDFs, CSVs or screenshots (`.gitignore` blocks them).
- The built-in example is the fictional sample couple "Dan and Linda". Keep real users'
  names and numbers out of the code, tests, commits and this file.
- User inputs stay in the browser (localStorage) and in files the user downloads. Nothing is sent anywhere.

## Writing and design

- Plain English for non-experts: short sentences, active voice, name things as people know them.
  Explain terms like RMD or IRMAA the first time.
- Colors are CSS tokens on `:root` with dark-mode overrides; chart palettes were checked for color-blind
  safety; layout must work at phone width without sideways scrolling.
- Every input and result can carry a `?` help note (`HELP` map): what it is, the assumption, typical values.
- **The owner's bar (said on 2026-11-20): a tool must make life easier, not become "a nobel prize initiative".**
  He found the 20-tab workbook his Claude-chat Prism produces too complex. So: the answer comes first on the page,
  in plain words; dials and extras sit collapsed below or behind one "More options" box; no codes or letter
  abbreviations on the first screen; add a feature only when he asks for it. When in doubt, leave it out.

## Views (lenses)

One engine, four views selected by the bar above the headline (`S.lens`): **Plan** (all the original
panels), **This year** (`drawYear`: paycheck, estimated tax, to-do list), **Health** (`drawHealth`:
marketplace subsidy and Medicare IRMAA from `RULES.aca` / `RULES.irmaa`), **Legacy** (`drawLegacy`).
Anything that changes the plan's numbers goes in the engine (health costs, QCDs); views only read rows.
New inputs should default to off and sit in collapsed or optional sections, to keep the page simple.

## The example and the reader's own numbers (`MINE`)

The owner asked on 2026-11-20 for a button to "reset" the page to the made-up people, so that he could follow the
guide with them. There was one, "Reset to example", but it sat inside the collapsed "Save or load a scenario" box,
where he did not find it, and it erased the reader's numbers. Now:

- **Show example** (`#exBtn`) is a small button under the title, beside the tax-figures line. It is offered whenever
  something other than the untouched example is on show. It shows Dan and Linda and **sets the reader's numbers aside
  instead of erasing them**: they go into `MINE`, which is saved inside the `retirement-runway-v2` entry
  (`mine: {s, ex, real, strat}`). So they survive a reload and the trips to the guide and back, and the home page's
  encrypted copy carries them.
- The banner then says "Your own numbers are kept" and offers **Bring back my numbers** (`#mineBtn`), which restores
  them exactly and drops whatever was tried on the example. If the example has been changed, the banner reads "Your
  earlier numbers are kept." Pressing Show example again gives a clean example and keeps the same set-aside numbers.
- While numbers are set aside, the home page's status line (`ftol-summary-runway`) is left as it was, so the home
  page goes on describing the reader's own plan.
- **Erase my numbers** is the old "Reset to example", in the same collapsed box, and still asks twice. It removes
  the numbers on show and any set aside. Keep the two names apart: one keeps, the other erases.
- The button is under the title and not with the download buttons, because a sixth button there made the header
  wrap on a laptop screen.
- The other tools already had a visible way: Prism's "Show example" beside "Load a screener file" (the reader's
  file comes back on a reload), and Open This First's "See an example".

## The guides (`guide/index.html` for Runway, `prism/guide/index.html` for Prism)

The owner asked for Runway's on 2026-11-20: Runway "has become quite sophisticated", so could it have a companion
tutorial. He then asked for a similar one for Prism, and said Open This First's should wait until that tool is mature
("still in a very formative stage"). A guide is a separate page, so that its tool gains nothing new to look at.

- **What a guide is.** A list of lessons, each closed until tapped. "Start here" has three numbered lessons. Then one
  lesson per question the tool answers, then keeping and saving, then the terms explained. The first screen is the
  list and nothing else. Keep it that way.
  - Runway: look around with the sample couple, put in your own numbers, read your answer; which account pays the
    bills, Roth conversions, this year, Social Security, health, legacy, the what-if calculators, where the numbers
    come from; saving and the yearly check-up. Its first lesson tells a reader who already has numbers to press
    Show example, which keeps them (see the section above).
  - Prism: look around with the made-up companies, load your own file, read a row; the A-list, on sale (with
    holding up or slipping), the entry ceiling, the put desk, the five questions, the nine named lists, moonshots,
    why a company isn't listed; verdicts (and how to note a put), the signs that a business is winning, what
    changed, the scorecard; options and settings,
    saving, a routine for each new file.
- **It shows where things are and leaves the figures to the page.** No tax or benefit figure goes in Runway's guide,
  and no pass mark or price in Prism's (each check scans its guide), so nothing in a guide needs the yearly update
  or changes with a setting. For a figure, the guide sends the reader to the page's own "?" notes.
- **Names must match the page word for word.** Every button, heading, tag, menu choice or field a guide names is set
  as `<b class="k">` (`class="k s"` for a short name, which then never breaks across lines; long ones wrap). The
  checks read those names and fail if one is not on the tool's page. They also fail if a view or what-if calculator
  (Runway), or a named list, verdict or one of the five questions (Prism), changes without the guide following. So
  **when you rename, add or remove a button, heading, view, calculator, list or tag in a tool, change its guide in
  the same commit.**
- **Prism's guide keeps Prism's lines.** It says that Prism lists companies to research and does not tell you what
  to buy, that most moonshots disappoint, that nothing has been tested against later returns and that it is not
  investment advice; it never calls a list proven. The check holds it to each of these. It explains the entry
  ceiling the way the page does: "the most to pay", "spare cash", no multiples.
- **"Show me" links.** Each carries `data-go` with what to show. Runway: `{"lens", "wi", "el"}`, a view, a what-if
  calculator and the id of a part of the page. Prism: `{"list", "sort", "open", "el", "box"}`: a list of the Show
  menu (`""` is the five-question list, `"near"` the near misses), an order, `"open":"first"` to open the first
  company, and a part of the page (`"detail"`, `"vform"` and `"signs"` are the opened company's detail, its
  verdict form and its "Is the business winning?" box;
  `"box":"self"` outlines the part itself and not the panel around it). Any may be left out. On a tap the guide
  writes this as a note in `localStorage` key `ftol-show`, with the tool's name. The tool reads its own note once
  as it loads (`ftolShow`, while it is under a minute old), sets its view, and calls `ftolSpot`, which opens any
  closed section around the part, brings it into view, keeps it there while the page is still settling (until the
  reader touches the page), outlines it for a few seconds and shows "← Back to the guide" (`#guideBack`) for that
  visit. Both functions are in the shared snippet. The note is used instead of the address because on claude.ai the
  address belongs to the collection and only a plain `#name` passes through it. A lesson's link sets the list or
  view (as tapping it would) but never an order or a setting: the reader chooses those.
- **Coming back.** A guide remembers the lesson opened last (`ftol-guide-runway`, `ftol-guide-prism`: `{at, t}`)
  and reopens it for a reader who returns within half an hour.
- **Links.** The build sets `window.FTOL_GUIDE` on a tool that has a guide, and the shared snippet then shows
  "Guide: how to use this page" beside the link home. Runway's sample banner also mentions the guide. Prism's file
  card does not: an extra line there pushed the first company off the first phone screen. The build sets
  `window.FTOL_TOOL` on a guide. A page opened on its own has neither: a tool shows no guide link (so the
  single-tool links have no guide), and a guide hides its "Show me" links.
- **Shared between the guides.** Their layout and script are single-sourced: `tools/guide-snippet.css` and
  `tools/guide-snippet.js`, copied between the `GUIDECSS` and `GUIDEJS` markers by `node tools/sync-vault.js`. A
  guide's own file holds its colors (its tool's), its `data-tool` name and its lessons. A guide also carries the
  `VAULT` snippet, only for the link back to the home page and the note that lets a refresh return to the page
  that was open. It has nothing to save.
- Write a guide the way the rest is written: as you would say it to a friend, one step per line, naming exactly
  what to tap. Not built, and offered to the owner: a copy of a guide to print.

## Tool 2: Prism (`prism/index.html`)

A stock screener that runs on a file the user brings: one whole-market screener download (CSV or Excel, one row
per stock). It grades each business on its own merits (the A-list), says which A-list companies are on sale, and
keeps a put desk, a moonshot list and a scorecard. Its original part asks every company five separate questions
(cheap and out of favor), builds nine named shortlists, and works out what growth today's price implies. Same page
format as the other tools; no AI, no live data.

- **Never commit screener data or results from the owner's data.** The download is licensed to the owner. The
  built-in example is generated in the page (`exampleData`): invented companies whose symbols end in `.X`.
  `tests/check-prism.js` (383 checks) also uses invented companies. `.gitignore` blocks `*.csv`, `*.xlsx`, `*.tsv`.
- **It lists companies to research. It never recommends.** Keep that wording, and keep "not advice" in view.
- `<script id="engine">` is pure (no page references; the test asserts it). Main pieces: `FIELDS` (columns and
  header spellings), `mapTable`, `run` (lanes, share classes, sector percentiles, the five questions, blocks, data
  warnings, shortlists), `impliedGrowth` / `annuity` (reverse valuation and the entry ceiling), `memberships`.
- **Five separate answers, no combined score.** Q quality, V price, P progress and T timing are sector percentiles;
  S strength is an absolute test. The default order is by the weakest of Q, V, P, T. Do not add a weighted score.
- **Page layout: the list first.** After the file card comes the list itself: a title with the count, one plain
  sentence, and a "Show" menu. The page opens on "A-list on sale" (the owner asked for this on 2026-11-20); a file
  without the A-list columns falls back to the five-question list. The menu groups are: businesses worth owning
  (A-list on sale, put desk, the whole A-list), cheap and out of favor (yes to all five, near misses), long shots
  (moonshots), and the nine named lists. Rows say what was found in words, differently for each view (`found`);
  the Q/V/S/P/T letters and ranks appear only in a row's detail. "Order" sits beside "Show" (the owner asked how
  to sort by the entry ceiling on 2026-11-20; it had been hidden), and the two share one row even on a phone.
  Company size, find, the question toggles and the tally sit in the collapsed "More options", whose summary line
  says when a setting is not the default.
  Keep the first company on the first screen at phone width.
- **Help notes (`HELP`, `hb`, `tag`).** The owner expects contextual help everywhere (asked 2026-11-20). A "?"
  button sits beside the list title ("how to read a row", written for the list on show), the Show menu, each column
  heading, the options and "Your verdicts"; and every tag in a row (Holding up, Falling, Earnings in N days, the
  cautions) is a button that opens its own note, with that company's particulars. Notes open on a tap, because a
  hover note is no use on a phone; any other tap or Escape closes them. They build their figures from `C`, so they
  stay true when a setting changes. When you add a tag, a column or an option, add its note: the browser test
  checks that every `data-h` on the page has one.
  Write a note the way you would say it to a friend. The owner read the first entry-ceiling note and asked for it
  to be explained simply (2026-11-20). So: "the most to pay", "spare cash" (not free cash flow), the company's
  own figures, what it means at today's price, and no multiples or terms such as hurdle, yield or fair value. A
  bare dash or a bare percentage is not an answer either: say the reason ("None: cyclical") or the plain
  comparison ("3.1× ceiling"). The ceiling figure in each row opens such a note (`t_ceil`).
- **The A-list (`gradeOf`, `judge`).** Six tests of the business, price ignored, all absolute rather than ranked
  within a sector: return on capital (five-year and latest), years of profit in a row, sales growth (five and ten
  years), cash from operations against profit, share-count growth, and debt (net cash, or net debt over EBITDA
  with interest cover). Six yeses is grade A, five is grade B, and a test the file can't answer is not a pass. The
  reader's own choice wins: `S.mine` holds `{symbol: 'in' | 'out'}` and reaches the engine as `opt.pins`; any
  company can be pinned, even one that is set aside. `S.tierB` (off by default) lets grade B onto the list. The
  A-list views and moonshots ignore the five-question "not now" blocks; they have their own tests.
- **On sale (`saleOf`).** Two of three signs: P/E at most `sale_pe` of the company's own average (the lower of
  the five- and ten-year averages, capped at `sale_pecap` because thin years inflate an average); the price
  implying growth at least `sale_gap` under its sales record; `sale_dd` under the 52-week high.
- **Holding up or slipping (`slipOf`, `slipState`).** A low price doesn't say whether the business has begun to
  weaken. Four signs: latest-quarter sales growth far below the company's own pace (the lower of its five- and
  ten-year growth), return on capital well under its five-year average, next year's forecast far below that pace,
  and falling operating profit. Two or more is "slipping", none (with at least three judged) is "holding up". The
  on-sale list puts companies that are holding up first. On the owner's file this split the 27 on sale into 11
  holding up, 10 with one weak spot and 6 slipping, and the cheapest-looking name showed all four signs.
- **One worry, many names (`crowd`).** When one sector holds `crowd_share` of the on-sale list, the put desk or
  the moonshots, a line under the opening sentence says so and names the biggest industries: several companies
  marked down by the same worry are one bet.
- **What changed (`changes`, `drawDigest`).** A collapsed line above the list. After a second file it says who
  joined and left the main lists and why (`whyGone`), and it flags the companies the reader follows (a Watch, Act
  or Own verdict): review due, earnings within `alert_earn` days, a sharp weekly fall, leaving the A-list, starting
  to slip, crossing the entry ceiling. `memberships` keeps `slip` and `under` only so the next file can compare.
  It is hidden when there is nothing to say.
- **Put desk.** A-list companies that are on sale or fell `put_drop` in a week, with listed options. Rows show the
  weekly fall, the average daily range, the entry ceiling with the price, and days to the next earnings (marked
  inside `put_earn` days). The file has no option prices, and Prism never suggests a strike.
- **Rising or falling (`r.trend`).** Falling is below the 50-day average and down over a month; rising is above it.
- **Moonshots (`moonOf`).** Small, fast-growing, able to pay their own way: size, sales, growth, gross margin, net
  cash, years of cash at today's spending, dilution, and growth plus cash margin. Cyclical industries are left
  out. Always carry the line that most such companies disappoint.
- **Scorecard (`cardStep`, `cardStats`, `S.card`).** With each newer file it records who joined each list and at
  what price, and chains an index of the typical large company (the median price change between files). Later it
  shows each list's median change since joining against that index over the same days. Price only; a company that
  left the file or split its shares is dropped. It says plainly when the history is under three months. This is
  the only test any Prism threshold has had: never describe a list as proven.
- **Dividends (`dividendOf`, `dividendLine`).** The owner asked on 2026-11-24 whether showing dividends would help.
  A trial on his file said: not as a column or a test, but in two places, and he approved those two.
  1. A line in a company's detail: what it pays a year and what share of the price that is, how many years it has
     been paid and raised in a row, how much of the company's spare cash it takes ("Not covered" when that is more
     than all of it, or when there is none), "Lower" when it is lower than a year ago, and the next ex-dividend date.
  2. On the put desk, a tag "Ex-dividend in N days" when the date has been declared and is within `put_earn` days.
     Its note says why a put seller cares: once assigned and holding, a call sold in the money is often exercised
     just before that date. The put seller's line in the detail names the date too.
  Rules, each for a reason found on his file:
  - Dividends feed no test, list or order (a check asserts it). The A-list is not an income list (most of it pays
    one, but the typical yield is small), and the entry ceiling already counts the cash a dividend is paid from.
  - The file gives the next ex-dividend date only once the company has declared it; until then the column holds the
    last one. Prism shows the last date and how often the company pays, and never guesses the next.
  - "Lower" is said only when the file's one-year growth is negative and its count of growth years is zero. The two
    columns disagree for about a third of the lower ones (a special payment the year before, a late date, a currency).
  - The share of spare cash is the file's `FCF Payout`; where that is blank, the dividend over Prism's own
    free-cash-flow yield. On his file the two agree closely.
  - `Last Div.` is not read: it can be a special payment. A typical payment is the yearly amount over the number of
    payments a year.
  Offered and not built: an ex-dividend alert under "What changed" for companies he follows, a yield column in the
  rows, dividends in the scorecard (the typical yield is about the same on both sides, so leaving them out distorts
  little).
- **A stored file from before a column was added.** The file kept in the browser holds only the columns Prism read
  when it was loaded, so after Prism learns new columns their facts are missing until the file is loaded again. The
  owner looked for the new dividend line in three companies on 2026-11-24 and found nothing: the only word about it
  was a grey sentence in the file card. So now (`OLDER`, `#olderNote`) an amber note in the file card says "Load your
  file again" and names what is missing, and a company's detail says the same in the place where the dividend line
  would be. **Whenever a column is added, say so where the reader will look for its result, not only in small print.**
  The signs do the same: with such a file, "Is the business winning?" opens with "Load your file again".
- **Several users, one file (the owner's direction, 2026-11-24; not built).** He wants the screener file loaded once,
  by him as admin, and used by several people, each at their own level. The data provider's terms decide the shape.
  The clause he pasted forbids republishing the provider's content in full without explicit permission, and allows
  snippets that are unchanged and name the source. He then proposed that Prism be the only window, with no access to
  the full file at any time. That is the right shape, on one condition that the platform imposes:
  - **There is no server.** A claude.ai page runs in each person's browser, and whatever a shared store holds can be
    read out by anyone the page is shared with. So the full download must never go into a shared store, not even
    hidden behind the page. The file is read only in the admin's browser, and his Prism publishes only what the
    others may see.
  - **How wide the window can be** (sized on his file): the lists and what each row says are about 0.2% of the
    file's cells, clearly a snippet. The lists plus the full detail of every listed company (about 400 companies in
    5,600) are under 2%, small but systematic and daily, so get the provider's yes first. "Look up any stock" for
    the whole market cannot be offered to others: it needs every company's figures in the shared store.
  - The page others see must name the data source, and quote the provider's figures unchanged.
  - Paying customers, or anything fuller, need the provider's written permission or a data licence.
  - Where it would live: an owner-only shared store on the claude.ai link (`db` rules, with each person's verdicts,
    A-list choices and signs under `data/users/<id>/`). The standalone site has no store, so it stays "bring your
    own file". The provider's site is outside this session's network policy: rely on what the owner pastes.
- **Signs that a business is winning (`SIGNS`, `KINDS`, `trackStep`, `signsRead`, `signBox`).** The owner asked
  on 2026-11-24 how to follow, quarter by quarter, the indicators that would convince him a company is winning
  (his example, for a consultancy: organic revenue growth, revenue per employee, gross margin, managed-services
  bookings, outcome-based contracts, free cash flow per share). He then said: "Lets do a solid tracker", and that
  one company's metrics "are relevant perhaps only for" that company: "you have to divine similar metrics for
  others."
  - **The box.** A company's detail has "Is the business winning?", after the A-list box. It is open for a company
    he follows (a Watch, Act or Own verdict) or has given a sign of his own, and closed, with the count in its
    heading, for any other. One line per sign: the figure now, what it is compared with, a reading in one word
    (Better, Worse, The same, Too early), and what happened since the report before. "Report by report" at the
    foot shows every report on record side by side.
  - **Signs fit the kind of business.** `KINDS` has fifteen kinds, each with four or five of the thirteen `SIGNS`
    and a sentence on what winning looks like. `KIND_OF` files the provider's 145 industry labels under them; a
    label it does not know gets the general signs. "Read it as" lets him choose another kind for a company
    (`S.kind`). On his file every label is covered and every A-list company has a figure for each of its signs.
  - **A reading from the first file.** A sign is set against the figure a year before. Until Prism has a year of
    its own record, that figure is worked out from the same file's growth columns (`signAgo`): for a margin, this
    year's margin times the growth in sales over the growth in profit. Sales growth is the latest quarter against
    the year as a whole; return on capital and on equity are set against their five-year average. Turnover, debt
    and book value have nothing to be set against on the first day and say "Too early".
  - **An allowance, so that noise is not read as news.** Each sign has one (`tol`): a third of a point for a
    margin, a point for growth and returns, one to three percent for the rest. A change inside it is "The same".
    A sign's note shows the company's two figures and says when the gap is inside the allowance.
  - **The record (`S.track`).** `Last Report Date` says which reported period the figures cover, so Prism files
    one set of figures per company per report: daily files are not needed. It keeps twelve reports for a company
    he follows or has given a sign of his own, five for the rest of the A-list (`sign_keep`, `sign_keep_other`).
    It only moves forward: an older file changes nothing. A period still on show is refreshed, because a figure
    can be corrected. After a share split, the per-share figures already recorded are dropped. `Last Earnings`
    is the day the results came out. "Start the record of signs again" is under Settings.
  - **His own signs (`S.own`).** Bookings, same-store sales, orders in hand: no download carries them. Each kind
    suggests two or three, and he can name his own, as "Higher is better", "Lower is better" or "I will judge it
    myself" (a judgement per report instead of a figure). He types the figure for the latest report and the one a
    year before from the same report. They are kept as he types them (`ownSet`), and `signPatch` redraws only the
    readings, so a field being typed in is never replaced.
  - **What tells him to look.** "What changed" says when a followed company has new results and how its signs
    stand, and when a sign of his own is waiting for a figure. "Your verdicts" has a "Signs" column with the count
    and a "New report" tag.
  - **Rules.** No combined score, no forecast, no "winning" or "losing" from Prism (a check holds the page to it);
    the signs feed no test, list or order (a check asserts it). The figures are the file's trailing-twelve-month
    ones, and sales growth is as reported, not organic: the box and the notes say so. Headcount comes from the
    annual report, so sales per employee is compared only with a year before (`yearly`). Keep `track` apart from
    `own` and `kind`: it is the part that could one day be filled by one person for several.
  - Offered and not built: a download of the record as a CSV; filling in the past from a per-company
    financial-history download or from the regulator's filings (needs a sample, or network access); own signs
    that Prism works out from two typed figures.
- **Fee businesses in financial industries.** In Credit Services, Asset Management, Capital Markets and Financial
  Conglomerates, a company is scored like any other when the file gives it EBITDA-based figures (a card network,
  a fund manager); a lender gets none and stays set aside. Banks and insurers are always set aside.
- **Unknown is never a pass.** Missing data gives "unknown", which fails a required question.
- **Verdicts and the owner's put selling.** He mostly gets in by selling cash-secured puts, and sells a near call
  if he is assigned and doesn't want to hold. The record for that: Act while a put is open (strike and expiry
  under "Entry", the expiry as "Review by", which turns into a Due mark), then Own once assigned, with any call
  noted the same way. The verdict form says so, and "Your verdicts" shows the review date and entry first. The
  five verdict names come from his case-notes headings: don't add trade types as verdicts. Separate strike and
  expiry boxes, with each file showing the distance from the strike, were offered and are not built.
- `CONTROLS` are editable starting points, none tested against later returns: say so wherever results are shown.
- `FIELDS`: the first spelling of each of the 85 columns was checked against the owner's real downloads (a
  20-column file dated 2026-11-04 and the full 336-column file dated 2026-11-20); a check holds the 85 headings.
  The last nineteen were added on 2026-11-24: eight dividend columns, then eleven for the signs.
  Later spellings are guesses for other files, and a match on one is reported on the page as "matched by name
  only". What the full file taught us, so nobody has to find it twice:
  - Statement figures are already in US dollars, whatever currency the company reports in.
  - Percentages carry a `%` sign; in the 20-column file they were plain fractions. Both are read.
  - Its `FCF Yield` column is worked out on one share class, so it overstates the yield for about 340 companies
    with several classes or partnership units. `derive` therefore uses free cash flow ÷ market value when the file
    has both, keeps the file's figure in `fcfy_file`, and the row's detail says when they differ.
  - Its `Primary` column means "listed first in the US", not "main share class": it is false for foreign
    companies such as large ADRs. Do not use it to drop rows. Share classes are still matched by CIK, then name.
  - `Is SPAC` agrees with the shell lane. A negative `Int. Cov.` is an operating loss, and fails the strength
    question when there is net debt.
  - Strength still uses `Debt / EBITDA` before subtracting cash, which is stricter than the owner's Claude-chat
    version (net debt ÷ EBITDA; the file has `ND / EBITDA`). Switching changes the answer for about 126 large
    companies, so ask him first.
- Sources: the owner's Prism requirements document, his "Investment Opportunity Atlas" workbook, and the
  "Atlas & Prism latest" workbook that his Claude-chat Prism produces (none is in the repo). That last one has 20
  tabs and 106 coded column names, and its watchlist is empty: he finds it too complex. Do not rebuild its boards
  (changes since the last run, decade divergence, leader league, specialist lane) unless he asks. Its dashboard
  says the full screener export has 336 fields. The page's case-notes file uses the owner's existing column headings exactly (`NOTE_HEAD`); keep them.
- "Columns found in the file" has a list of every column heading in the loaded file (`colText`), to copy or save.
  It holds headings only, never figures, so the owner can send it when asking for more columns to be read.
- State: `localStorage` key `prism-v1` (settings, verdicts, A-list choices, the scorecard, last two list
  memberships, and the three parts of the signs: `track`, `kind`, `own`; `v: 2` marks state saved since the A-list
  became the opening view); IndexedDB `prism` keeps the last file in that browser only; `ftol-summary-prism` feeds
  the home page. The vault copy holds the same things except the file: the scorecard carries entry prices and the
  last prices of the large companies, and the record of signs a few figures per report for the A-list and the
  followed companies. On the owner's file the saved state is about 90 KB on the first day (the scorecard is two
  thirds of it) and the record of signs grows to about 50 KB.
- The built-in example carries made-up values for the newer columns too. Each batch of columns has its own random
  stream (four so far), so every earlier figure stays as it was. It includes a few young fast growers so the
  moonshot list has something to show, and a made-up record of five earlier reports for every company
  (`DATA.track`, built by running the real `trackStep` on made-up earlier figures), so the signs have a history to
  show. Adding an operating margin moved one company off one named list; the main lists did not change.
- **The guide** (`prism/guide/index.html`, asked for on 2026-11-20) has a lesson for each list and each thing the
  owner asked about along the way: the entry ceiling, the order, how to note a put, what the columns list is for.
  When a name on this page changes, the guide changes in the same commit (see "The guides").
- Not built yet (ask the owner): scoring banks and property (needs P/B, ROE), ten-year divergence, adjusting for
  share splits (the scorecard drops a split company instead), the owner's industry and override maps, a "copy a
  research brief" button. Offered on 2026-11-20 and not chosen then: put arithmetic (he types strike, expiry and
  premium; Prism works out the return on cash, the breakeven and what it assumes), a one-line market thermometer
  (share of the A-list on sale, tracked across files), and a "heavily shorted" caution tag.
- Deliberately left out, and said so to the owner: estimated option premiums (not in the file; a guess would
  mislead), analyst ratings and price targets, more chart indicators, any combined score.

## Coming soon: Open This First (`open-this-first/index.html`)

**Status (the owner, 2026-11-20): "still in a very formative stage".** He moved it out of the list of tools and
into "Coming soon" on the home page, and moved Prism up to no. 2. So: the home page shows it in its own "Coming
soon" section, as a quieter card with a plain link, "Open the early version", and no button; "Next steps" never
points to it; its own page says "Early version" above the title; it has no guide yet. Its page is still published
and still works, so answers already given are kept and the owner can go on shaping it. Do not give it a number,
a guide or a place among the tools until he says it is mature. He has not asked for the page to be taken down or
for the link to be removed; ask before doing either.


A family handoff guide: a short interview that produces a one-page "Open This First" cover sheet and a fuller map
(who to call, where things are, what not to do yet, what doesn't exist). Same page format and rules as Runway:
single file, no backend, answers stay in the browser (localStorage key `open-this-first-v1`) and in a save file.

- **A map, not a vault.** Never add fields for passwords, account numbers, SSNs or combinations. The page warns
  when an answer looks like one.
- Content lives in the `Q` list (id, area, kind, essential, title, question, why, "doesn't exist" label), `INDIA`
  hints, `DONT` and `FIRST`. These are general prompts, not legal advice; keep jurisdiction-specific claims soft
  ("a lawyer there can confirm") unless verified.
- claude.ai pages cannot open the print dialog: the packet downloads as a print-ready HTML file (`downloads`
  capability); the standalone site also shows a Print button.
- Published at https://claude.ai/artifact/8LVuAhJux3rvysgJx8Fw2H (owner's private link) and on GitHub Pages under
  `/open-this-first/` (built by `tools/build-pages.js`). The example is the fictional "Dan Rivera".
- Source: the owner's business requirements document (pilot stage). Accounts, sharing, payments and assisted
  setup are deliberately out of scope until the free local version shows demand.

## Encrypted and online copies (shared by all tools)

`tools/vault-snippet.js` is the single source for the "Encrypted copies" feature. `node tools/sync-vault.js` copies
it into each tool, the home page and the guides, between the `VAULT:START` / `VAULT:END` markers; the workflow fails
if a page is out of date. Never edit the copy inside a page. The same snippet carries what every page of the
collection shares: the link back to the home page (and to a tool's guide), the note that lets a refresh return to
the page that was open, and `ftolShow` / `ftolSpot`, which open a tool at the place a guide asks for. The same
command also copies the two guide snippets (see "The guides").

- The state is encrypted in the browser (PBKDF2-SHA256, 310,000 rounds, AES-GCM 256) with a passphrase that is
  held in memory only. There is no recovery: say so plainly wherever it is offered.
- Online copies use the claude.ai `db` capability under `data/users/<viewer id>/` (private per signed-in person),
  one document per saved version: `{app, name, at, enc, kdf, salt, iv, ct}`. Name and date are not encrypted.
- Both artifacts declare `capabilities: {downloads: true, db: {}, user: {}}`; keep all three on redeploys.
  Each artifact has its own store, so Runway versions and Open This First versions are kept separately.
- On the standalone site there is no online store: only encrypted files are offered.

## The collection: Financial Tools of Life (FTOL)

The tools are published together behind a home page (`home/index.html`): tool cards with each person's status,
next steps, and one "Your data" panel that saves every tool's state as a single encrypted copy. The cards are in
tool order: Retirement Runway (no. 1), then Prism (no. 2). Under them, "Coming soon" holds Open This First (see its
section). The encrypted copy still includes Open This First's answers.

- **One link, linked pages.** On claude.ai the collection is one artifact: the home page plus `runway.html`,
  `runway-guide.html`, `open-this-first.html`, `prism.html` and `prism-guide.html` beside it. Pages of one artifact share browser storage and the `db` store, and each keeps
  its capabilities. Collection link (owner's private link): https://claude.ai/artifact/MjYUrdnkLTLMZDNKJbgThE
- **To publish the collection:** `node tools/build-pages.js`, then publish `home/index.html` to that `url` with
  `files: {"runway.html": "_artifact/runway.html", "runway-guide.html": "_artifact/runway-guide.html",
  "open-this-first.html": "_artifact/open-this-first.html", "prism.html": "_artifact/prism.html",
  "prism-guide.html": "_artifact/prism-guide.html"}` and
  `capabilities: {downloads: true, db: {}, user: {}}`. The two single-tool links above are the earlier homes;
  keep them working until the owner says the collection link has replaced them.
- **Standalone site:** the home page is at the top, tools at `/retirement-runway/`, `/open-this-first/` and `/prism/`,
  and the guides at `/retirement-runway/guide/` and `/prism/guide/`.
- The build tells each page where the others are: `window.FTOL_LINKS` (home), `window.FTOL_HOME` (tools and
  guides, which then show a link back), `window.FTOL_GUIDE` (a tool that has a guide) and `window.FTOL_TOOL` (a
  guide). A tool opened on its own has none of them and works unchanged.
- **A refresh must not throw the reader back to the home page.** On claude.ai the address belongs to the whole
  collection, so refreshing the browser reloads `index.html` whatever tool was on show (the owner hit this on
  2026-11-20). The build gives each collection page its own file name (`window.FTOL_SELF`); the shared snippet
  makes a tool write `localStorage` key `ftol-at` (`{p: file, t: time}`) on load, every 20 seconds, when it becomes
  visible and as it is left; the home page, when the note is under three minutes old, goes straight back with
  `location.replace`. It does not when the reader came home on purpose: the link back clears the note, and the
  browser's Back button is recognised by its navigation type. Only the three tool file names and the two guides' are accepted. The
  standalone site and a tool opened on its own have their own addresses and do none of this.
- Tools tell the home page their status through `localStorage` keys `ftol-summary-runway`, `ftol-summary-otf` and
  `ftol-summary-prism`.
  The home page's encrypted copy holds each tool's own storage key verbatim (`app: 'ftol'`).
- Planned next: a shared profile (names, birth dates, state) and hand-offs between tools, starting with Runway's
  account types shaping Open This First's money questions.

## Roadmap ideas (ask the owner before starting)

Survivor benefit switching; a "best plan" optimizer button; health costs rising faster than inflation;
PolicyEngine-based rules sync; verifying low-confidence entries (DC, LA, SC, NM, AZ deductions; 2027
Part D surcharges; the ACA applicable-percentage table). Later, if the owner wants it: "Where to live in retirement",
which should hand its results to Runway through the scenario file.
