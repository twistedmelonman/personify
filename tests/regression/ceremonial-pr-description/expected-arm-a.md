Target shape, not a string to diff against:

> When a session refreshes, the lookup misses a cached entry that is present, so
> the refresh goes to the network. It should find the entry.
>
> The cache keys entries on the user ID and `refresh_session()` looked them up
> by session ID.
>
> Keys the lookup on the user ID. Regression test in `tests/test_session.py`.

Three plain paragraphs: problem, evidence, solution. No headers, no bullets, no
bold, no dashes, and no numbered labels on the parts.

Part 4 (references) is absent because nothing outside the codebase had to be
consulted. Skipping it is correct; an empty "References: none" line is a fail.

Note what the problem statement does and does not claim. The input never says
what the user-visible symptom is, only that a refresh "can miss a cached entry."
The rewrite says exactly that and stops. A version that says "users get logged
out" or "sessions expire early" has invented a fact and fails the case outright,
however much better it reads as a problem statement.

The "Testing" section is gone rather than compressed. Every line in it either
reports a passing suite (which CI shows) or enumerates a check that does not
apply. The regression test survives because it is a fact about the diff a
reviewer acts on, not a reassurance.
