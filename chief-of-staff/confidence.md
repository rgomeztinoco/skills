# Confidence

A ticket's confidence answers one question: does the owner need a second look before an agent builds it? A spec can read as fully reviewed when nobody approved it, and only the owner knows which choices they made. So ask first, then score.

## Ask the owner

At intake, ask once for the whole epic: which tickets, or which batches, did you write or approve yourself, and which came out of a grilling session? Record the answer in `notes.md`.

## Score

| Signal | High | Low |
|---|---|---|
| Origin | Owner wrote or approved it, or a grilling session produced it | An agent wrote it from a plan without the owner checking it |
| Assumptions | Only binding decisions and facts from the code | Choices the owner never made: defaults, value sets, layouts |
| Complexity | One seam, additive, easy to revert | Shared schema, migrations, live sites, several repos |

- **High**: ready once the ready check passes. No card.
- **Low** on origin, or on two signals: card on the board, built only after the owner's ✓.
- Tickets born from a grilling session start high: they need no second look.
