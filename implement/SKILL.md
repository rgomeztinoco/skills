---
name: implement
description: "Implement work from a specification or tickets through verification, review, and submission."
disable-model-invocation: false
---

First assign yourself to the issue.

Implement the work described by the user in the spec or tickets.

Use `/tdd` at agreed seams when a focused failing test can express the behavior.

After each coherent change, run the relevant test file and typecheck. Run the full test suite once at the end.

Show the changes, run the application and visually verify them, include screenshots or recordings in your response and in the pull request. Showing your work in a visual manner helps reviewers understand the impact of your changes and is really important.

When implementation and checks are complete, run `/code-review` and address its findings.

Stack the implementation using the repository's existing workflow, GitHub or Graphite. Document changes, relevant context, and concerns in its pull requests.

Close the issue if the implementation is complete and ready for review.

Publish as ready after implementation, checks, and review are complete. Otherwise, publish as draft for early feedback.
