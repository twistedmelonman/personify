A 1.x capture, kept as a dated record. The arms, the reviewer and the rules files it cites were removed in 2.0.

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

## Second run, same day, after the section fix

Re-ran arm A on the same input with the same context and voice guide, against
the strengthened PR descriptions section (commit 38e7187).

Output:

> When a session token is refreshed, the refresh can miss a cached entry that is actually present, because the token cache keys entries on the user ID while `refresh_session()` looks them up by session ID. It should find the cached entry.
>
> Changes the lookup in `refresh_session()` to key on the user ID, with a regression test in `tests/test_session.py`.

Groups reported: A, B, J, O, P, Q, V, W, X, Z, plus both learned rules.

All four previously failing items now cut, each for the stated reason:

- "Ran the full test suite locally and everything passes": cut, CI reports it.
- "No integration tests apply to this path": cut, a check not run.
- "I did not test against staging": cut, names an absence rather than a risk.
  The arm applied the caveat exception correctly, noting that "since the change
  is confined to a single lookup" does not convert an absence into an
  actionable caveat.
- "Minor formatting cleanup in the same file": cut, cosmetic diff part.

Every check in checks.md passes on this run. The problem statement again stays
at the lookup level and invents no user-visible symptom. Two paragraphs, no
part 2 and no part 4, which is correct: the input carries no error output to
quote and nothing external was consulted.

The one substantive difference from the first run is that the problem statement
now leads with the user-facing action ("when a session token is refreshed")
rather than with the cache's keying, which is closer to the when-X-I-get-Y
shape the section asks for.

## Arm B, same day, same input

Run against commit c00125c with the surface sections stripped of group letters
by hand, as step 2 requires. Arm B received rules/hard.md, rules/learned.md,
VOICE.md, and the stripped PR descriptions and Work register sections. It did
not read rules/taxonomy.md or SKILL.md.

Output:

> When `refresh_session()` refreshes a token, it looks up the cache by session ID, but the cache is keyed on the user ID, so a refresh misses an entry that is present. It should find it.
>
> Changes that lookup to key on the user ID, with a regression test in `tests/test_session.py`.

Every check in checks.md passes. All four cut items cut, all three surviving
facts present, no invented symptom, no dashes introduced.

Reported in plain description with no letters, which confirms the stripping
worked: nothing in arm B's report names a lettered group, and the isolation
held.

## Comparing the two arms on this surface

The two outputs are close enough that this case does not discriminate between
them. Both produce two paragraphs, problem first, no part 2 and no part 4, and
both cut the same four items for the same reasons. Arm A leads with the
user-facing action ("when a session token is refreshed") and arm B leads with
the function ("when `refresh_session()` refreshes a token"), which is a real
difference in who the description addresses but not a difference either rule
set can claim as a win.

Both arms independently named the same gap in the input: the downstream
consequence of a cache miss is absent, and only the author can supply it.
Neither invented it. That agreement is the most useful signal here, since the
invented-symptom failure was the one this case was built to catch and neither
rule set produced it.

Worth noting for a future consolidation: the shared residue on this surface is
nothing. The reviewer was not run, so there is no verdict to record, and this
is arm output plus a hand walk of checks.md rather than a harness result.
