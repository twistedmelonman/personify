# Personify 1.0 A/B Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every personify invocation runs two rule sets against the same text,
records the comparison to disk, and shows one line by default, so evidence about
which rule set works accumulates from real use.

**Architecture:** `SKILL.md` becomes an orchestrator. The taxonomy moves to
`rules/taxonomy.md` (arm A) and a new `rules/hard.md` holds arm B's minimum. A
blind reviewer picks a winner. A recorder writes every run to
`~/.claude/personify-evidence/`. The MCP bridge gains a `mode` argument and a
longer timeout, because two arms plus a review exceed the current 30s budget.

**Tech Stack:** Markdown skill files, Python 3 validator (stdlib only),
TypeScript MCP server on `@modelcontextprotocol/sdk` ^1.30.0, vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-ab-harness-design.md`

## Global Constraints

- No em dashes or en dashes in prose, in any file, including this plan and all
  commit messages. Replace with a period, comma, or colon. The only exception is
  code that detects them, where the character is the thing being matched.
- `SKILL.md` frontmatter `version` and `.claude-plugin/plugin.json` `version`
  move to `1.0.0` together, in the same commit. Installed plugin caches key off
  this field.
- Frontmatter must keep `name:`, `description:`, `version:`, `license:` and must
  not add `compatibility:` or `allowed-tools:`.
- Never use ML training vocabulary (distill, fine-tune, train, teacher, student)
  for the consolidation pass. It is called consolidation.
- `dumbify` is not modified by any task in this plan.
- Arm B must never be shown the taxonomy. Any task that lets arm B read
  `rules/taxonomy.md` has failed.
- Python: stdlib only, no new dependencies. TypeScript: no new runtime deps.
- Every file ends with a newline.

---

### Task 1: Move the taxonomy out of SKILL.md

The validator reads `### A.` headings from `SKILL.md` and calls `fail()` when it
finds none. Moving the taxonomy without updating the validator breaks CI on the
same commit, so both move together here.

**Files:**

- Create: `rules/taxonomy.md`
- Modify: `SKILL.md` (remove lines 37 to 235, the `## Pattern groups` block)
- Modify: `scripts/validate_skill.py:14`, `:44-56`
- Test: `scripts/validate_skill.py` is the test; it runs in CI via
  `.github/workflows/validate.yml`

**Interfaces:**

- Consumes: nothing.
- Produces: `rules/taxonomy.md` containing groups A through Z verbatim.
  `validate_skill.py` gains `TAXONOMY_PATH = ROOT / "rules" / "taxonomy.md"`.

- [ ] **Step 1: Confirm the validator currently passes**

```bash
python3 scripts/validate_skill.py
```

Expected: `SKILL.md is valid: 26 pattern groups (A-Z)`

- [ ] **Step 2: Extract the taxonomy verbatim**

```bash
python3 - <<'PY'
import pathlib
skill = pathlib.Path("SKILL.md")
text = skill.read_text(encoding="utf-8")
start = text.index("## Pattern groups")
end = text.index("## What NOT to flag")
body = text[start:end]
pathlib.Path("rules").mkdir(exist_ok=True)
header = (
    "# Pattern groups (arm A)\n\n"
    "The hand-maintained taxonomy. Arm A reads this file and reports which\n"
    "lettered groups it applied. Arm B must never read it: see the design spec\n"
    "at docs/superpowers/specs/2026-08-31-ab-harness-design.md.\n\n"
)
pathlib.Path("rules/taxonomy.md").write_text(header + body.rstrip() + "\n", encoding="utf-8")
skill.write_text(text[:start] + text[end:], encoding="utf-8")
PY
```

- [ ] **Step 3: Verify the move lost nothing**

```bash
grep -c '^### [A-Z]\. ' rules/taxonomy.md   # expect 26
grep -c '^### [A-Z]\. ' SKILL.md            # expect 0
```

Expected: `26` then `0`.

- [ ] **Step 4: Run the validator to verify it now fails**

```bash
python3 scripts/validate_skill.py
```

Expected: FAIL with "No pattern-group headings found (expected '### A. ...' style)".
This confirms the validator is genuinely checking the taxonomy and not passing
vacuously.

- [ ] **Step 5: Point the validator at the new file**

In `scripts/validate_skill.py`, after the `SKILL_PATH` assignment on line 14, add:

```python
TAXONOMY_PATH = ROOT / "rules" / "taxonomy.md"
```

Replace the heading block (lines 44 to 56) with:

```python
    if not TAXONOMY_PATH.exists():
        fail("rules/taxonomy.md not found")
    taxonomy = TAXONOMY_PATH.read_text(encoding="utf-8")

    heading_letters = re.findall(r"(?m)^### ([A-Z])\. ", taxonomy)
    if not heading_letters:
        fail("No pattern-group headings found in rules/taxonomy.md")

    expected = list(string.ascii_uppercase[: len(heading_letters)])
    if heading_letters != expected:
        fail(
            "Pattern-group headings must run A, B, C... with no gaps "
            f"or repeats; found {heading_letters}"
        )

    if re.search(r"(?m)^### [A-Z]\. ", text):
        fail("Pattern groups must live in rules/taxonomy.md, not SKILL.md")
```

- [ ] **Step 6: Run the validator to verify it passes**

```bash
python3 scripts/validate_skill.py
```

Expected: `SKILL.md is valid: 26 pattern groups (A-Z)`

- [ ] **Step 7: Commit**

```bash
git add rules/taxonomy.md SKILL.md scripts/validate_skill.py
git commit -m "refactor: move pattern taxonomy to rules/taxonomy.md

Arm B must not see arm A's rules. A shared file would smuggle the taxonomy
into arm B regardless of prompt wording, so the split is physical.

Validator follows the headings to the new file and now also rejects lettered
groups reappearing in SKILL.md."
```

---

### Task 2: Write arm B's hard rules

**Files:**

- Create: `rules/hard.md`
- Test: `tests/test_rules_files.py` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `rules/hard.md`, under 60 lines, containing only rules a model would
  not infer.

- [ ] **Step 1: Create the tests package**

`unittest discover` imports the directory, so it needs an init file. Without
it, discovery reports zero tests and appears to pass.

```bash
mkdir -p tests && touch tests/__init__.py
```

- [ ] **Step 2: Write the failing test**

Create `tests/test_rules_files.py`:

```python
"""Structural checks on the rules files.

Stdlib unittest, not pytest: this repo installs no Python dependencies and CI
runs plain python3. Adding pytest would mean a dependency and an install step
for four assertions.
"""

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
HARD = ROOT / "rules" / "hard.md"
TAXONOMY = ROOT / "rules" / "taxonomy.md"


class TestHardRules(unittest.TestCase):
    def test_hard_rules_exist(self):
        self.assertTrue(HARD.exists(), "rules/hard.md must exist")

    def test_hard_rules_stay_short(self):
        lines = HARD.read_text(encoding="utf-8").splitlines()
        self.assertLess(
            len(lines), 60, f"rules/hard.md is {len(lines)} lines, limit is 60"
        )

    def test_hard_rules_have_no_lettered_groups(self):
        text = HARD.read_text(encoding="utf-8")
        self.assertIsNone(
            re.search(r"(?m)^### [A-Z]\. ", text),
            "hard.md must not contain taxonomy groups; that is arm A's file",
        )

    def test_no_dashes_in_rules_files(self):
        for path in (HARD, TAXONOMY):
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("\u2014", text, f"em dash in {path.name}")
            self.assertNotIn("\u2013", text, f"en dash in {path.name}")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
python3 -m unittest discover -s tests -v
```

Expected: FAIL on `test_hard_rules_exist` with `rules/hard.md must exist`.

If discovery reports `Ran 0 tests`, the init file from step 1 is missing. Zero
tests is a failure, not a pass.

- [ ] **Step 4: Write rules/hard.md**

```markdown
# Hard rules (arm B)

Arm B's entire rule set. Everything not stated here is left to current model
judgment about what reads as machine-written.

Do not consult `rules/taxonomy.md`. Arm B exists to test whether judgment beats
that taxonomy, and reading it destroys the comparison.

## The rules

1. No em dashes or en dashes. Replace with a period, comma, or colon. Not
   parentheses.
2. The voice guide is authoritative. Where it conflicts with anything here or
   with your own judgment, it wins.
3. Never invent a fact, date, name, number, quotation, or example that was not
   in the source.
4. Preserve genuine uncertainty. Remove hedging that protects the writer, keep
   hedging that reports real doubt. "I think X" where the writer is guessing
   stays; "I think" bolted onto a fact they know goes.
5. Preserve every fact the source carries, including facts inside asides.
   Compression is linguistic, never semantic.
6. Prefer one meaning per word, active voice, and short sentences, following
   ASD-STE100. Where simplicity and accuracy conflict, accuracy wins.
7. Name the actor. If a sentence describes a judgment or an action, say who
   made or did it.

## The judgment instruction

Beyond those rules, remove what reads as machine-written to a reader in 2026.
You know the statistical fingerprints of LLM prose. Apply that knowledge
directly rather than matching against a list.

Two failure modes, equally bad: leaving tells in, and flattening the text into
correct, voiceless prose with no writer behind it.

## Output target

The result is what the writer would send on this surface, as-is. Not a clean
draft for a second filter to compress. If the surface is a PR comment and the
result reads like a memo, it is not finished.

## What to report

List what you removed and why, in plain description. Do not use lettered group
names. If you find yourself reaching for one, describe the tell instead.
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
python3 -m unittest discover -s tests -v
```

Expected: `Ran 4 tests` and `OK`.

- [ ] **Step 6: Commit**

```bash
git add rules/hard.md tests/test_rules_files.py
git commit -m "feat: add arm B hard rules

Seven rules a model would not infer, plus an instruction to use current
judgment for everything else. Test pins the file under 60 lines so it cannot
grow into a second taxonomy."
```

---

### Task 3: Add the learned-rules file

**Files:**

- Create: `rules/learned.md`
- Modify: `tests/test_rules_files.py`

**Interfaces:**

- Consumes: `tests/test_rules_files.py` from Task 2.
- Produces: `rules/learned.md`, read by both arms, starts with no rules.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rules_files.py`:

```python
Insert `LEARNED` beside the other path constants at the top of the file:

```python
LEARNED = ROOT / "rules" / "learned.md"
```

Then add this class before the `if __name__` block:

```python
class TestLearnedRules(unittest.TestCase):
    def test_learned_rules_exist(self):
        self.assertTrue(LEARNED.exists(), "rules/learned.md must exist")

    def test_learned_rules_have_no_lettered_groups(self):
        text = LEARNED.read_text(encoding="utf-8")
        self.assertIsNone(
            re.search(r"(?m)^### [A-Z]\. ", text),
            "learned.md must not use taxonomy letters; those belong to arm A",
        )

    def test_learned_entries_cite_evidence(self):
        text = LEARNED.read_text(encoding="utf-8")
        skip = ("Rules", "How this file works")
        for heading in re.findall(r"(?m)^## (.+)$", text):
            if heading.strip() in skip:
                continue
            body = text.split(f"## {heading}", 1)[1][:600]
            self.assertIn(
                "Evidence:", body, f"rule {heading!r} has no Evidence: line"
            )
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python3 -m unittest discover -s tests -v
```

Expected: FAIL on `test_learned_rules_exist`.

- [ ] **Step 3: Write rules/learned.md**

```markdown
# Learned rules

Rules that consolidation added from recorded evidence. Both arms read this
file, so an addition reaches each arm equally and never tilts the comparison.

Nothing is added here by hand. `/personify-consolidate` proposes entries in a
PR, and only an approved PR adds one.

## How this file works

Every rule states the tell, the fix, and the evidence that produced it, in this
shape:

    ## Short label
    The tell, in one or two sentences.
    Fix: what to do instead.
    Evidence: N records, first seen YYYY-MM-DD, user cut it by hand M times.

A rule with no `Evidence:` line is invalid. The count is what separates a real
rule from one person's judgment on one afternoon.

## Rules

No rules yet. Consolidation has not run.
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
python3 -m unittest discover -s tests -v
```

Expected: `Ran 7 tests` and `OK`.

- [ ] **Step 5: Commit**

```bash
git add rules/learned.md tests/test_rules_files.py
git commit -m "feat: add rules/learned.md for consolidation output

New rules from shared residue need a home that is neither the taxonomy, which
is out of letters and is the thing being shrunk, nor arm B's hard rules, which
would corrupt the test. Both arms read this file.

Test rejects an entry with no Evidence: line, so a rule cannot enter without
the count that justifies it."
```

---

### Task 4: Write the reviewer

**Files:**

- Create: `reviewer/PROMPT.md`
- Create: `reviewer/README.md`

**Interfaces:**

- Consumes: nothing.
- Produces: `reviewer/PROMPT.md`, whose output contract is exactly four labeled
  lines: `WINNER:`, `CONFIDENCE:`, `WHY:`, `SHARED RESIDUE:`. The recorder in
  Task 6 parses these labels.

- [ ] **Step 1: Write reviewer/PROMPT.md**

```markdown
# Reviewer prompt

Given a context block and two candidate rewrites labeled 1 and 2, pick the one
a person would actually send.

You are not told which rule set produced which candidate, and you must not
guess. If you find yourself reasoning about which is "the taxonomy one," stop.

## What to judge

In order:

1. Faithfulness. Does it keep every fact, number, name, and real uncertainty
   from the source? A candidate that drops one loses outright, regardless of
   how it reads.
2. Surface fit. Would a person send this on the stated surface, to the stated
   audience? A memo on a PR comment is a failure even if every sentence is
   clean.
3. Voice. Does a specific person come through, or is it correct and anonymous?
4. Residue. How much still reads as machine-written?

## Shared residue

Name what BOTH candidates left in that neither should have. This is the most
useful thing you produce: it is the failure neither rule set can catch alone.
If both are clean, say `none`.

Do not invent residue to fill the field. `none` is a real answer.

## Output

Exactly four lines, no preamble, no markdown:

    WINNER: 1 | 2 | tie
    CONFIDENCE: high | low
    WHY: one sentence, naming the specific thing that decided it
    SHARED RESIDUE: comma-separated phrases, or none

Use `tie` only when the candidates are materially identical, not when choosing
is hard. Use `low` confidence when the two differ a lot and the choice is a
judgment call; low confidence causes the full comparison to be shown.
```

- [ ] **Step 2: Write reviewer/README.md**

```markdown
# Reviewer

Picks between arm A and arm B, blind to which is which.

`PROMPT.md` is the prompt. The backend that runs it is selected by the
`PERSONIFY_REVIEWER` environment variable:

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
```

- [ ] **Step 3: Verify the output contract is unambiguous**

```bash
grep -c 'WINNER:\|CONFIDENCE:\|WHY:\|SHARED RESIDUE:' reviewer/PROMPT.md
```

Expected: `4` or more. These four labels are what Task 6's recorder parses.

- [ ] **Step 4: Commit**

```bash
git add reviewer/
git commit -m "feat: add blind reviewer prompt and backend contract

Reviewer sees two candidates and no arm labels, so it cannot favor a rule set
by reputation. Output is four fixed labels the recorder parses.

Backend selection is an env var with one implemented value. An unknown backend
falls back to claude rather than failing, since a reviewer outage must not
cost the user their rewrite."
```

---

### Task 5: Rewrite SKILL.md as the orchestrator

**Files:**

- Modify: `SKILL.md` (frontmatter version, and the body after Step 0)
- Modify: `.claude-plugin/plugin.json:5`

**Interfaces:**

- Consumes: `rules/taxonomy.md` (Task 1), `rules/hard.md` (Task 2),
  `rules/learned.md` (Task 3), `reviewer/PROMPT.md` (Task 4).
- Produces: the status line format that Task 7's MCP tests assert:
  `[arm B primary · arm A differed on N spans · evidence: <timestamp>]`

- [ ] **Step 1: Bump both versions**

In `SKILL.md` frontmatter, change `version: 0.6.0` to `version: 1.0.0`.
In `.claude-plugin/plugin.json` line 5, change `"version": "0.6.0"` to
`"version": "1.0.0"`.

- [ ] **Step 2: Verify they match**

```bash
grep '^version:' SKILL.md
grep '"version"' .claude-plugin/plugin.json
```

Expected: both report `1.0.0`.

- [ ] **Step 3: Replace the Process section**

Replace the `## Process` section of `SKILL.md` with:

```markdown
## Process

Step 0 above still runs first. The voice guide reaches both arms.

### 1. Probe the context

Determine four things before rewriting anything. Infer first. Ask only when a
wrong answer would change the output.

- Surface. A PR URL means a PR comment. A repo with a branch and a diff means a
  PR description. Headers and length suggest a document. Ask only when two
  surfaces with different registers are equally likely.
- Audience. Own repo means a familiar teammate, which is the default. A public
  repo issue reply means a stranger. The voice guide may name recurring people.
  Ask only when the text addresses someone by name you have no read on.
- Thread. Run `gh pr view --comments` or `gh issue view --comments` when a URL
  or number is present. Never ask. If it is unavailable, record it as absent
  and continue.
- Project. Read the working directory, its CLAUDE.md, and its README. Never ask.

Record every inferred value, and mark assumed ones as assumed. A recorded wrong
assumption is better than a question that makes this tool annoying enough to
stop using.

These `gh` calls are read-only. Never post, comment, or modify.

### 2. Run both arms on the same text

Arm A reads `rules/taxonomy.md` and `rules/learned.md`. It reports which
lettered groups it applied.

Arm B reads `rules/hard.md` and `rules/learned.md`. It must not read
`rules/taxonomy.md`. It reports what it removed in plain description, never by
letter.

Both receive identical context and the same voice guide. Neither sees the
other's output.

### 3. Review

Run `reviewer/PROMPT.md` with the context and both candidates, labeled 1 and 2,
without saying which arm produced which. Assign the labels randomly per run, so
position carries no information.

### 4. Record before showing anything

Write the run to `~/.claude/personify-evidence/<ISO8601>.md` before displaying
output. The record is what `show both` reads later, so it must exist by the
time the user sees the result.

### 5. Show the quiet default

Output the winning text, then one line:

    [arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22]

Show the full comparison instead when the user asked for it, when the reviewer
reported low confidence, or when the arms differ on more than a third of their
spans.

When unconsolidated records reach 25, append to that same line:

    · 25 unconsolidated, /personify-consolidate

Never as separate output, never as a question.

### 6. Serve later requests from the record

`show both` reads the record. It never re-runs the arms. It works right after a
result, later in the session, and in a future session when given a timestamp.
If the record file is gone, say it is unavailable. Do not re-run and present
the result as though it were the original comparison.
```

- [ ] **Step 4: Verify SKILL.md has no taxonomy left**

```bash
grep -c '^### [A-Z]\. ' SKILL.md
python3 scripts/validate_skill.py
```

Expected: `0`, then `SKILL.md is valid: 26 pattern groups (A-Z)`.

- [ ] **Step 5: Verify no em dashes were introduced**

```bash
grep -c '—\|–' SKILL.md rules/*.md reviewer/*.md
```

Expected: `0` for every file.

- [ ] **Step 6: Commit**

```bash
git add SKILL.md .claude-plugin/plugin.json
git commit -m "feat!: run two arms per invocation and record the comparison

SKILL.md becomes an orchestrator: probe context, run both rule sets, review
blind, record, show one line.

BREAKING CHANGE: the taxonomy moved to rules/taxonomy.md and invocations now
write to ~/.claude/personify-evidence/. Version 1.0.0."
```

---

### Task 6: Define the evidence record format

**Files:**

- Create: `docs/evidence-format.md`
- Create: `tests/test_evidence_format.py`

**Interfaces:**

- Consumes: the reviewer's four labels from Task 4.
- Produces: the record schema that `/personify-consolidate` parses in Task 8,
  and the `.consolidated` marker file semantics.

- [ ] **Step 1: Write the failing test**

Create `tests/test_evidence_format.py`:

```python
"""The evidence format is a contract between the recorder and consolidation.
These tests pin the parts consolidation depends on. Stdlib unittest, per
tests/test_rules_files.py.
"""

import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
FORMAT = ROOT / "docs" / "evidence-format.md"

REQUIRED_FIELDS = (
    "surface:",
    "audience:",
    "thread:",
    "project:",
    "arm_a_groups:",
    "arm_b_removals:",
    "reviewer_winner:",
    "reviewer_confidence:",
    "shared_residue:",
    "final_captured:",
)


class TestEvidenceFormat(unittest.TestCase):
    def test_format_doc_exists(self):
        self.assertTrue(FORMAT.exists())

    def test_every_required_field_is_documented(self):
        text = FORMAT.read_text(encoding="utf-8")
        missing = [f for f in REQUIRED_FIELDS if f not in text]
        self.assertEqual(missing, [], f"undocumented record fields: {missing}")

    def test_consolidated_marker_is_specified(self):
        text = FORMAT.read_text(encoding="utf-8")
        self.assertIn(".consolidated", text)
        self.assertIn("unconsolidated", text)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python3 -m unittest discover -s tests -v
```

Expected: FAIL on `test_format_doc_exists`.

- [ ] **Step 3: Write docs/evidence-format.md**

```markdown
# Evidence record format

One file per invocation, at `~/.claude/personify-evidence/<ISO8601>.md`. The
filename timestamp is the record's name: it appears in the status line and is
how `show both <timestamp>` finds a past run.

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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
python3 -m unittest discover -s tests -v
```

Expected: `Ran 3 tests` and `OK`.

- [ ] **Step 5: Commit**

```bash
git add docs/evidence-format.md tests/test_evidence_format.py
git commit -m "docs: specify the evidence record format

The record is a contract between the recorder and consolidation. Test asserts
every field consolidation counts is documented, so a field cannot be dropped
from the writer without the reader noticing."
```

---

### Task 7: Teach the MCP bridge about modes and the longer run

Two arms plus a review cannot finish inside the current 30s timeout, and the
tool takes only `text`, so there is no way to ask for the comparison.

**Files:**

- Modify: `mcp-server/src/cli-runner.ts:16` (`DEFAULT_TIMEOUT_MS`), `:6-14`
  (`PERSONIFY_INSTRUCTION`), `:18-21` (signature)
- Modify: `mcp-server/src/index.ts:22` (`handlePersonifyCall`), `:66-87`
  (tool schema), `:99-105` (argument handling)
- Test: `mcp-server/test/cli-runner.test.ts`, `mcp-server/test/index.test.ts`

**Interfaces:**

- Consumes: the status line format from Task 5.
- Produces: `runPersonify(text, { mode })` where
  `mode: "default" | "both"`, and a `mode` property on the tool's input schema.

- [ ] **Step 1: Write the failing tests**

Append to `mcp-server/test/cli-runner.test.ts`:

```typescript
describe("runPersonify modes", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    loadOAuthTokenMock.mockReset();
    loadOAuthTokenMock.mockResolvedValue({ ok: true, token: "t" });
  });

  it("passes the show-both instruction when mode is both", async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runPersonify("hello", { mode: "both" });
    child.stdout.emit("data", Buffer.from("out"));
    child.emit("close", 0);
    await promise;
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args.join(" ")).toContain("show both");
  });

  it("omits the show-both instruction by default", async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runPersonify("hello");
    child.stdout.emit("data", Buffer.from("out"));
    child.emit("close", 0);
    await promise;
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args.join(" ")).not.toContain("show both");
  });

  it("allows more than 30s, since two arms plus review exceed it", async () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000);
  });
});
```

Update the import line at the top of that file to:

```typescript
const { runPersonify, DEFAULT_TIMEOUT_MS } = await import("../src/cli-runner.js");
```

Append to `mcp-server/test/index.test.ts`:

```typescript
it("accepts a mode argument in the tool schema", async () => {
  const server = createServer();
  const tools = await listTools(server);
  const schema = tools[0].inputSchema as {
    properties: Record<string, unknown>;
  };
  expect(schema.properties).toHaveProperty("mode");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm --prefix mcp-server test
```

Expected: FAIL. `mode` is not a property, and `DEFAULT_TIMEOUT_MS` is 30000.

- [ ] **Step 3: Update cli-runner.ts**

Change `DEFAULT_TIMEOUT_MS` on line 16 to:

```typescript
// Two arms plus a blind review, not one rewrite. The old 30s budget was sized
// for a single pass and times out on nearly every 1.0 invocation.
export const DEFAULT_TIMEOUT_MS = 180_000;
```

Add below `PERSONIFY_INSTRUCTION`:

```typescript
export const SHOW_BOTH_SUFFIX =
  " After producing the result, show both arms: the full comparison with " +
  "context, each arm's reported rules, the A to B diff, and the reviewer " +
  "verdict.";
```

Change the signature and the instruction it passes:

```typescript
export async function runPersonify(
  text: string,
  opts: { timeoutMs?: number; tokenPath?: string; mode?: "default" | "both" } = {},
): Promise<CliResult> {
```

and inside, where the spawn arguments are built:

```typescript
    const instruction =
      opts.mode === "both"
        ? PERSONIFY_INSTRUCTION + SHOW_BOTH_SUFFIX
        : PERSONIFY_INSTRUCTION;
    const child = spawn(
      "claude",
      ["--print", "--permission-mode", "auto", instruction],
```

- [ ] **Step 4: Update index.ts**

Change `handlePersonifyCall` to take the mode:

```typescript
export async function handlePersonifyCall(
  text: string,
  mode: "default" | "both" = "default",
): Promise<CallToolResult> {
  const [cliResult, versionResult] = await Promise.all([
    runPersonify(text, { mode }),
    checkPersonifyVersion(),
  ]);
```

Add to the tool's `inputSchema.properties`:

```typescript
            mode: {
              type: "string",
              enum: ["default", "both"],
              description:
                "default returns the edited text plus a one-line status. " +
                "both additionally shows the full A/B comparison.",
            },
```

Change the argument handling to read it:

```typescript
    const args = request.params.arguments as
      | { text?: string; mode?: "default" | "both" }
      | undefined;
    const text = args?.text;
    if (typeof text !== "string") {
      return {
        isError: true,
        content: [{ type: "text", text: "missing required argument: text" }],
      };
    }
    return handlePersonifyCall(text, args?.mode === "both" ? "both" : "default");
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm --prefix mcp-server test
```

Expected: all pass, including the pre-existing tests.

- [ ] **Step 6: Build to verify types**

```bash
npm --prefix mcp-server run build
```

Expected: exit 0, no type errors.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src mcp-server/test
git commit -m "feat(mcp): add mode argument and raise the timeout for two arms

The tool took only text, leaving no way to ask for the comparison, and the
30s budget was sized for one rewrite. Two arms plus a blind review exceed it,
so every 1.0 invocation would have timed out.

mode=both appends the show-both instruction. Default behavior is unchanged."
```

---

### Task 8: Write the consolidation command

**Files:**

- Create: `commands/personify-consolidate.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: the record format from Task 6, `rules/learned.md` from Task 3.
- Produces: a slash command that proposes rule changes as a PR and never edits
  rules directly.

- [ ] **Step 1: Write commands/personify-consolidate.md**

```markdown
---
description: Read accumulated personify evidence and propose rule changes as a PR.
---

# Consolidate personify evidence

Read every record in `~/.claude/personify-evidence/`, then propose rule changes.
Propose only. Never edit a rules file directly, and never commit to main.

## Refuse to run on thin evidence

Count the records. Below 5, stop and say how many there are. One sample is an
anecdote, and a rule inferred from too few records is how these skills became
miscalibrated in two directions at once.

## What to look for

**Dead rules.** Every lettered group in `rules/taxonomy.md` that appears in no
record's `arm_a_groups`. Report each with its zero count. This is the only
signal that makes the taxonomy smaller.

**Wrong rules.** Records where `arm_a_groups` contains a group and
`reviewer_winner` is `b` and the reviewer's `WHY:` names that group's effect.
Report the group and the count.

**Shared residue.** Every `shared_residue` entry, grouped by similarity, with
counts. An entry seen once is noise. An entry seen 5 or more times across
different surfaces is a candidate rule for `rules/learned.md`.

**Arm win rate by surface.** Count `reviewer_winner` per `surface`. Report as a
table. This is what eventually answers whether dumbify can be dropped.

Weight records with `audience_assumed: true` lower when they are the only
support for a proposal, and say so in the proposal.

## Output

Open a PR against this repo containing:

- proposed edits to `rules/taxonomy.md` for dead and wrong rules
- proposed additions to `rules/learned.md` for repeated shared residue, each
  with its `Evidence:` line
- the win-rate table in the PR body, changing no file

Every proposal states its count. A proposal with no count is not a proposal.

Approve, reject, or edit each one by hand. Nothing here applies itself.

## After the PR is opened

Write the current timestamp to `~/.claude/personify-evidence/.consolidated`, so
the records just read stop counting toward the next nudge.

Do this whether or not the PR is merged. The records were read; that is what
the marker means.
```

- [ ] **Step 2: Verify the command has no ML training vocabulary**

```bash
grep -niE 'distill|fine-tune|train|teacher|student' commands/personify-consolidate.md
```

Expected: no output. The pass is called consolidation.

- [ ] **Step 3: Document the loop in README.md**

Add this section to `README.md`, before the license section:

```markdown
## How it learns

Every invocation runs two rule sets against your text: the hand-maintained
taxonomy, and current model judgment held to a short list of hard rules. A
blind reviewer picks a winner and names what both missed. The run is recorded
to `~/.claude/personify-evidence/`.

You see one line by default. Ask `show both` for the full comparison, at any
point, including a later session if you give it the timestamp.

After 25 unconsolidated records, the status line suggests
`/personify-consolidate`. That pass reads the evidence and proposes rule
changes as a PR: rules that never fire, rules that made output worse, and tells
both arms keep missing. You approve each one. Nothing edits itself.
```

- [ ] **Step 4: Verify no em dashes were introduced**

```bash
grep -c '—\|–' README.md commands/personify-consolidate.md
```

Expected: `0` for both.

- [ ] **Step 5: Commit**

```bash
git add commands/personify-consolidate.md README.md
git commit -m "feat: add /personify-consolidate

Reads accumulated records and proposes rule changes as a PR. Refuses below 5
records. Every proposal carries its count, and dead-rule removal is the only
mechanism that makes the taxonomy smaller.

Writes the .consolidated marker on completion so read records stop counting
toward the nudge."
```

---

### Task 9: Extend the regression set and CI

**Files:**

- Modify: `.github/workflows/validate.yml`
- Modify: `tests/regression/README.md`
- Modify: `tests/regression/bloated-task-description/expected.md` (rename)

**Interfaces:**

- Consumes: everything above.
- Produces: CI that runs the Python tests and asserts the harness is
  well-formed, without asserting which arm wins.

- [ ] **Step 1: Rename the fixture expectation to name its arm**

```bash
git mv tests/regression/bloated-task-description/expected.md \
       tests/regression/bloated-task-description/expected-arm-a.md
```

The existing file encodes the current taxonomy's idea of correct, so it is arm
A's expectation and not a shared target.

- [ ] **Step 2: Document why there is no arm B expectation**

Append to `tests/regression/README.md`:

```markdown
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
```

- [ ] **Step 3: Add the Python tests to CI**

Note a pre-existing bug while you are in this file: `python-version: "3.12"`
is nested under `actions/checkout`, not `actions/setup-python`, so the pin does
nothing and CI runs whatever Python the runner defaults to. Move it to the
`setup-python` step in this same commit.

After the step that runs `scripts/validate_skill.py`, add:

```yaml
      - name: Run structural tests
        run: python3 -m unittest discover -s tests -v
```

- [ ] **Step 4: Verify the whole suite locally**

```bash
python3 scripts/validate_skill.py && python3 -m unittest discover -s tests -v && npm --prefix mcp-server test
```

Expected: validator passes, Python tests pass, vitest passes.

- [ ] **Step 5: Verify no em dashes anywhere in the change**

```bash
git diff origin/main...HEAD -- '*.md' | grep '^+' | grep -c '—\|–'
```

Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/validate.yml tests/regression
git commit -m "test: run structural tests in CI, name the fixture's arm

expected.md becomes expected-arm-a.md: it encodes the taxonomy's idea of
correct and is not a shared target. Arm B gets no fixture on purpose, since
pinning model judgment freezes one model's phrasing as correct.

CI asserts the comparison is well-formed and deliberately does not assert
which arm wins."
```

---

## Self-Review

**Spec coverage.** Context probe: Task 5 step 3. Arm A: Task 1. Arm B: Task 2.
Reviewer: Task 4. Recorder: Tasks 5 and 6. Output contract and quiet default:
Task 5. Retroactive `show both`: Task 5 step 3, Task 7. `rules/learned.md`:
Task 3. Nudge: Task 5 step 3, Task 8. Consolidation: Task 8. Files table: Tasks
1 through 8. Testing: Task 9. Versioning: Task 5. No spec section is unclaimed.

**Placeholders.** None. Every code step has literal content.

**Type consistency.** `runPersonify(text, opts)` with `mode?: "default" | "both"`
is used identically in Task 7 steps 1, 3, and 4. `handlePersonifyCall(text,
mode)` matches between its definition and its call site. `TAXONOMY_PATH` in Task
1 matches its use. The reviewer's four labels in Task 4 match the fields the
record format documents in Task 6, and match what Task 8 parses.

**One known gap, stated rather than hidden.** The nudge counts unconsolidated
records, and the counting code lives in the skill's markdown rather than in a
tested script. It is the one behavior in this plan with no automated test.
Making it testable means a Python helper the skill shells out to, which is more
machinery than a count of files newer than a timestamp deserves. If it proves
unreliable in use, that is the fix.
