# Notes

Exercises: the Code comments section (primary), V, and the voice-guide
precedence carve-out added in 1.3.0.

## Why this case exists

The comment rule is a ratio plus a judgment call, and the judgment call is the
part that regresses. Cutting twelve comments to zero satisfies the ratio and is
wrong: the `ttl=55` is the one place where the code does not explain itself, so
a run that deletes everything has traded one failure for another.

That is the balance this case pins. A model told "comments are a tell" tends
toward zero, and zero loses a fact. The pass condition requires both the
deletions and the one survivor.

## The moved fact

The TTL rationale arrives as prose after the code block rather than as a
comment, on purpose. It tests whether the skill recognizes that the fact
belongs in the comment and moves it, rather than either dropping it with the
prose or leaving it stranded outside the code. Moving it is a relocation, not an
invention, which is the same distinction the Task boards worked example turns
on.

## Scope

A code comment pass is the first surface here where the skill is handed
something it must partly not touch. The code is not prose and is not in scope.
This is worth an explicit check because the input has an obvious refactor
available (the early return could collapse), and a model in editing mode will
take it.

## What a regression looks like

- Every comment is deleted, including the TTL rationale.
- The comment count climbs back above the code count.
- A comment narrates the line under it again.
- The wiki link comes back.
- The TTL rationale stays outside the code block as prose.
- The code itself changes.
- A docstring gets cut on ratio grounds.

## Source

Written from the specification Andrew gave on 2026-09-17. The input is
synthetic, built so that exactly one of its twelve comments is worth keeping
and the keeper is the least conspicuous one.
