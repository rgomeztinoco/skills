# Handoffs

Grilling, implementation and review always run outside this session.

## Grilling

Each direction handoff or named ticket gets its own session. In T3 Code, launch it with `t3_thread_launch` in the repo; elsewhere, give the owner a prompt to copy.

### Direction planning without tickets

When the owner selects `grill direction`, prepare a self-contained prompt. No existing ticket or epic is required. Include the repo, the owner's desired outcome, relevant verified project facts, binding decisions and their sources, constraints, exclusions and open questions. Include the memory path, but carry the needed context in the prompt itself.

Tell the receiving session to use the grilling skill to agree on the general direction with the owner, then create the initial main GitHub tickets per [`ticket-formats.md`](ticket-formats.md). These describe outcomes, scope and dependencies, leaving implementation details for each ticket's individual grilling. Make the dependency order explicit and mark every main ticket `needs-grilling`. Treat the resulting plan as provisional and identify remaining uncertainties.

The session returns ticket links, dependency order, binding decisions with rationale, and open questions. Record the agreed direction and current plan in memory, read the created issues from GitHub, and resume the normal survey. While planning is running, keep its session link or copyable handoff and pending outcome in memory so another pass can resume it.

### Individual tickets

For an existing ticket, the issue carries the context, so the prompt can be short:

```
Grill <owner/repo>#<n> using the grilling skill.
```

Include the current goal, relevant owner decisions and plan changes from memory when the issue does not already carry them. For a main ticket, tell the session to resolve its design choices, scope, acceptance criteria and dependencies, then update the issue with the agreed details. Remove `needs-grilling` only when its open design choices are resolved. Shared decisions that block multiple tickets can have separate grilling tickets.

Afterwards, read the outcome from GitHub (the ticket's body and comments, and any new tickets it spawned) and propagate it using the skill's Evolving the plan rules.

## Implementation

One ticket at a time, each in a fresh sub-agent: never two implementations in parallel, never in this session. Dispatch the next only after the previous one reports, and only from the batch the owner named.

The sub-agent runs `/implement` on the ticket. That skill is user-invoked, so tell the sub-agent: if the Skill tool refuses it, read `~/.claude/skills/implement/SKILL.md` and follow it step by step, likewise for the skills it calls.

Brief the sub-agent with:

- the issue and its repo;
- where to work (a worktree, never a checkout another session uses);
- the base branch: the previous ticket's branch when this ticket depends on it, else the trunk;
- the epic's owner rules that the issue does not repeat;
- what to report: PR URL, branch, what changed, checks run, review findings, owner questions.

Include the relevant direction, decisions and shared epic context from project memory in each sub-agent's brief.

When the report arrives, check the PR exists and its checks run, relay owner questions, and report the ticket's stage in the conversation.

## Review

One review per feature, covering all its PRs at once; the owner still reviews PR by PR on Graphite. In T3 Code, launch a thread with `t3_thread_launch` in the feature's repo, in its own worktree on the tip branch; elsewhere, give the owner the prompt to copy. Keep the prompt short:

```
Review <owner/repo> PRs <#25–#30> as one change: a single review at the tip (<tip branch>). Give me a short summary of everything and a game plan to get it merged. When the plan needs a non-obvious action from me (a database change, a secret, a setting), add brief instructions for it. Keep it short and simple; I'll ask for details if needed. Keep the review in this thread for now; post nothing to GitHub this turn.
```

Fixes happen in that thread. Record its link in project memory and include it in the report; the feature stays in review until its PRs merge.
