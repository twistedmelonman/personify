# Notes

Exercises: the GitHub PR descriptions section (primary), V, and the
voice-guide precedence carve-out added in 1.3.0.

## Why this case exists

The PR description rules are the first universal rules in this skill that a
`VOICE.md` cannot override. Every other rule yields to the voice guide, so the
natural failure is a future edit quietly restoring the general precedence and
letting a voice guide put headers and bold lead-ins back. The last check in
checks.md is the one that catches it, and it only catches it if the case is run
with a real voice guide loaded.

The second thing this pins down is the four-part order surviving contact with
compression. An easy wrong answer is a correctly terse description that leads
with what the PR does, because that is what the input leads with and what
almost every real PR description does. Problem first is the rule, and it is the
part a compression pass has no reason to produce on its own.

## The invented-problem trap

The input describes a mechanism (wrong key in a lookup) and never says what a
user or an operator sees. A model writing "when I do X, I get Y" wants a
symptom, and the symptom is not in the source. This is the exact shape of the
Work register warning that compression pulls toward concrete mechanism the
source did not have.

The pass condition is deliberately two-sided: state the problem at the level
the input supports, or ask. Both are correct. Inventing a plausible symptom is
the failure, and it will read as the best output of the three, which is why it
needs an explicit check rather than a reviewer's judgment.

## What the first run actually got wrong

Recorded in `actual-2026-09-17-personify.md`. Arm A passed every format and
structure check on the first run, including under a loaded voice guide, and
failed two cut checks in the same way: it kept "the full suite passes locally,"
kept "I didn't test against staging," and kept the formatting cleanup.

Worth knowing because it is not the failure this case was built to catch. The
ceremony went, the problem statement came out right, and what survived was a
set of statements that look like facts a reviewer wants. A passing suite, a
check not run, and a cosmetic part of the diff all read as reportable, and none
of them are. The section now names those three explicitly rather than leaving
them to "no inflated stakes" and the worked example, which the arm read as
covering headers and sign-offs only.

The staging sentence is the interesting one. The arm kept it in the first
person on the grounds that a judgment takes an "I," which is a fair reading of
the W carve-out. Both things are true: it is a judgment, and it is an absence
nobody asked about. The rule that resolves it is that a caveat survives when a
reader acts on it and goes when it only reports that something was not done.

## What a regression looks like

- A header or a bullet list comes back, with or without a voice guide.
- The output leads with the fix and mentions the bug second, or not at all.
- "References: none" or "Testing: n/a" appears, because the parts got treated
  as a template to fill rather than an order to follow.
- The problem statement gains a symptom the input never carried.
- The inflated-stakes sentence survives in compressed form ("important
  reliability fix") instead of being cut.

## Source

Written from the specification Andrew gave on 2026-09-17, not from flagged
writing. The input is a synthetic PR description built to carry every ceremony
the section bans at once: two kinds of header, three bullet lists, a bold
lead-in label, an inflated-stakes paragraph, a testing rundown of checks that
do not apply, and a chatbot sign-off.
