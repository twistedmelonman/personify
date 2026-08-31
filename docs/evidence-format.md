# Evidence record format

One file per invocation, at `~/.claude/personify-evidence/<YYYY-MM-DDTHH-MM-SS>.md`.
The time component uses hyphens instead of colons because a colon is not
portable in a filename on every platform. The filename timestamp is the
record's name: it appears in the status line and is how `show both
<timestamp>` finds a past run.

The recorder creates `~/.claude/personify-evidence/` if it does not exist,
before writing the first record.

Written before any output is shown, so the record always exists by the time the
user could ask about it.

## Shape

A YAML frontmatter block for the fields consolidation counts, then verbatim
text sections it reads only when a human is looking.

    ---
    timestamp: 2026-08-31T09-14-22
    surface: pr-review-comment
    audience: teammate-familiar
    audience_assumed: true
    thread: 4 prior comments
    project: personify
    arm_a_groups: [V, W, Z]
    arm_b_removals: ["two hedges", "a header nobody asked for", "leverage"]
    reviewer_winner: b
    reviewer_confidence: high
    shared_residue: ["opens with I think"]
    final_captured: false
    ---

    ## Input

    <verbatim source text>

    ## Arm A

    <verbatim arm A output>

    ## Arm B

    <verbatim arm B output>

    ## Reviewer

    <the four reviewer lines, verbatim>

    ## Final

    <the user's own text, when captured; omitted otherwise>

## Field notes

`audience_assumed` records that the probe guessed. Consolidation weights an
assumed-context record lower, because a wrong audience can make a good rewrite
look bad.

`arm_a_groups` is the list of lettered groups arm A reported applying. A group
that never appears across the record set is a dead rule, which is the only
signal that makes the taxonomy smaller.

`shared_residue` is what the reviewer said both arms missed. Repeated entries
are the only source of new rules.

`final_captured` is false at write time and set true if the user's own text is
seen later. Capture is opportunistic: the record is amended if the user pastes
a corrected version, says what they changed, or the posted comment turns up via
`gh`. No prompt is ever issued to obtain it.

## The .consolidated marker

`~/.claude/personify-evidence/.consolidated` holds the timestamp of the last
consolidation run. Records newer than it are unconsolidated. A missing file
means every record is unconsolidated.

Counting unconsolidated records, rather than total runs or elapsed days, is what
drives the nudge at 25. The count measures how much unread evidence exists,
which is the only thing that determines whether consolidation has anything to
say.
