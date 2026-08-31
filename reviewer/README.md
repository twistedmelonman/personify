# Reviewer

Picks between arm A and arm B, blind to which is which.

`PROMPT.md` is the prompt.

## What the backend receives

The two rewritten texts, labeled 1 and 2 with the assignment randomized per
run, and the context block. Nothing else.

Never send either arm's report of what it applied. Arm A reports lettered
group names such as "V, W, Z" and arm B reports plain descriptions, so those
reports identify the arms on sight and make the randomized labels pointless.
The reports belong in the evidence record, which the reviewer does not read.

## Backend selection

The backend that runs the prompt is selected by the `PERSONIFY_REVIEWER`
environment variable:

- unset or `claude`: run the prompt as a subagent in the current session. This
  is the only implemented backend.
- any other value: not implemented. The skill reports the unknown backend and
  falls back to `claude` rather than failing the run, because a reviewer
  outage must not cost the user their rewrite.

An external backend is the reason this indirection exists. A model from a
different family has different blind spots, which is worth having on the one
judgment Claude cannot make impartially about its own two outputs. Adding one
means implementing the call, and changing nothing else: the prompt and the
four-line output contract stay as they are.
