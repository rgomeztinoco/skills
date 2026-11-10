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

## Second-look summary

In the conversation, link the ticket and briefly cover:

- what it does;
- what it assumes, identifying choices the owner has not made;
- what it touches and leaves to other tickets;
- the risk and why it needs a second look.

Ask the owner to approve it, request changes, or resolve the open choices. If the issue changes after the summary, refresh it before requesting approval.
