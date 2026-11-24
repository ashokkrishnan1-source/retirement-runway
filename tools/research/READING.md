# Prism research, step 2: reading a company's filings

This is the one part of Prism that needs a reader. Prism's page has no AI in it, by design. The reading is done
by Claude in a session, from files that `edgar.js` fetched, and the result goes back to Prism as a file that the
page only displays.

You are given a folder for one company. Read it, and write a brief as one JSON file.

## What is in the folder

| File | What it is |
|---|---|
| `meta.json` | The company, and the filings the other files were cut from (`sources`, each with an `id`, a form, a date and an address). |
| `k.business.txt` | The annual report: what the business is, and usually its own account of its competition. |
| `k.risks.txt` | The annual report: risk factors. The first part of a long section. |
| `k.discussion.txt` | The annual report: management's discussion of the year's results. |
| `k.report.txt` | Only for a company that files a 20-F or 40-F: the whole annual report, cut short. |
| `p.pay.txt` | The proxy statement: how the executives are paid, and what the pay depends on. |
| `p.rest.txt` | The proxy statement: the pay table, pay against performance, the pay ratio, who owns the shares, dealings with insiders. |
| `rivals.json` | For each rival Prism picked: what its own annual report says about competition, and the paragraphs that name this company. |
| `namedby.json` | Other companies whose annual reports name this company where they speak of competing, with those paragraphs. |
| `tenyears.json` | Ten years of reported figures. You do not copy it; the packer adds it. Use it to check what you read. |

A file that is missing was not in the filing. Say so under `cant`.

## What to write

The owner judges a management by two old tests. **How well do they run the business?** Compare what they have
done with what their competitors have done, consider the hand they were dealt, and look at how they have used
the company's cash. **How well do they treat their owners?** Read the proxy statement and compare how the
managers treat themselves with how they treat the shareholders. He also wants to know where the company stands
among its rivals, and what the rivals say about it.

```json
{
  "v": 1,
  "sym": "ABC", "cik": "0000000000", "name": "Abc Corporation",
  "read": "2026-11-24",
  "sources": [],
  "business": "Two or three plain sentences: what it sells, to whom, and how it is paid.",
  "sections": {
    "stands": [],
    "rivals": [],
    "namedBy": [],
    "worries": [],
    "run": [],
    "owners": [],
    "strengths": [],
    "warnings": []
  },
  "rivalSymbols": [],
  "cant": []
}
```

Each section is a list of points. A point is:

```json
{"t": "The finding, in one or two plain sentences.", "q": "A passage copied word for word from the filing.", "s": "k", "tone": ""}
```

- `s` is the `id` of the source the passage is in: `k` for the annual report, `p` for the proxy statement. For a
  passage from another company's report (`rivals.json`, `namedby.json`), add a source of your own to `sources`
  with an id such as `r1`: `{"id": "r1", "form": "10-K", "who": "Other Company Inc.", "filed": "2026-02-12", "url": "..."}`,
  using the address and date given in that file. Copy `sources` from `meta.json` first, then add yours.
- `tone` is `"good"` where the filing plainly shows something in the owners' favour, `"warn"` where it plainly
  shows something an owner should worry about, and `""` otherwise. Most points are `""`.

What belongs in each section:

| Section | What belongs there |
|---|---|
| `stands` | Its own account of where it stands: its size and reach, what it claims to be good at, what it says protects it, where it says it is growing or shrinking. |
| `rivals` | Who it names as competitors, and what it says about competing with them. Give the names. |
| `namedBy` | What other companies' reports say about it. Begin each point with the other company's name. A report that only lists it among competitors is worth one short point; a report that says how it competes is worth more. Leave out mentions that have nothing to do with competing. |
| `worries` | The three to five risks that matter most to this business, in plain words. Not the boilerplate every company prints. |
| `run` | Who runs it and since when. What they did with the cash: acquisitions and what was paid, write-downs of what they bought, buybacks, debt taken on. Targets they set and whether they met them. What they say their priorities for the cash are. |
| `owners` | The chief executive's total pay and the year. What the yearly bonus and the long-term awards depend on (name the measures). Pay set against results, from the pay-versus-performance table. What the directors and officers own. Dealings between the company and its insiders. The ratio of the chief executive's pay to the typical employee's. Anything unusual: guaranteed bonuses, repriced options, large perks. |
| `strengths` | At most four: what the filings plainly show in the owners' favour. |
| `warnings` | Whatever an owner should plainly know: a restatement, a change of auditor, a weakness in controls, a large deal with an insider, pay far out of line with results, a write-down of a big acquisition. Leave it empty when there is nothing. |

`rivalSymbols` holds the stock symbols of the rivals the company names, where they are companies with shares
listed in the United States and you are sure of the symbol. Prism sets the company beside these. Leave out
any you are not sure of.

`cant` says, in a sentence each, what these filings could not tell you. It is always something: whether the
culture is good, whether customers are leaving, what a rival really thinks.

## Rules

1. **Only what the filings say.** No outside knowledge of the company, no news, no memory of it. If it is not in
   the folder, it does not go in the brief.
2. **Every point carries a passage copied word for word.** Keep it short: forty words at most, and a single
   sentence where one will do. A program checks every passage against the filing afterwards, and a point whose
   passage is not found is thrown away. Copy from the text files exactly, including figures. Where you must skip
   words inside a passage, write ` ... ` between the two parts.
3. **Facts to weigh, not a verdict.** Do not say whether the management is good, whether the company is winning,
   or whether to buy, hold or sell. Do not grade or score anything. Most managements sit in a murky middle: the
   brief shows the evidence, the clear strengths and the clear warnings, and says what cannot be told.
4. **Plain English.** Short sentences, active voice, everyday words. Explain a term the first time ("the proxy
   statement, which companies send before the yearly meeting"). No jargon such as TSR, NEO or PSU without
   saying what it means.
5. **Three to six points a section.** Fewer is fine. An empty section is fine: say why under `cant`.
6. **Figures come from the filing.** Quote them. Do not work out new ones, beyond saying that one figure is
   larger than another.
7. **Nothing about the reader.** The brief is about the company. It names no investor and gives no advice.

Write the file as valid JSON, in UTF-8, to the path you are given, and nothing else.
