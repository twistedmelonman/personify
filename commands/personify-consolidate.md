---
description: Read accumulated personify evidence and propose rule changes as a PR.
disable-model-invocation: true
---

# Consolidate personify evidence

Read every record in `~/.claude/personify-evidence/`, then propose rule changes.
Propose only. Never edit a rules file directly, and never commit to main.

## Refuse to run on thin evidence

Count the records. Below 5, stop and say how many there are. One sample is an
anecdote, and a rule inferred from too few records is how these skills became
miscalibrated in two directions at once.

## What to look for

**Dead rules.** Every lettered group in `rules/taxonomy.md` that appears in no
record's `arm_a_groups`. Report each with its zero count. This is the only
signal that makes the taxonomy smaller.

**Wrong rules.** Records where `arm_a_groups` contains a group and
`reviewer_winner` is `b` and the reviewer's `WHY:` names that group's effect.
Report the group and the count.

**Shared residue.** Every `shared_residue` entry, grouped by similarity, with
counts. An entry seen once is noise. An entry seen 5 or more times across
different surfaces is a candidate rule for `rules/learned.md`.

**Arm win rate by surface.** Count `reviewer_winner` per `surface`. Report as a
table. This is what eventually answers whether dumbify can be dropped.

Weight records with `audience_assumed: true` lower when they are the only
support for a proposal, and say so in the proposal.

## Output

Open a PR against this repo containing:

- proposed edits to `rules/taxonomy.md` for dead and wrong rules
- proposed additions to `rules/learned.md` for repeated shared residue. Each is
  a `###` entry under that file's `## Rules` heading, carrying its `Evidence:`
  line. `tests/test_rules_files.py` enforces both, so an entry at the wrong
  heading level or with no count fails the suite
- the win-rate table in the PR body, changing no file

Every proposal states its count. A proposal with no count is not a proposal.

Approve, reject, or edit each one by hand. Nothing here applies itself.

## After the PR is opened

Write the current timestamp to `~/.claude/personify-evidence/.consolidated`, so
the records just read stop counting toward the next nudge.

Do this whether or not the PR is merged. The records were read, and that is
what the marker means.
