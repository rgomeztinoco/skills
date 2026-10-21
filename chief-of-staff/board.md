# Board

One board per epic, or per repo with no epic, at `~/.boards/<slug>/`. It belongs to the owner: outside every repo, never committed, never in a temp dir. An epic can span several repos, and several chiefs of staff can run different epics at once, so the board is found by its `meta.json`, not by the folder you start in.

## Find it

1. If the owner named the epic (`/chief-of-staff postedin-3.0`), use `~/.boards/<that slug>/`.
2. Otherwise read every `~/.boards/*/meta.json` and keep the boards whose `repos` include the current repo (`gh repo view --json nameWithOwner`).
   - One match: use it.
   - Several: ask the owner which epic, listing each board's `name`.
   - None: ask for the epic issue(s), or confirm the repo alone is the scope, and create a board.

## Layout

```
~/.boards/<slug>/
  meta.json        name, slug, port, epics, repos
  notes.md         where the epic stands; read first, rewrite before ending a turn
  impl-brief.md    the epic's implementation brief for sub-agents
  drafts/          ticket drafts and issue-body backups taken before edits
  data/
    issues.json    cache of the epics' sub-issues, rebuilt by refresh
    cards/<id>.json  the glance card per ticket
    state.json     owner marks and comment threads
    events.jsonl   append-only log of owner actions
    plan.json      optional: phases, sizes, tracks
    map-notes.json optional: per-ticket notes for the map view
```

`meta.json` (example: [`board/example-meta.json`](board/example-meta.json)):

```json
{"name": "Postedin 3.0", "slug": "postedin-3.0", "port": 8765,
 "epics": ["postedin/cms#326", "postedin/cms-sites#65"],
 "repos": {"postedin/cms": "C", "postedin/cms-sites": "S"}}
```

`repos` maps each repo to the one-letter prefix of its card ids (`C407`). Give each board its own `port`. A repo with no epic has `"epics": []` and keeps its cards in `notes.md`.

## Run it

The server ships with this skill: `python3 <skill-dir>/board/server.py ~/.boards/<slug>`, detached (`nohup setsid … &`), then open `http://localhost:<port>`. Nothing keeps it alive across reboots: when the page is down, start it again. `POST /api/refresh` rebuilds `issues.json` from GitHub.

## Use it

- **Read** `events.jsonl` past the last line you handled for new marks and comments.
- **Reply** to a comment by adding an `orchestrator` comment to that card's thread in `state.json`.
- **Cards** are about six lines: what it does, what it assumes (⚠ on risky assumptions), what it touches, what it skips, the risk. Write one per ticket that needs a second look. A card goes stale when its issue changes after the card's `issueUpdatedAt`: rewrite it.
- **Small epic** (about ten tickets or fewer): skip the server and keep the cards as a list in `notes.md`.

## notes.md

The handoff to the next session: the game plan, what is running (agent, ticket, branch), each feature's PRs and review thread, what waits on the owner, and decisions not yet written to GitHub. Keep it under a screen; GitHub holds the history.
