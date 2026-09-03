---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

If the changes include frontend code, check visually, not just with tests.

Once done, use /code-review to review the work.

When done, create a gh or graphite stack depending on the context and submit it for review. The stack should include a description of the work done, any relevant context, any questions or concerns you have, and it should close the associated issue or issues.
