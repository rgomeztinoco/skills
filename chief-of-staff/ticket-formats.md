# Ticket formats

## Grilling ticket

Labelled `needs-grilling`, a sub-issue of the epic, and linked as a blocker of every ticket that waits on it. Draft it in a sub-agent that verifies each claim against the code and the issues.

```
## Problem to resolve
What is undecided, why it matters now, and which tickets already build on a guess.

## Decided (owner)
Only binding decisions, each with where and when the owner made it.

## What we know
Facts from the code, the design and the plan, under bold sub-headings. Name real fields and files.

## Open questions
Numbered. Each one offers concrete options.

## What it unblocks
- <repo>#<n>: one line on what it waits for.
```

## Glance card

`data/cards/<id>.json` on the board:

```json
{"id": "C328", "issueUpdatedAt": "<the issue's updatedAt>",
 "does": "one line",
 "assumes": [{"text": "one line", "flag": true}],
 "touches": ["area"],
 "skips": "what it leaves to other tickets",
 "risk": "low | medium | high", "riskWhy": "one line"}
```

`flag: true` marks an assumption the owner never decided.
