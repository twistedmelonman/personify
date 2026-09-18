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
    arm_a_label: 1
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

## Empty values and ties

A parser needs one answer per case, so these are fixed rather than left to
whoever writes the recorder.

`arm_a_label` is 1 or 2, whichever label the reviewer saw for arm A. Arm B has
the other one. The reviewer reports a winning label, not a winning arm, and the
assignment is a coin flip per run, so without this field `reviewer_winner`
cannot be derived at all.

`reviewer_winner` is `a`, `b`, or `tie`, already resolved through
`arm_a_label`. Store the arm, never the label the reviewer said.

`shared_residue` is always a list. No residue is `[]`, never the string
`"none"` and never an omitted key, even though the reviewer writes `none` in
its own output. The recorder translates.

`thread` is short free text, not a count or a structure. Consolidation groups
records by surface and audience, never by thread, so the field is there for a
human reading a record. `none` is the value when no thread was found.

`arm_a_groups` and `arm_b_removals` are always lists. An arm that changed
nothing gets `[]`.

Every frontmatter key above is always present. A field that does not apply
carries its empty value, and a missing key means a malformed record rather
than an absent value.

## Field notes

`audience_assumed` records that the probe guessed. Consolidation weights an
assumed-context record lower, because a wrong audience can make a good rewrite
look bad.

`arm_a_groups` is the list of lettered groups arm A reported applying. A group
that never appears across the record set is a dead rule, which is the only
signal that makes the taxonomy smaller.

The reviewer's `WHY:` line has no frontmatter field on purpose. All four
reviewer lines are stored verbatim under `## Reviewer`, and a parser reads WHY
from there by matching the line that starts with `WHY:`. Duplicating it as a
field would let the two copies disagree.

`shared_residue` is what the reviewer said both arms missed. Repeated entries
are the only source of new rules.

`final_captured` is false at write time and set true if the user's own text is
seen later. Capture is opportunistic: the record is amended if the user pastes
a corrected version, says what they changed, or the posted comment turns up via
`gh`. No prompt is ever issued to obtain it.

## Retired pattern-group letters

A group that consolidation finds dead is deleted from `rules/taxonomy.md`, and
its letter retires with it. A retired letter is never reused and the survivors
are never re-lettered to close the gap. Records key their `arm_a_groups` on
these letters, so reassigning one would silently rewrite every record already
written and make the next dead-rule count wrong.

Retired so far:

| Letter | Group | Retired |
| --- | --- | --- |
| F | Epistrophe / repetition as gravity | 2026-09-16 |
| I | Rhetorical question as connective tissue | 2026-09-16 |
| L | False ranges | 2026-09-16 |
| M | Vague attribution | 2026-09-16 |

## The .consolidated marker

`~/.claude/personify-evidence/.consolidated` holds the timestamp of the last
consolidation run. Records newer than it are unconsolidated. A missing file
means every record is unconsolidated.

**Read the count from `scripts/unconsolidated_count.sh` rather than counting
files.** The marker is a dotfile, so `ls` hides it unless given `-a`, and a
plain directory count returns the total record set instead of the
unconsolidated subset. This applies whenever the number is quoted, including
outside a personify run: the count has been reported wrong three times, each
time by counting the directory directly.

The marker drives the nudge only. Consolidation itself reads every record in
the directory, not just the unconsolidated ones. Dead-rule detection asks
whether a group has fired in any run ever, so reading only the newest records
would declare groups dead that fired before the last consolidation. The marker
answers "how much new evidence is waiting", never "what may be read".

Counting unconsolidated records, rather than total runs or elapsed days, is what
drives the nudge at 25. The count measures how much unread evidence exists,
which is the only thing that determines whether consolidation has anything to
say.
