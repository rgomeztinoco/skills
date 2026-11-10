# Project memory

Keep the project's direction, intent and decisions across sessions in one Markdown file. GitHub holds ticket details and current PR status; memory holds the context needed to interpret them and choose what comes next.

## Find it

Use the scope named by the owner or established in the conversation. Identify the current repo with `gh repo view --json nameWithOwner`, or its Git remote when GitHub is unavailable.

1. If the owner supplied a memory or board path, use it. For a board, read its `meta.json` for scope and use its `notes.md` as memory.
2. Otherwise look for an existing board in `~/.boards/`. A named epic slug can match its folder; otherwise read `~/.boards/*/meta.json` and match the current repo against `repos`. When an epic is already specified, also match its issue against `epics`. A matching board supplies its epic and repo scope and its `notes.md` is the memory file. If `impl-brief.md` exists, read it for owner rules and shared context too.
3. With no matching board, look for an existing `~/.chief-of-staff/*/memory.md` whose recorded scope matches. Otherwise use the current repo if no epic is specified, and create `~/.chief-of-staff/<scope-slug>/memory.md`. Derive the slug from the repo's owner and name, adding the epic issue number when scoped to an epic, for example `postedin-cms-epic-326`. For an epic spanning repos, reuse one memory file and record all its repos.

If several candidates match, ask the owner which scope they mean before updating any of them. An absent board directory is normal. Create only the memory file and its parent directory when needed; keep it outside repos and worktrees so it survives branch changes. Discovering a board reuses its context without requiring its server, cards or UI.

## What to keep

Record the scope, including repo names and epic links, and the date last updated. Keep these sections short:

- **Direction and intent.** The outcome the owner wants, current priorities, constraints, deliberate exclusions and why.
- **Decisions.** Still-relevant choices with their date, rationale and source. Distinguish owner decisions from agent proposals. Include ticket approval history needed to avoid asking again.
- **Where we are.** The current phase, next steps and links to running work or review threads that another session needs to resume.
- **Open questions.** Unresolved choices, what waits on the owner and decisions still to be propagated to GitHub.

Initialize memory from available project context. Leave unknown direction or intent as an open question. Preserve relevant context when adopting existing board notes, even if their headings differ.

## Maintain it

Read memory before surveying or planning. Check live ticket and PR status on GitHub; refresh stale progress in memory from that evidence. If a remembered decision conflicts with a newer explicit owner decision, record the newer decision and why it supersedes the old one. An issue edit alone does not overturn an owner decision.

Before ending each turn, including a survey-only pass, save new direction, decisions, approval history, open questions and the next step. Edit the current summary rather than append a session transcript. Keep the file roughly a screen or two; link to issues for implementation details and history. Preserve rationale for active decisions while pruning obsolete progress. The file should let a fresh session explain where the project is going, why, and what to do next.
