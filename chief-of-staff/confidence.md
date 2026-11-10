# Confidence

A ticket's confidence answers one question: does the owner need a second look before an agent builds it? A spec can read as fully reviewed when nobody approved it, and only the owner knows which choices they made. So ask first, then score.

## Ask the owner

At intake, use any approval history already established in project memory, the conversation or GitHub. If it is missing, ask once for the whole scope which tickets or batches the owner wrote or approved, and which came out of a grilling session. Record the answer in project memory for later passes.

## Score

| Signal | High | Low |
|---|---|---|
| Origin | Owner wrote or approved it, or a grilling session produced it | An agent wrote it from a plan without the owner checking it |
| Assumptions | Only binding decisions and facts from the code | Choices the owner never made: defaults, value sets, layouts |
| Complexity | One seam, additive, easy to revert | Shared schema, migrations, live sites, several repos |

- **High**: ready once the ready check passes.
- **Low** on origin, or on two signals: summarize it in the conversation for a second look, and build only after the owner approves it.
- Tickets born from a grilling session start high: they need no second look.
