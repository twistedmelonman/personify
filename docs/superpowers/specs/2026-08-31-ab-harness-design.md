# Personify 1.0: A/B harness with recorded evidence

Status: approved design, not yet implemented
Date: 2026-08-31

## Problem

Personify's pattern taxonomy is 26 hand-maintained groups in a 409-line
`SKILL.md`. Every newly noticed AI tell becomes another hand-written rule
(issues #60, #61, #63 are each "add a word to the ban list"). The taxonomy has
run out of letters: A through Z is what `scripts/validate_skill.py` accepts, so
a 27th group requires merging two existing groups and re-lettering every
cross-reference.

Nothing in the system ever makes the rule set smaller, and nothing measures
whether a given rule earns its place.

A second problem compounds it. Personify's output is formal enough that a
separate `dumbify` skill runs afterward to make it usable on workplace
surfaces. The two overshoot in opposite directions: the same output needs
soft-touches restored *and* residual wordiness cut. `calibrate-register` was
built on 2026-08-19 to collect evidence about which stage lost which words. It
has produced zero samples in twelve days, because it required invoking a
separate skill, running three stages by hand, and answering an interview.

## Goals

1. Measure whether the hand-maintained taxonomy beats current model judgment,
   using real invocations rather than synthetic tests.
2. Collect that evidence as a side effect of normal use, never as a task.
3. Give the skill context it currently lacks: surface, audience, thread,
   project.
4. Produce text that is send-ready for its surface, so `dumbify` can be dropped.

Success criterion: enough recorded runs to answer "does arm B alone beat arm A
plus dumbify," and a mechanism that can remove rules as well as add them.

## Non-goals

- Changing `dumbify`. It stays a separate skill, unmodified, out of scope. Goal
  4 aims to make it unnecessary, which is a decision taken later on evidence,
  not a change made here.
- Implementing an OpenAI reviewer backend. Interface only.
- VOICE.md corpus mining (issue #44). Separate parallel task.
- Moving rules between arms as part of this change. Arm A ships verbatim.
- Resolving the A-to-Z letter exhaustion. Deferred pending evidence.

## Architecture

    text + context -> [Context probe]
                           |
                  +--------+--------+
                  |                 |
             Arm A (taxonomy)  Arm B (judgment + hard rules)
                  |                 |
                  +--------+--------+
                           |
                      [Reviewer] -- picks winner, flags shared residue
                           |
                  primary output shown, other arm noted in one line
                           |
                     user accepts or edits
                           |
                  [Recorder] -> ~/.claude/personify-evidence/

Five components, each with one job.

### Context probe

Determines four dimensions before any rewriting. Infers first, asks only what
would change the output.

| Dimension | Inferred from | Asked when |
|---|---|---|
| Surface | Invocation shape: a PR URL means a PR comment; a repo with a branch and a diff means a PR description; headers and length suggest a doc | Ambiguous between surfaces with different registers |
| Audience | Surface plus repo. Own repo means teammate; public repo issue reply means stranger. VOICE.md may name recurring people | Text addresses someone by name the skill has no read on |
| Thread | `gh pr view --comments`, `gh issue view --comments` when a URL or number is present | Never |
| Project | Working directory, its CLAUDE.md, README, recent commits | Never |

The probe never blocks on a question it could answer wrong-but-harmlessly.
Unclear audience defaults to "familiar teammate", the dominant case, records the
assumption, and proceeds. A recorded wrong assumption beats a question that
makes the tool annoying enough to stop using.

Context reaches both arms identically. Otherwise the test measures context
quality rather than arm quality.

The probe is read-only against `gh`. It never posts, comments, or modifies.

### Arm A

Today's taxonomy, moved verbatim to `rules/taxonomy.md`. Reports which lettered
groups it applied.

### Arm B

New `rules/hard.md`, under 60 lines: hard rules only, plus an instruction to
use current model judgment for everything else.

Hard rules are the ones a model would not infer and that do not change:

- No em dashes or en dashes.
- VOICE.md is authoritative where it conflicts with anything.
- Never invent facts, dates, names, numbers, or examples.
- Preserve genuine uncertainty. Compression is linguistic, not semantic.
- ASD-STE100 bias: one meaning per word, active voice, short sentences.

Arm B reports removals in its own words, not by letter. Forcing it to use arm
A's letters would smuggle arm A's taxonomy into arm B and defeat the test. This
is also why the taxonomy moves out of `SKILL.md`: if both arms read one file,
arm B inherits arm A's framing regardless of prompt wording.

Arm B's target is text the user would send as-is, not text that a second filter
then compresses.

### Reviewer

A subagent that sees both arms and the context, blind to which arm is which.
Picks a winner and names residue both arms share. Shared residue is the
highest-value signal in a run, because it is the failure neither arm can catch
alone.

The backend is swappable behind a `reviewer` setting. Claude now; an external
model drops in later without touching other components.

### Recorder

Writes one file per invocation to
`~/.claude/personify-evidence/YYYY-MM-DDTHH-MM-SS.md`, without asking:

    context   four dimensions, assumptions marked as assumed
    input     verbatim
    arm A     text plus groups applied
    arm B     text plus removals described
    reviewer  winner, reasoning, shared residue
    final     user's text, if captured

Capturing the user's own edit is the hard part: the skill hands over text and
the session ends. Approach is **opportunistic capture**. The record is written
immediately without the edit. If the user pastes a corrected version, says what
they changed, or the skill later sees the posted comment via `gh`, it amends
the existing record. No prompt is ever issued. Records lacking a final edit
still count, with less weight.

Consolidation state lives in `~/.claude/personify-evidence/.consolidated`, which
holds the timestamp of the last consolidation run. Records newer than it are
unconsolidated, which is what the nudge counts. A missing file means every
record is unconsolidated.

## Output contract

Quiet default. A normal invocation returns the primary arm's text plus one
line:

    [arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22]

Full comparison appears on request, or automatically when the reviewer reports
low confidence, or the arms differ on more than a third of their spans:

    CONTEXT  surface: PR review comment · audience: teammate, familiar
             thread: 4 prior comments, disagreement about retry logic
             project: personify (skill repo)

    ARM A                              ARM B
    applied: V, W, Z, O, B            removed: two hedges, a header
                                      nobody asked for, "leverage"

    <text A>                          <text B>

    DIFF A->B
    - We should consider whether the retry logic is load-bearing here.
    + Does anything break if we drop the retry?

    REVIEWER  B. A kept a section header in a 3-sentence comment.
              Shared residue: both open with "I think" (neither cut it).

The diff shown is A to B, not original to final. The per-stage question is the
one `calibrate-register` was built to answer and could not.

### Asking for the comparison after the fact

`show both` is not a submit-time flag. Both arms have already run and both are
recorded before any output is shown, so the request is served by reading the
record, never by re-running. The user can ask at submission, immediately after
seeing the result, or later in the session, and the output is identical in all
three cases.

This is the reason the recorder writes before the result is displayed rather
than after, and the reason the status line carries the record timestamp: the
timestamp is how a past run is named.

Three ways to ask, all reading the same record:

- `show both`, immediately after a result. Refers to the most recent run.
- `show both 2026-08-31T09-14-22`, naming a timestamp from any earlier status
  line, including one from a previous session.
- `--ab` at submission, which only suppresses the quiet default for that run.
  It changes what is displayed, not what is computed.

A record whose file has been deleted is reported as unavailable. The skill does
not silently re-run to reconstruct it, because a re-run produces different text
and would be presented as though it were the original comparison.

## Consolidation

Nothing edits the rules automatically. A separate, explicitly invoked
`/personify-consolidate` pass reads accumulated records and proposes changes as
a PR:

**Dead rules.** Taxonomy groups that never fired across the record set. A group
that has not triggered in 80 runs costs maintenance and taxonomy space for
nothing. This is the only mechanism in the design that makes the rule set
smaller, and its absence is why the letters ran out.

**Wrong rules.** Cases where arm A applied a group and the reviewer preferred
arm B because of that application. A rule that makes output worse costs more
than a dead one.

**Shared residue.** Text both arms left in that the reviewer flagged, or that
the user removed by hand. Neither current judgment nor the taxonomy caught it.
This is the only source of new rules.

**Arm win rate by surface.** Whether one arm wins on PR comments and loses on
long-form docs. This is what eventually answers whether `dumbify` can be
dropped.

Output is a PR with a count behind every proposal, for example "remove group L,
zero applications in 80 records" or "add a rule for X, both arms missed it in 6
of 80 runs, user cut it by hand in 4". Each is approved, rejected, or edited by
the user. Consolidation never commits to main and never edits rules unreviewed.

### Where new rules go

A rule found in shared residue goes into `rules/learned.md`, which both arms
read. Not into the taxonomy, which would grow the thing this is meant to shrink
and burn letters that have run out. Not into `rules/hard.md`, which would
corrupt the test, since arm B is judgment plus a fixed minimum. A shared file
keeps the A-versus-B comparison honest, because both arms receive the addition
equally.

### Distinguishing a rule from a one-off

`calibrate-register` separated a genuine filter bug from a context-specific
judgment by interviewing the user. This design drops the interview, so
consolidation infers it from repetition instead: a thing fixed once is noise, a
thing fixed six times across different surfaces is a rule. This is a weaker
signal than asking, and it is the accepted cost of removing the step that made
the previous skill go unused.

Consolidation stays manual. It never fires on its own, and never edits rules
without review. A rule inferred from too few records is how the skills became
miscalibrated in two directions at once.

Manual invocation has a failure mode of its own: a pass nobody runs leaves the
evidence directory unread, which is `calibrate-register`'s failure with extra
steps. The nudge addresses it.

### The nudge

When unconsolidated records since the last consolidation reach 25, the status
line gains a short suffix:

    [arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22
     · 25 unconsolidated, /personify-consolidate]

Non-blocking, non-modal, no separate output. It appends to the line that is
already printed and never interrupts the invocation that triggered it.

The trigger counts unconsolidated records, not total runs. Elapsed time is not
used: 25 runs in a day and 25 over two months carry the same evidence, and only
the count determines whether consolidation has anything to say.

The nudge repeats at each subsequent multiple of 25, so a suppressed pass is
raised again rather than silently dropped.

Terminology: this pass is called consolidation. It reads recorded runs and
proposes edits to a markdown file for human approval. It does not train
anything, and ML training vocabulary is not used for it.

## Files

| Path | Status | Purpose |
|---|---|---|
| `SKILL.md` | rewritten | Orchestrator: probe, both arms, reviewer, recorder |
| `rules/taxonomy.md` | new, moved verbatim | Arm A's rule set |
| `rules/hard.md` | new | Arm B's rule set, under 60 lines |
| `rules/learned.md` | new, starts empty | Rules consolidation added from evidence. Both arms read it |
| `reviewer/` | new | Reviewer prompt and swappable backend interface |
| `scripts/validate_skill.py` | updated | Heading check follows taxonomy to its new file |
| `mcp-server/src/` | updated | Quiet-default line and `show both` path |

## Testing

Both arms run against `tests/regression/` fixtures in CI. CI asserts the
harness produces a well-formed comparison. It does **not** assert which arm
wins: that is the empirical question the harness exists to answer.

The existing `tests/regression/bloated-task-description/expected.md` becomes arm
A's expectation only. It encodes the current system's idea of correct.

## Versioning

Major bump to 1.0.0 in `SKILL.md` frontmatter and `.claude-plugin/plugin.json`,
in lockstep. The taxonomy moves out of `SKILL.md`, the invocation contract
changes, and the skill gains an evidence directory. Installed plugin caches key
off this field.

## Risks

- **Both arms cost roughly double per invocation.** Accepted: the quiet default
  keeps the reading cost at one line, and the evidence is the point.
- **Opportunistic capture may rarely fire.** Records without a final edit are
  still usable. If capture proves too rare to be useful, revisit before adding
  any prompt-based fallback.
- **A blind reviewer may still favor a house style.** Mitigated by the swappable
  backend: an external model is the check on that, and is the reason the
  interface exists now rather than later.
