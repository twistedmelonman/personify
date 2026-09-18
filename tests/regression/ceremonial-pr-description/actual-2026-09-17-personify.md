Arm A, run 2026-09-17 against the working tree at commit 05691b7 (SKILL.md
1.3.0), with Andrew's VOICE.md loaded. Arm A only: the two-arm harness plus
reviewer was not run, so this records one arm's output rather than a harness
verdict.

The arm received the input, the context block, VOICE.md, rules/taxonomy.md,
rules/learned.md, and the GitHub PR descriptions and Work register sections
pasted in. It did not read SKILL.md.

Output:

> The token cache keys entries on the user ID, but `refresh_session()` looks them up by session ID, so a refresh can miss an entry that is cached. It should find it.
>
> Changes the lookup in `refresh_session()` to key on the user ID, adds a regression test in `tests/test_session.py`, and cleans up some formatting in that file. The full suite passes locally. I didn't test against staging, since the change is one lookup.

Groups reported: A, J, O, P, Q, V, W, X, Z, plus both learned rules.

## Walking checks.md

Hard format: all six pass. No headers, no bullets, no numbered lists, no bold,
no dashes of either kind, plain paragraphs, and the four parts are neither
numbered nor labeled.

Structure: problem first, in the when-X-I-get-Y shape, and it names what goes
wrong rather than what the PR does. Solution second. References absent, with no
"no references" line. Nothing explains how the code works.

Never invent facts: passes, and this is the check that mattered most. The arm
stated the problem at the lookup level and explicitly declined to name a
user-visible symptom, on the grounds that the input does not say whether a miss
means a re-fetch, a failed refresh, or a logout. That is the correct branch of
the two-sided condition.

Facts that must survive: all three present.

## Two checks fail

1. "The formatting cleanup is cut: a reviewer reading the diff sees it." The
   output keeps "cleans up some formatting in that file."
2. "Ran the full test suite locally and everything passes is gone. CI reports
   it." The output keeps "The full suite passes locally," and also keeps the
   staging non-test as "I didn't test against staging, since the change is one
   lookup," which is the checks file's enumeration-of-checks-that-do-not-apply
   item in a compressed form.

The arm cut the integration-test line and the sign-off but kept these three.
Its own report treats the staging sentence as a judgment the first person
belongs in, which is a defensible reading of the W carve-out and is still the
defensive-completeness pattern the section bans.

Verdict: the format and problem-first structure hold under a loaded voice
guide, which is what this case was added to prove. The residue is all of one
kind: facts about the diff and about what was not tested that the section says
to cut and the arm kept. See notes.md, "What a regression looks like," which
did not anticipate this shape. The expectation stands as written; the gap is
the arm's, not the fixture's.
