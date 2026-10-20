# Handoffs

Grilling and implementation always run outside this session.

## Grilling

Each grilling ticket gets its own session. In T3 Code, launch it with `t3_thread_launch` in the ticket's repo; elsewhere, give the owner a prompt to copy. The prompt is one line, because the ticket carries the context:

```
Grill <owner/repo>#<n> using the grilling skill.
```

Afterwards, read the outcome from GitHub (the ticket's body and comments, and any new tickets it spawned) and propagate it.

## Implementation

One ticket at a time, each in a fresh sub-agent: never two implementations in parallel, never in this session. Dispatch the next only after the previous one reports.

The sub-agent runs `/implement` on the ticket. That skill is user-invoked, so tell the sub-agent: if the Skill tool refuses it, read `~/.claude/skills/implement/SKILL.md` and follow it step by step, likewise for the skills it calls.

Brief the sub-agent with:
- the issue and its repo;
- where to work (a worktree, never a checkout another session uses);
- the base branch: the previous ticket's branch when this ticket depends on it, else the trunk;
- the epic's owner rules that the issue does not repeat;
- what to report: PR URL, branch, what changed, checks run, review findings, owner questions.

Keep a reusable brief per epic in the board folder (`impl-brief.md`) and point each sub-agent at it.

When the report arrives, check the PR exists and its checks run, relay owner questions, and update the board.
