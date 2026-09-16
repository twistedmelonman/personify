# Learned rules

Rules that consolidation added from recorded evidence. Both arms read this
file, so an addition reaches each arm equally and never tilts the comparison.

Nothing is added here by hand. `/personify-consolidate` proposes entries in a
PR, and only an approved PR adds one.

## How this file works

Every rule states the tell, the fix, and the evidence that produced it, in this
shape:

    ### Short label
    The tell, in one or two sentences.
    Fix: what to do instead.
    Evidence: N records, first seen YYYY-MM-DD, user cut it by hand M times.

Every rule is a `###` entry under `## Rules`. A rule with no `Evidence:` line
is invalid. The count is what separates a real rule from one person's judgment
on one afternoon.

## Rules

### Label and heading scaffolding

A paragraph opens with a short label and a colon, or a bolded lead-in, or a
section heading, where the sentence that follows already carries the point.
"Why I'm correcting it:", "What I have not decided here:", "Worth naming:",
"Evidence from the Staging Deploy run:", "Controls:". Also `## Access` and
`## Verification` over what is two paragraphs, and "part 1 / part 2" kept as
headings. Both arms produce it even when neither the source nor the surface
register has it. Fix: delete the label or heading and let the first sentence
do its own work. A correction reads as a correction without being announced.
VOICE.md line 191 allows bold lead-in labels in the technical register only,
and this rule does not override that exception.
Evidence: 9 records, first seen 2026-09-01, on PR description, Slack thread
reply, Slack message, roadmap record correction, decision note, project
record doc section, and a GitHub discussion plus Asana comment pair. Hand-cut
count not measurable: the final sent text was captured in 3 of 31 records.

### The text does not stop at the last fact

After the last thing that carries information, the text adds one more line:
stock reassurance the source did not have, boilerplate repeated verbatim
across sibling documents, a forward-looking "Next:" label, or a close that
re-explains the blocker instead of stopping. Fix: stop at the last fact.
VOICE.md lines 62 and 72 already require the flat close. Both arms produce
this residue anyway, so this is an existing rule not landing rather than a
newly found tell.
Evidence: 6 records, first seen 2026-09-02, on PR description, PR description
append, decision note, Slack thread reply, and Slack message. Hand-cut count
not measurable: the final sent text was captured in 3 of 31 records.

### Restating what the text already established

A sentence repeats a fact that the preceding sentence, the heading above it,
or a prior message in the same thread already carried. A plain-English gloss
sits beside the literal setting it glosses. A mechanism the thread already
established gets explained again. Fix: state each fact once, where a reader
meets it first. VOICE.md lines 23 and 25 already cut restatement, and both
arms produce it anyway, so this is an existing rule not landing.
Evidence: 6 records, first seen 2026-09-01, on PR description, PR description
append, task handoff record, Asana task description, project record doc
section, and Slack thread reply. Hand-cut count not measurable: the final
sent text was captured in 3 of 31 records.
