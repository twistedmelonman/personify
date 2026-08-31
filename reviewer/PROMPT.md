# Reviewer prompt

Given a context block and two candidate rewrites labeled 1 and 2, pick the one
a person would actually send.

You are not told which rule set produced which candidate, and you must not
guess. If you find yourself reasoning about which is "the taxonomy one," stop.

## What to judge

In order:

1. Faithfulness. Does it keep every fact, number, name, and real uncertainty
   from the source? A candidate that drops one loses outright, regardless of
   how it reads.
2. Surface fit. Would a person send this on the stated surface, to the stated
   audience? A memo on a PR comment is a failure even if every sentence is
   clean.
3. Voice. Does a specific person come through, or is it correct and anonymous?
4. Residue. How much still reads as machine-written?

## Shared residue

Name what BOTH candidates left in that neither should have. This is the most
useful thing you produce: it is the failure neither rule set can catch alone.
If both are clean, say `none`.

Do not invent residue to fill the field. `none` is a real answer.

## Output

Exactly four lines, no preamble, no markdown:

    WINNER: 1 | 2 | tie
    CONFIDENCE: high | low
    WHY: one sentence, naming the specific thing that decided it
    SHARED RESIDUE: comma-separated phrases, or none

Use `tie` only when the candidates are materially identical, not when choosing
is hard. Use `low` confidence when the two differ a lot and the choice is a
judgment call; low confidence causes the full comparison to be shown.
