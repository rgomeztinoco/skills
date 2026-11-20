---
name: pr-ready
description: "Drive open pull requests to ready: CI green and every review comment addressed, waiting for the repo's review bots. Use after opening or pushing to PRs, before reporting PR work as done, or when asked to get PRs green or address review comments."
---

# PR ready

A pull request is **ready** when, on its current head commit:

- every check has finished and none failed;
- every review bot the repo uses has finished reviewing;
- every review thread, review body and conversation comment is addressed: fixed and its thread resolved, or answered with the reason it was declined;
- it is not a draft and merges cleanly into its base, which is the layer below it in the stack, or trunk.

A stack is ready when every layer is.

## Find the review bots

Look for the bots the repo expects: config files such as `.coderabbit.yaml`, `.greptile/`, `bugbot` or `.github/copilot-*`, and bot authors among the reviews and comments on the last few merged pull requests. No bot found means nothing to wait for. Done when you can name each bot or confirm there are none.

## Loop

1. **Wait** for checks and bot reviews on the head commit. Use the harness's pull request watch tool when it has one; otherwise `gh pr checks <pr> --watch`, then check the reviews.
2. **Fix failed checks.** Read the logs (`gh run view <run> --log-failed`), reproduce locally, fix in the layer that owns the cause. Rerun a failure that looks flaky once; a second failure is real. A failure also present on trunk goes to the owner.
3. **Address comments.** Read every unresolved thread and comment:

   ```bash
   gh api graphql -F owner=<owner> -F repo=<repo> -F n=<number> -f query='
     query($owner:String!,$repo:String!,$n:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$n){
       reviewThreads(first:100){nodes{id isResolved isOutdated path line
         comments(first:20){nodes{author{login} body url}}}}}}}'
   gh pr view <pr> --json reviews,comments
   ```

   Fix valid points in the layer that owns the code, then resolve the thread (`resolveReviewThread` mutation with its `id`). Reply with the reason to points you decline. Leave comments that need an owner decision open and report them.
4. **Push and restack**, then return to step 1: a new head commit restarts checks and bots.

Done when every pull request is ready, or only owner decisions remain. Report each pull request with its state, and each open owner decision with the pull requests it blocks.
