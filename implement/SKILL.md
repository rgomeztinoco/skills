---
name: implement
description: "Implement work from a specification or tickets through verification, review, and ready pull requests."
disable-model-invocation: false
---

First assign yourself to the issue.

Implement the work described by the user in the spec or tickets.

Use `/tdd` at agreed seams when a focused failing test can express the behavior.

After each coherent change, run the relevant test file and typecheck. Run the full test suite once at the end.

Show the changes, run the application and visually verify them, include screenshots or recordings in your response and in the pull request. Showing your work in a visual manner helps reviewers understand the impact of your changes and is really important.

When implementation and checks are complete, run `/code-review` and address its findings.

## Stack

Open the pull requests with the repository's stack tool, one dependent concern per layer:

- **Graphite** when the repo is initialized for it (`.git/.graphite_repo_config` exists): use `gt`.
- **GitHub** otherwise: use `gh stack` per the `gh-stack` skill (`gh stack init <branch>`, `gh stack add <branch>`, `gh stack submit --auto`). Load that skill before the first `gh stack` command. Chain layers only through `gh stack`, never with `gh pr create --base`.

Document changes, relevant context, visual evidence and concerns in each pull request.
Show the work in a visual manner, with screenshots or recordings, to help reviewers understand the impact of your changes.

## Ready

Publish as ready, not draft, once implementation, checks and code review are complete. Then drive every pull request in the stack to ready per the `pr-ready` skill: CI green and every review comment addressed, including comments from the repo's review bots.

The work is done only when every pull request is ready. Then close the issue.

When an owner decision blocks the work, publish as draft, report the question and the pull requests it blocks, and stop.
