---
description: Read accumulated personify evidence and propose rule changes as a PR.
disable-model-invocation: true
---

# Consolidate personify evidence

Read every record in `~/.claude/personify-evidence/`, then propose rule changes.
Every record, not only the ones newer than `.consolidated`: that marker counts
what is waiting, and a dead rule is one that has never fired in any run.
Propose only. Never edit a rules file directly, and never commit to main.

## Refuse to run on thin evidence

Count the records. Below 5, stop and say how many there are. One sample is an
anecdote, and a rule inferred from too few records is how these skills became
miscalibrated in two directions at once.

## What to look for

**Dead rules.** Every lettered group in `rules/taxonomy.md` that appears in no
record's `arm_a_groups`. Report each with its zero count. This is the only
signal that makes the taxonomy smaller.

**Wrong rules.** Records where `arm_a_groups` contains a group, and
`reviewer_winner` is `b`, and the reviewer's `WHY:` line names what that group
did to the text. Report the group and the count.

"Names what the group did" means the WHY line describes the edit, not the
group's letter. The reviewer never sees group letters, so a WHY line saying
"kept a section header in a 3-sentence comment" is what an over-applied group U
looks like from the outside. Match on the described effect. When you cannot
tell which group a WHY line refers to, leave it out rather than guessing: a
wrongly attributed group is worse than an uncounted one.

**Shared residue.** Every `shared_residue` entry, grouped by similarity, with
counts. Two entries are the same when they name the same tell, not when they
share wording: "opens with I think" and "leads with I think" are one entry.
An entry seen once is noise. An entry is a candidate rule for
`rules/learned.md` when it appears at least 5 times AND on at least two
different surfaces AND in under half the records read.

A consequence worth expecting: no learned rule can appear until roughly 11
records exist, since 5 hits must also be under half the records read. The first
consolidation runs correctly produce dead-rule and win-rate output and no
learned rules at all. That is the thresholds working, not a fault.

The three conditions together are what make it a rule rather than an artifact
of one run. Five hits out of five records is not evidence of a general tell,
it is one afternoon; the "under half" condition rejects it and keeps rejecting
it until the corpus is large enough for five hits to mean something. Two
surfaces stops a habit specific to PR comments becoming a rule applied to
email. An empty `shared_residue` list contributes nothing and is not an
entry.

**Arm win rate by surface.** Count `reviewer_winner` per `surface`. The table
has three columns, `a`, `b`, and `tie`, because `tie` is a value the reviewer
can return and dropping it overstates whichever arm is ahead. Report ties as
their own column, never folded into either arm and never omitted.

This table is what eventually answers whether the taxonomy earns its place, so
an overstated margin here is the most expensive error in this command. It
compares `rules/taxonomy.md` against `rules/hard.md`, nothing else.

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
