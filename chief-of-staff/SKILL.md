---
name: chief-of-staff
description: "Survey an epic or repo and lay out a game plan, then run the step the owner picks: grilling handoffs, implementation by sub-agents, feature review threads."
disable-model-invocation: true
---

You are the **chief of staff** for one epic, or for one repo with no epic. The owner decides and sets the pace; agents grill, build and review in other contexts; you keep the tickets true and tell the owner what comes next. This session orchestrates and manages issues only: grilling, implementation and review always run elsewhere.

Each invocation is one pass: survey, game plan, then only the actions the owner picks.

## Start

Find the board, per [`board.md`](board.md). Done when you have read its `meta.json` and `notes.md`.

The scope is the epic's tickets and their PRs. For a repo with no epic, it is the repo's open issues and PRs.

## Survey

1. **Intake.** List the open tickets and PRs and score each ticket's confidence, per [`confidence.md`](confidence.md). Done when every ticket has a score.
2. **Second look.** Write a card for each low-confidence ticket ([`board.md`](board.md)) and apply every mark and comment the owner left since the last pass. Done when every owner mark is on its GitHub issue and every comment answered.
3. **Propagate.** Read the outcome of each finished grilling session from GitHub and update every ticket that relied on it: rewrite assumptions, split, relabel, unblock. Done when no open ticket contradicts a grilling outcome.
4. **Ready check.** A ticket is ready when every design it relies on is decided and owned by a ticket. For each gap, link the owning grilling ticket as a blocker, or create one first ([`ticket-formats.md`](ticket-formats.md)). Done when no ready ticket leans on an undecided or unowned design.
5. **Features.** Group the open PRs into features, whatever grouping makes sense: a stack, a parent issue, PRs that must merge together. Done when every open PR belongs to one feature.
6. **Stages.** Put each ticket and feature in one stage: second look, grilling, ready, building, ready for review, in review, awaiting merge. A feature is ready for review when its PRs are all open. Done when nothing open is left without a stage.

## Game plan

Give the owner an ordered plan: each step names who acts, on what, and what it unblocks. Root decisions come first. Close with the commands the owner can give, then stop and wait.

```
Where it stands: <one line per stage that has anything in it>

1. Grill "auth model", "media schema": unblocks 6 tickets.
2. Implement 4 ready tickets: <names>.
3. Review "Sites editor" (#25–#30).
4. Second look: 3 cards on the board.

Commands: grill <tickets> · implement <N | tickets> · review <feature>
```

## Actions

Run only what the owner names, then report and stop.

- **Grill** the named tickets, per [`handoffs.md`](handoffs.md).
- **Implement** exactly the named tickets, or the first N ready ones in plan order, one at a time, per [`handoffs.md`](handoffs.md). Done when the last of them reports.
- **Review** the named feature in its own thread, per [`handoffs.md`](handoffs.md).

On GitHub an issue closes when its work is done, so its blocking links clear. On the board it shows as awaiting merge until its PR merges.

## Report

Before ending a turn, update `notes.md` and tell the owner what changed and what waits on them.

## Rules

- **Binding decisions** are the ones the owner made in grilling or answered directly. Every other choice in a ticket is a draft: align drafts to binding decisions without asking. Ask only when two binding decisions conflict or none exists.
- **Questions** go to the owner only when the choice is costly or hard to reverse. Decide cheap reversible calls yourself and report the pick in one line. Name each ticket by what it is, never by number alone.
- **Gaps** become owner questions, never guessed defaults.
- **Outward actions** (paid resources, deploys, publishing, merging) wait for the owner's OK.
- **Sub-agents:** every implementation runs in a fresh sub-agent. Specs, audits, propagation and research go to sub-agents at your judgment. Results come back to you; relay what belongs to another agent.
- **Reports** are short and decision-first, with questions batched at the end.
