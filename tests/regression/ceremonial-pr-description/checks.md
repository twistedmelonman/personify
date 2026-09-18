# Checks: ceremonial PR description

Exercises the PR description structure, which is a universal rule rather than a
pattern group. Run this case with a voice guide loaded as well as without: the
format checks below must pass identically both times, because a `VOICE.md` does
not override this surface.

## Hard format: any single failure fails the case

- [ ] No headers. Not `##`, not `#`, not a bolded line standing in for one.
- [ ] No bullets and no numbered lists.
- [ ] No bold anywhere, including "**Label:** content" lead-ins.
- [ ] No em dashes and no en dashes.
- [ ] Output is plain paragraphs, and a code block only if it holds verbatim
      output.
- [ ] The four parts are not numbered or labeled in the output. "1. Problem:"
      or "Solution:" is a fail even though the order is right.

## Structure

- [ ] The first paragraph is the problem, in the when-X-I-get-Y shape. It names
      what goes wrong, not what the PR does.
- [ ] The solution comes after the problem, not first.
- [ ] The solution is a brief sum-up, not a restatement of the diff. The
      formatting cleanup is cut: a reviewer reading the diff sees it.
- [ ] References (part 4) is absent, because nothing external was consulted.
      An explicit "no references" line is a fail.
- [ ] Nothing says how the code works. "Keys the lookup on the user ID" is the
      change; a walkthrough of `refresh_session()` is not.

## Never invent facts (`rules/hard.md` rule 3)

- [ ] The problem statement claims only what the input carries: the lookup
      misses a present cache entry. No claim about logouts, early expiry,
      latency numbers, or affected users.
- [ ] If the run judged the problem statement underspecified, it asked or said
      so rather than filling it in. Asking is a pass.

## Facts that must survive

- [ ] The cache keys on user ID; the refresh looked up by session ID.
- [ ] The fix changes the lookup to the user ID.
- [ ] A regression test was added, in `tests/test_session.py`.

## What must be cut

- [ ] "It should be noted that" is gone.
- [ ] "somewhat subtle" is gone.
- [ ] The inflated-stakes sentence ("critical reliability issue," "undermines
      the integrity," "important step toward hardening") is gone entirely, not
      softened. A shorter version of it is a fail.
- [ ] The enumeration of checks that do not apply (no integration tests, no
      staging run) is gone.
- [ ] "Let me know if you'd like me to run anything else" is gone.
- [ ] "Ran the full test suite locally and everything passes" is gone. CI
      reports it.

## Anti-over-correction

- [ ] Not parataxis (group X). Clauses connect where there is a causal link.
- [ ] The result is not curt to the point of hostility. Blunt is the target.
- [ ] `refresh_session()` and `tests/test_session.py` are written exactly as
      they are, backticks included.

## Voice-guide precedence

- [ ] Run with Andrew's `VOICE.md` loaded. The output still has no bold
      lead-ins, no headers, and no dashes. A run that restores any of them on
      the strength of the voice guide is the regression this case exists for.
