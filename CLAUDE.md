# Retirement Runway: notes for Claude

Tool #1 of **Financial Tools of Life**: a single-page retirement planner. It must work with
no AI behind it; every number is computed in the browser by the engine in `index.html`.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole app, written in the **claude.ai page format**: no `<!doctype>`, `<html>`, `<head>` or `<body>` tags (claude.ai adds them). Do not add them here. |
| `tools/build-pages.js` | Builds the collection: wraps each page in a full HTML document, writing `_site/` (GitHub Pages) and `_artifact/` (tool pages for the claude.ai collection link). Both are git-ignored. |
| `.github/workflows/pages.yml` | On every push to `main`: runs the rules check, builds, deploys to GitHub Pages. A failing check blocks deployment. |
| `tests/check-rules.js` | Checks against hand-worked answers (107 so far), plus a scan for typed-in rule figures. Run `node tests/check-rules.js` after any engine or rules change. |

Inside `index.html`:
- `<script id="engine">` holds all calculations: the `RULES` block (every tax and Social Security
  figure, with sources), `fedTax`, Social Security helpers (including the optional trust-fund cut, `opt.ssCut` / `cfg.ssCutOn`), `simulate`, Monte Carlo (`makePaths`,
  `mcJob`), and the what-if calculators (`WI.*`). The engine's text is also loaded into Web Workers,
  so it must stay self-contained, ES5-style plain functions, with no references to the page.
- The second `<script>` is the UI: inputs, rendering, charts (hand-drawn SVG), exports (report .md,
  CSV, PDF via jsPDF from cdnjs, pinned versions), file import, help popovers, maintainer checklist.

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

## Views (lenses)

One engine, four views selected by the bar above the headline (`S.lens`): **Plan** (all the original
panels), **This year** (`drawYear`: paycheck, estimated tax, to-do list), **Health** (`drawHealth`:
marketplace subsidy and Medicare IRMAA from `RULES.aca` / `RULES.irmaa`), **Legacy** (`drawLegacy`).
Anything that changes the plan's numbers goes in the engine (health costs, QCDs); views only read rows.
New inputs should default to off and sit in collapsed or optional sections, to keep the page simple.

## Tool 2: Open This First (`open-this-first/index.html`)

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
it into each tool between the `VAULT:START` / `VAULT:END` markers; the workflow fails if a page is out of date.
Never edit the copy inside a page.

- The state is encrypted in the browser (PBKDF2-SHA256, 310,000 rounds, AES-GCM 256) with a passphrase that is
  held in memory only. There is no recovery: say so plainly wherever it is offered.
- Online copies use the claude.ai `db` capability under `data/users/<viewer id>/` (private per signed-in person),
  one document per saved version: `{app, name, at, enc, kdf, salt, iv, ct}`. Name and date are not encrypted.
- Both artifacts declare `capabilities: {downloads: true, db: {}, user: {}}`; keep all three on redeploys.
  Each artifact has its own store, so Runway versions and Open This First versions are kept separately.
- On the standalone site there is no online store: only encrypted files are offered.

## The collection: Financial Tools of Life (FTOL)

The tools are published together behind a home page (`home/index.html`): tool cards with each person's status,
next steps, and one "Your data" panel that saves every tool's state as a single encrypted copy.

- **One link, linked pages.** On claude.ai the collection is one artifact: the home page plus `runway.html` and
  `open-this-first.html` beside it. Pages of one artifact share browser storage and the `db` store, and each keeps
  its capabilities. Collection link (owner's private link): https://claude.ai/artifact/MjYUrdnkLTLMZDNKJbgThE
- **To publish the collection:** `node tools/build-pages.js`, then publish `home/index.html` to that `url` with
  `files: {"runway.html": "_artifact/runway.html", "open-this-first.html": "_artifact/open-this-first.html"}` and
  `capabilities: {downloads: true, db: {}, user: {}}`. The two single-tool links above are the earlier homes;
  keep them working until the owner says the collection link has replaced them.
- **Standalone site:** the home page is at the top, tools at `/retirement-runway/` and `/open-this-first/`.
- The build tells each page where the others are: `window.FTOL_LINKS` (home) and `window.FTOL_HOME` (tools, which
  then show a link back). A tool opened on its own has neither and works unchanged.
- Tools tell the home page their status through `localStorage` keys `ftol-summary-runway` and `ftol-summary-otf`.
  The home page's encrypted copy holds each tool's own storage key verbatim (`app: 'ftol'`).
- Planned next: a shared profile (names, birth dates, state) and hand-offs between tools, starting with Runway's
  account types shaping Open This First's money questions.

## Roadmap ideas (ask the owner before starting)

Survivor benefit switching; a "best plan" optimizer button; health costs rising faster than inflation;
PolicyEngine-based rules sync; verifying low-confidence entries (DC, LA, SC, NM, AZ deductions; 2027
Part D surcharges; the ACA applicable-percentage table). Later: Tool #3, "Where to live in retirement",
which should hand its results to Runway through the scenario file.
