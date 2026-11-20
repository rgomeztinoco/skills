---
name: review-pr
description: "Review a pull request or a whole stack as one change at its tip: code review, the running app shown in screenshots and recordings, CI and comment status, and a game plan to merge. Use when asked to review a PR, a stack or a feature before merge."
---

# Review PR

Review one pull request, or every pull request of a stack, as a single change at the tip. The owner still reads the pull requests one by one; this review gives them the whole picture, shows it working, and lays out the path to merge.

## Setup

Collect the pull requests. Given one layer of a stack, find the rest: `gh stack view --json`, `gt log` on Graphite, or follow the base branches. Check out the tip branch in its own worktree. Done when you hold every pull request bottom to top with its link, title, base and head.

## Review

1. **Code.** Run `/code-review` on the tip against its merge-base with trunk, using the linked issues as the spec.
2. **Visual.** Start the app at the tip with the project's dev command, seed the data the change needs, and exercise every user-facing change. Take a screenshot of each changed screen or state, and a recording of each flow, interaction or animation; use the harness's browser preview and recording tools when it has them, otherwise Playwright. Where the change alters existing UI, capture trunk too, as before and after. For a change with no UI, show its observable effect: an API response, CLI output, a log line. Done when every user-facing change in the stack has visual evidence, or a stated reason why it can't be shown.
3. **Status.** Check each pull request against the ready definition in the `pr-ready` skill: checks, review bots, unaddressed comments, conflicts, draft state. Done when every pull request has a status.

## Report

Keep it short; the owner asks for details.

- **Summary**: what the stack does as a whole.
- **Visuals**: the screenshots inline, as Markdown images with absolute paths, and links to the recordings.
- **Pull requests**: one row each with link and title, checks, open comments, and state.
- **Findings**: ranked, each naming the pull request it belongs to.
- **Game plan to merge**: ordered steps. When a step needs a non-obvious owner action (a database change, a secret, a setting), add brief instructions for it.

Keep the review in this conversation; post to GitHub only when the owner asks. Make fixes here when the owner asks for them, each in the layer that owns the code, then run `pr-ready` on the stack.
