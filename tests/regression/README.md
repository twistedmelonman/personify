# Regression set

A small fixed set of bloated inputs that any edit to `SKILL.md` gets checked
against, so groups V (too many words), W (impersonal framing), and Z
(implementation instead of outcome) don't quietly lose priority to the
easier-to-spot stylistic groups. Filed as a standing guardrail in
smartwatermelon/personify#49.

Two cases added in 1.3.0 cover the universal surface rules rather than a
pattern group: `ceremonial-pr-description` and `over-commented-code`. Those two
rules are the only ones a personal `VOICE.md` cannot override, so both cases
must be run twice, once with a voice guide loaded and once without, and their
format checks must pass identically both times. A future edit that restores the
general "the voice guide wins" precedence is the regression they exist to catch,
and it is invisible in a run with no voice guide.

Why these three groups get a regression set and the others don't: they are the
ones that trace to the actual complaint this skill exists to fix. The
Provenance section records it as "a lot of words but not a lot of substance,"
which is a complaint about the ratio of words to ideas and about what the
writing is about, not about em dashes or rule-of-three. Stylistic tells are
easy to spot and easy to verify, so they are the ones a future edit will
naturally optimize for. These are not, so they get pinned down here.

## What each case records

Every case is a directory with four files:

| File | What it holds |
|------|---------------|
| `input.md` | The bloated original. |
| `expected-arm-a.md` | What a correct personify pass should produce. Not a string to diff against: a target to judge against, since there are many correct rewrites. |
| `checks.md` | The specific assertions that must hold, written so a human or a model can check them one at a time. |
| `notes.md` | Which groups the case exercises and what a regression would look like. |

## Capture the actual output, always

Record what a run actually produced, not just the input and the expectation. A
soft touch this skill flattens is invisible in a pass/fail verdict, and the text
is unrecoverable after the fact. Cheap to capture now, impossible later.

Save outputs as `actual-<YYYY-MM-DD>-personify.md` inside the case directory.
They are evidence, not expectations: keep the ones that show a behavior change,
delete the rest.

## Running the set

There is no runner, on purpose. The thing being checked is a model's judgment
about register and substance, which no assertion library evaluates. Run each
case by hand, or by dispatching a subagent per case:

1. Run `input.md` through the current `SKILL.md`.
2. Save the result as `actual-<date>-personify.md`.
3. Walk `checks.md` and mark each assertion pass or fail.
4. A failed check is either a regression to fix or an intentional change, in
   which case update `expected-arm-a.md` and `checks.md` in the same commit that
   changes `SKILL.md`, and say why in the commit message.

## When to run it

Any commit touching a pattern group, the Process steps, the Work register
section, or the Task boards section. Especially any commit that adds or
re-letters a pattern group, since that is when priority quietly shifts.

## Arms

`expected-arm-a.md` is arm A's expectation. It encodes the taxonomy's idea of
correct, which is what it was written against.

There is deliberately no `expected-arm-b.md`. Arm B is model judgment, so
pinning its exact output would either freeze one model's phrasing as correct or
require rewriting the fixture on every model change. Arm B is judged by the
reviewer and by accumulated evidence, not by a fixture.

CI asserts the harness produces a well-formed comparison. It does not assert
which arm wins. That is the question the harness exists to answer, and a CI
job that answered it would be assuming the conclusion.
