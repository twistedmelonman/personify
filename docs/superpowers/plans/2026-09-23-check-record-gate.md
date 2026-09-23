# Check-Record Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `gate-review.sh stage` refuses any text that Pangram has not seen, and `open` shows each item's Pangram result while Andrew approves.

**Architecture:** `pangram_check.py` writes a check record (`checks/<sha256>.json`) for every result, including skips. `gate-review.sh stage` requires a record for the file's raw-bytes hash, and `open` prints each record's result into the batch header. `hook-block-gate-dir-write.sh` blocks Bash writes into `checks/` and `stamps/`.

**Tech Stack:** Python 3 stdlib + unittest (personify); Bash 5, jq, sha256sum (claude-config).

**Spec:** `docs/superpowers/specs/2026-09-23-check-record-gate-design.md`

## Global Constraints

- Record key: sha256 of the RAW file bytes. Never gate-review's `_hash`, which strips trailing whitespace.
- Record dir: `$XDG_CONFIG_HOME/personify/checks`, default `~/.config/personify/checks`; an empty `XDG_CONFIG_HOME` is treated as unset.
- Record and stamp files 0600, their directories 0700, written atomically.
- `stamps/` stays Human-only. The bridge (`mcp-server/`) does not change. Exit codes do not change.
- A run that raises (no key, API error) writes no record.
- personify version 2.0.2 to 2.0.3, in `SKILL.md` frontmatter and `.claude-plugin/plugin.json`, in lockstep.
- No em or en dashes in SKILL.md.
- Shell: shellcheck -S info clean, no disable directives, no `((var++))`.
- claude-config work happens in a git worktree. `~/.claude/scripts/*` are symlinks into the main claude-config checkout, so editing that checkout changes the live gate immediately.
- **Implementers do not commit.** Every commit message must pass Andrew's BBEdit gate, and a subagent cannot reach it. Leave changes uncommitted and report the diff; the controller batches commit messages through the gate.

## Review Focus

1. A staged file with trailing whitespace or no final newline: the record lookup must use raw bytes, so the check record written from that exact file matches. Test in Task 2.
2. A record file that is malformed JSON: `open` must still produce a header line (`UNREADABLE RECORD`) and never abort the batch. Test in Task 2.
3. `XDG_CONFIG_HOME` set but empty: both sides must fall back to `~/.config`. Test in Task 1 (Python) and Task 2 (bash).
4. A body containing a line that starts with `#` placed after the header: verdict lines must not change approved bytes. The existing `_split_batch` rule covers it; Task 2 adds a round-trip test with verdict lines present.
5. A write to the Pangram key file under `~/.config/personify/` (not `checks/` or `stamps/`): must stay allowed. Test in Task 3.

---

### Task 1: personify writes a check record for every result

**Files:**

- Modify: `scripts/pangram_check.py` (`write_stamp` around line 644; `check` around line 680; module docstring exit-code section near line 31)
- Modify: `SKILL.md` ("The check" section: the paragraph starting "On a pass the client writes a stamp"; frontmatter `version`)
- Modify: `.claude-plugin/plugin.json` (`version`)
- Test: `tests/test_pangram_check.py`

**Interfaces:**

- Produces: `write_check_record(env: dict[str, str], digest: str, record: dict) -> Path`; `check()` reports gain `record_path: str` on PASS, FAIL, Mixed, and SKIPPED. Record JSON keys: `sha256, status, verdict, fraction_ai, word_count, task_id, model, timestamp`.

- [ ] **Step 1: Write the failing tests.** Add to `tests/test_pangram_check.py`, after `HashIdentityTests`. Also add a `checks()` method to `TempConfig` next to `stamps()`:

```python
    def checks(self):
        return pathlib.Path(self.directory.name) / "personify" / "checks"
```

```python
class CheckRecordTests(unittest.TestCase):
    """Every result leaves a record, so the review gate can prove the check ran.

    The gate enforces that Pangram saw the text, not what it said, so a FAIL
    and a SKIPPED leave a record exactly as a PASS does. An error leaves none:
    nothing was learned about the text.
    """

    def setUp(self):
        self.config = TempConfig()
        self.addCleanup(self.config.cleanup)

    def run_check(self, raw, responses, env=None):
        environment = dict(self.config.env)
        if env:
            environment.update(env)
        return pangram.check(
            raw, request=Replayer(responses), env=environment, sleep=no_sleep
        )

    def read_record(self, report):
        return json.loads(
            pathlib.Path(report["record_path"]).read_text(encoding="utf-8")
        )

    def test_a_pass_writes_a_record(self):
        raw = fixture_text("human_long").encode("utf-8")
        _, report = self.run_check(raw, [fixture_json("human_long")])
        record = self.read_record(report)
        self.assertEqual(record["status"], "PASS")
        self.assertEqual(record["verdict"], "Human")
        self.assertEqual(record["sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(record["task_id"], report["task_id"])
        self.assertEqual(record["word_count"], report["word_count"])
        self.assertEqual(record["fraction_ai"], report["fraction_ai"])

    def test_a_fail_writes_a_record_and_still_no_stamp(self):
        raw = fixture_text("ai_short").encode("utf-8")
        _, report = self.run_check(raw, [fixture_json("ai_short")])
        record = self.read_record(report)
        self.assertEqual(record["status"], "FAIL")
        self.assertEqual(record["verdict"], "AI")
        self.assertFalse(self.config.stamps().exists())

    def test_a_mixed_verdict_records_as_fail_mixed(self):
        raw = fixture_text("ai_short").encode("utf-8")
        _, report = self.run_check(raw, [fixture_json("mixed_short")])
        record = self.read_record(report)
        self.assertEqual(record["status"], "FAIL")
        self.assertEqual(record["verdict"], "Mixed")

    def test_a_skip_writes_a_record_with_no_verdict(self):
        raw = fixture_text("mixed_short").encode("utf-8")
        code, report = self.run_check(raw, [fixture_json("human_long")])
        self.assertEqual(code, pangram.EXIT_SKIPPED)
        record = self.read_record(report)
        self.assertEqual(record["status"], "SKIPPED")
        self.assertIsNone(record["verdict"])
        self.assertIsNone(record["task_id"])
        self.assertEqual(record["word_count"], report["word_count"])
        self.assertFalse(self.config.stamps().exists())

    def test_an_error_writes_no_record(self):
        raw = fixture_text("ai_short").encode("utf-8")
        failing = Replayer(
            [fixture_json("ai_short")],
            post_error=pangram.TransportError("no credits", status=402),
        )
        with self.assertRaises(pangram.CheckError):
            pangram.check(
                raw, request=failing, env=dict(self.config.env), sleep=no_sleep
            )
        self.assertFalse(self.config.checks().exists())

    def test_the_record_is_named_for_the_raw_hash(self):
        # Trailing whitespace is part of the key. gate-review hashes the raw
        # staged file, so a key over stripped text would never match.
        raw = (fixture_text("ai_short") + "  \n\n").encode("utf-8")
        _, report = self.run_check(raw, [fixture_json("ai_short")])
        self.assertEqual(
            pathlib.Path(report["record_path"]).name,
            hashlib.sha256(raw).hexdigest() + ".json",
        )

    def test_records_are_private(self):
        raw = fixture_text("ai_short").encode("utf-8")
        _, report = self.run_check(raw, [fixture_json("ai_short")])
        path = pathlib.Path(report["record_path"])
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(path.parent.stat().st_mode & 0o777, 0o700)

    def test_an_empty_xdg_config_home_falls_back_to_home(self):
        with tempfile.TemporaryDirectory() as home:
            with mock.patch.dict(os.environ, {"HOME": home}):
                raw = fixture_text("mixed_short").encode("utf-8")
                _, report = pangram.check(
                    raw,
                    request=Replayer([]),
                    env={"XDG_CONFIG_HOME": ""},
                    sleep=no_sleep,
                )
                self.assertTrue(
                    report["record_path"].startswith(
                        os.path.join(home, ".config", "personify", "checks")
                    )
                )
```

`TransportError(message, status=...)` and `Replayer(..., post_error=...)` are the existing names; `TransportErrorTests.test_402_names_credits_and_does_not_retry` uses the same pattern. A 402 is not retried and surfaces as `CheckError`; if it surfaces as a different exception, assert on that one and report it.

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `python3 -m unittest tests.test_pangram_check.CheckRecordTests -v`
Expected: FAIL / ERROR with `KeyError: 'record_path'` on the record tests. The error test may already pass.

- [ ] **Step 3: Implement.** In `scripts/pangram_check.py`, split the file-writing half out of `write_stamp` so stamps and records share one private-write routine:

```python
def _write_private_json(directory: Path, digest: str, payload: dict) -> Path:
    """Write <directory>/<digest>.json at 0600 inside a 0700 directory.

    Default umask would leave the file 0644 in a 0755 directory, where any
    local process could overwrite it. The temp file is created with the narrow
    mode rather than chmod'd afterwards, so the bytes are never on disk at a
    wider mode even briefly. mkdir's `mode` argument is masked by umask and
    does nothing to an existing directory, so the chmod runs explicitly.
    """
    directory.mkdir(parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    path = directory / f"{digest}.json"
    temporary = directory / f".{digest}.json.tmp"
    body = json.dumps(payload, indent=2) + "\n"
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(body)
    os.replace(temporary, path)
    return path
```

`write_stamp` keeps its docstring's first three paragraphs (Human verdict, task_id, location), drops the fourth (now on `_write_private_json`), and its body becomes:

```python
    return _write_private_json(config_root(env) / "stamps", digest, payload)
```

Add after it:

```python
def write_check_record(env: dict[str, str], digest: str, record: dict) -> Path:
    """Record that these exact bytes were checked, whatever the result.

    The review gate's `stage` refuses a file with no record, so this is what
    proves Pangram saw the text before a person was asked to approve it. It
    proves the check ran, not that it passed: FAIL and SKIPPED are recorded
    exactly as PASS is. Only a stamp authorizes anything on its own.
    """
    return _write_private_json(config_root(env) / "checks", digest, record)
```

In `check()`, add this helper directly after the line `words = word_count(submitted)`:

```python
    def record(status: str, **fields: Any) -> str:
        entry = {
            "sha256": digest,
            "status": status,
            "verdict": None,
            "fraction_ai": None,
            "word_count": words,
            "task_id": None,
            "model": None,
            "timestamp": clock().replace(microsecond=0).isoformat(),
        }
        entry.update(fields)
        return str(write_check_record(env, digest, entry))
```

In the floor branch, build the SKIPPED report in a variable, add `report["record_path"] = record("SKIPPED")`, and return it. After the classified `report` dict is built, and before the `if verdict == "Human":` block, add:

```python
    report["record_path"] = record(
        report["status"],
        verdict=verdict,
        fraction_ai=report["fraction_ai"],
        task_id=task_id,
        model=model,
    )
```

In the module docstring's exit-code list, add one line after the list: `Every result (0, 2, 3, 4) also writes a check record to checks/<sha256>.json; 5 writes none.`

- [ ] **Step 4: Run the full suite.**

Run: `python3 -m unittest discover -s tests -v`
Expected: all pass, including the existing stamp tests unchanged.

- [ ] **Step 5: Update SKILL.md and the version.** Replace the paragraph in "The check" that begins "On a pass the client writes a stamp" and ends "a reason to act on." with:

```markdown
Every run that reaches a result, pass, fail, or skip, writes a check record to
`~/.config/personify/checks/<sha256>.json`. The review gate's `stage` step
refuses a file that has no record, so the check must run on the exact bytes
being staged before anyone is asked to approve them, and the batch header shows
each item's result while the reviewer reads. The gate enforces that the check
ran, not what it said: a failing verdict still reaches the reviewer, as a
reason to act. On a pass the client also writes a stamp to
`~/.config/personify/stamps/<sha256>.json` carrying the task id, the model, the
verdict, and the word count, and the Desktop bridge decides from that stamp. A
run that ends UNAVAILABLE writes neither, so the file cannot be staged until a
check succeeds.
```

Set `version: 2.0.3` in SKILL.md frontmatter and `"version": "2.0.3"` in `.claude-plugin/plugin.json`.

- [ ] **Step 6: Validate.**

Run: `python3 scripts/validate_skill.py && python3 -m unittest discover -s tests -v && grep -c '[—–]' SKILL.md`
Expected: validator OK, tests pass, dash count unchanged from before this task (it must not rise).

- [ ] **Step 7: Stop without committing.** Report `git -C /Users/andrewrich/Developer/personify diff --stat` and the test counts.

---

### Task 2: gate-review requires a record at stage and shows results at open

Work in a claude-config worktree, for example `git -C /Users/andrewrich/Developer/claude-config worktree add /Users/andrewrich/Developer/claude-config/.claude/worktrees/check-record-gate -b claude/feat-check-record-gate-b17b13e6`. All paths below are relative to that worktree.

**Files:**

- Modify: `scripts/gate-review.sh` (`_cmd_stage` line 80; `_cmd_open` header block near line 105; usage comment at top)
- Test: `scripts/tests/test-gate-review-approval.sh`

**Interfaces:**

- Consumes: record JSON from Task 1 (`status`, `verdict`, `fraction_ai`, `word_count`).
- Produces: `_checks_dir`, `_raw_sha <file>`, `_record_path <file>`, `_verdict_line <name> <file>`.

- [ ] **Step 1: Write the failing tests.** Append to `scripts/tests/test-gate-review-approval.sh` before the final `echo "--- ${pass} passed..."` line:

```bash
# --- check records: stage requires one, open shows it -----------------------

export XDG_CONFIG_HOME="${TMP}/xdg"
CHECKS="${XDG_CONFIG_HOME}/personify/checks"
mkdir -p "${CHECKS}"

_seed_record() {
  local file="$1" json="$2" sha
  sha="$(sha256sum "${file}" | cut -d' ' -f1)"
  printf '%s\n' "${json}" >"${CHECKS}/${sha}.json"
}

UNCHECKED="${TMP}/unchecked.txt"
printf 'fix(x): nobody ran the check on this\n' >"${UNCHECKED}"
rm -f "${PENDING:?}"/*
if (_cmd_stage unchecked "${UNCHECKED}") >/dev/null 2>&1; then
  _no "stage refuses a file with no check record"
else
  _ok "stage refuses a file with no check record"
fi
if [[ ! -e "${PENDING}/unchecked" ]]; then
  _ok "a refused stage leaves nothing pending"
else
  _no "a refused stage leaves nothing pending"
fi

CHECKED="${TMP}/checked.txt"
printf 'fix(x): trailing whitespace is part of the key   \n\n' >"${CHECKED}"
_seed_record "${CHECKED}" '{"status":"FAIL","verdict":"AI","fraction_ai":1.0,"word_count":212}'
if (_cmd_stage checked "${CHECKED}") >/dev/null 2>&1 && cmp -s "${CHECKED}" "${PENDING}/checked"; then
  _ok "stage accepts a FAIL record keyed by the raw bytes"
else
  _no "stage accepts a FAIL record keyed by the raw bytes"
fi

if [[ "$(_verdict_line checked "${CHECKED}")" == "# checked: FAIL (AI, fraction_ai 1.0, 212 words)" ]]; then
  _ok "verdict line for a classified record"
else
  _no "verdict line for a classified record: $(_verdict_line checked "${CHECKED}")"
fi

SHORT="${TMP}/short.txt"
printf 'fix(x): short\n' >"${SHORT}"
_seed_record "${SHORT}" '{"status":"SKIPPED","verdict":null,"fraction_ai":null,"word_count":2}'
if [[ "$(_verdict_line short "${SHORT}")" == "# short: SKIPPED (2 words, under the floor)" ]]; then
  _ok "verdict line for a skipped record"
else
  _no "verdict line for a skipped record: $(_verdict_line short "${SHORT}")"
fi

if [[ "$(_verdict_line unchecked "${UNCHECKED}")" == "# unchecked: NO RECORD" ]]; then
  _ok "verdict line when the record is gone"
else
  _no "verdict line when the record is gone"
fi

BROKEN="${TMP}/broken.txt"
printf 'fix(x): record is not json\n' >"${BROKEN}"
_seed_record "${BROKEN}" 'not json {'
if [[ "$(_verdict_line broken "${BROKEN}")" == "# broken: UNREADABLE RECORD" ]]; then
  _ok "verdict line for a malformed record"
else
  _no "verdict line for a malformed record"
fi

# An empty XDG_CONFIG_HOME falls back to ~/.config, as pangram_check.py does.
if [[ "$(XDG_CONFIG_HOME='' _checks_dir)" == "${HOME}/.config/personify/checks" ]]; then
  _ok "empty XDG_CONFIG_HOME falls back to ~/.config"
else
  _no "empty XDG_CONFIG_HOME falls back to ~/.config"
fi

# Verdict lines sit in the framing header and must not reach approved bytes.
V="${TMP}/v.txt"
printf 'fix(v): body under a verdict header\n' >"${V}"
rm -f "${APPROVED:?}"/*
{
  echo "# STATUS: APPROVED"
  echo "# PANGRAM (proof the check ran; the verdict is information):"
  echo "# item-v: FAIL (AI, fraction_ai 1.0, 212 words)"
  echo "# BATCH: vh"
  echo ""
  echo "=== item-v ==="
  cat "${V}"
} >"${GATE_REVIEW_DIR}/batch.txt"
_split_batch "${GATE_REVIEW_DIR}/batch.txt" vh >/dev/null 2>&1
if _cmd_check "${V}"; then
  _ok "verdict header lines leave approved bytes unchanged"
else
  _no "verdict header lines leave approved bytes unchanged"
fi
```

- [ ] **Step 2: Run to verify failure.**

Run: `bash scripts/tests/test-gate-review-approval.sh`
Expected: the new stage-refusal and verdict-line cases FAIL (`_verdict_line: command not found`); older cases still PASS.

- [ ] **Step 3: Implement.** In `scripts/gate-review.sh`, add these functions after `_hash()` (they must sit after `_die()` so the test's `_load` picks them up):

```bash
# Where personify's pangram_check.py records every result. Mirrors its
# config_root: an empty XDG_CONFIG_HOME falls through to ~/.config. Computed
# per call, not at load, so a test can point it at a fixture dir.
_checks_dir() {
  printf '%s/personify/checks' "${XDG_CONFIG_HOME:-${HOME}/.config}"
}

# The record key is the sha256 of the RAW bytes, which is what the check hashed
# from stdin. Not _hash: stripping trailing whitespace here would miss every
# record for a file that ends in a blank line.
_raw_sha() {
  sha256sum "$1" | cut -d' ' -f1
}

_record_path() {
  printf '%s/%s.json' "$(_checks_dir)" "$(_raw_sha "$1")"
}

# One header line per item. Never fails: a missing or unreadable record is
# shown, not fatal, because stage already enforced that the check ran.
_verdict_line() {
  local name="$1" file="$2" record line
  record="$(_record_path "${file}")"
  if [[ ! -f "${record}" ]]; then
    printf '# %s: NO RECORD\n' "${name}"
    return 0
  fi
  if line="$(jq -er --arg n "${name}" '
      if .status == "SKIPPED"
      then "# \($n): SKIPPED (\(.word_count) words, under the floor)"
      else "# \($n): \(.status) (\(.verdict), fraction_ai \(.fraction_ai), \(.word_count) words)"
      end' "${record}" 2>/dev/null)"; then
    printf '%s\n' "${line}"
  else
    printf '# %s: UNREADABLE RECORD\n' "${name}"
  fi
}
```

Replace `_cmd_stage` with:

```bash
_cmd_stage() {
  local name="$1" file="$2"
  [[ -f "${file}" ]] || _die "no such file: ${file}"
  [[ "${name}" =~ ^[A-Za-z0-9._-]+$ ]] || _die "bad artifact name: ${name}"
  # The reviewer should see what Pangram said before approving, so a text the
  # check never saw is not staged. Any result counts, FAIL and SKIPPED
  # included: this proves the check ran, it does not require a pass.
  if [[ ! -f "$(_record_path "${file}")" ]]; then
    {
      echo "gate-review: no Pangram check record for ${file}."
      echo "gate-review: run the personify check on this exact file, then stage again:"
      echo "gate-review:   python3 <personify skill dir>/scripts/pangram_check.py < ${file}"
      echo "gate-review: PASS, FAIL, and SKIPPED all leave a record; an error does not."
    } >&2
    exit 1
  fi
  cp "${file}" "${PENDING}/${name}"
  printf 'staged: %s\n' "${name}"
}
```

In `_cmd_open`, inside the header block, directly after the `echo "# REVIEW THESE ${count} ITEM(S), EDIT FREELY."` line and its following `echo "#"`, insert:

```bash
    echo "# PANGRAM (proof the check ran; the verdict is information):"
    for f in "${PENDING}"/*; do
      _verdict_line "${f##*/}" "${f}"
    done
    echo "#"
```

Update the usage comment at the top: `gate-review.sh stage <name> <file>   queue one artifact for review (needs a Pangram check record)`.

- [ ] **Step 4: Run the tests and shellcheck.**

Run: `bash scripts/tests/test-gate-review-approval.sh && shellcheck -S info scripts/gate-review.sh scripts/tests/test-gate-review-approval.sh`
Expected: all PASS, `0 failed`, no shellcheck output.

- [ ] **Step 5: Stop without committing.** Report `git diff --stat` in the worktree and the pass/fail counts.

---

### Task 3: dir-write hook blocks Bash writes into checks/ and stamps/

Same claude-config worktree as Task 2.

**Files:**

- Modify: `scripts/hook-block-gate-dir-write.sh` (`_dirs` near line 43; header comment list; deny message)
- Test: `scripts/tests/test-gate-matcher.sh`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing tests.** In `scripts/tests/test-gate-matcher.sh`, append to the "writes into the lock dirs must BLOCK" block (after the `batch.txt is a gate file too` case):

```bash
_case "${DIRWRITE}" "redirect into personify checks" \
  "$(_b64 "echo '{}' > ${HOME}/.config/personify/checks/abc.json")" 2
_case "${DIRWRITE}" "cp into personify checks" \
  "$(_b64 "cp /tmp/x ${HOME}/.config/personify/checks/abc.json")" 2
_case "${DIRWRITE}" "tee into personify stamps" \
  "$(_b64 "echo x | tee ${HOME}/.config/personify/stamps/abc.json")" 2
_case "${DIRWRITE}" "tilde-spelled redirect into personify checks" \
  "$(_b64 "echo x > ~/.config/personify/checks/abc.json")" 2
```

Append to the "READS must ALLOW" block (after `unrelated cp`):

```bash
_case "${DIRWRITE}" "cat a check record" \
  "$(_b64 "cat ${HOME}/.config/personify/checks/abc.json")" 0
_case "${DIRWRITE}" "the check itself names no record path" \
  "$(_b64 'python3 /x/scripts/pangram_check.py < /tmp/body.md')" 0
_case "${DIRWRITE}" "the key file beside checks/ stays writable" \
  "$(_b64 "chmod 600 ${HOME}/.config/personify/pangram-key")" 0
```

- [ ] **Step 2: Run to verify failure.**

Run: `bash scripts/tests/test-gate-matcher.sh`
Expected: the four new BLOCK cases FAIL with `got 0 want 2`; everything else PASS.

- [ ] **Step 3: Implement.** In `scripts/hook-block-gate-dir-write.sh`:

```bash
_dirs='(\.claude/(merge-locks|gate-review)/|\.config/personify/(checks|stamps)/)'
```

Add `~/.config/personify/checks/` and `~/.config/personify/stamps/` to the header comment's directory list, noting they hold Pangram check records and Human stamps, and that the rest of `~/.config/personify/` (the key file) stays writable on purpose. In the deny message, change the line `echo 'merge-locks/ and gate-review/ hold decisions only Andrew makes. An'` and the line after it to:

```bash
  echo 'merge-locks/ and gate-review/ hold decisions only Andrew makes, and'
  echo 'personify checks/ and stamps/ hold what Pangram said. An agent that'
  echo 'can write them can approve its own text or forge a check, which is'
  echo 'what these directories exist to prevent.'
```

and delete the old third line (`echo 'which is the single thing both locks exist to prevent.'`).

- [ ] **Step 4: Run the tests and shellcheck.**

Run: `bash scripts/tests/test-gate-matcher.sh && shellcheck -S info scripts/hook-block-gate-dir-write.sh scripts/tests/test-gate-matcher.sh`
Expected: all PASS, no shellcheck output.

- [ ] **Step 5: Run the full claude-config suite.**

Run: `for t in scripts/tests/test-*.sh; do bash "$t" >/dev/null 2>&1 || echo "FAILED: $t"; done`
Expected: no `FAILED:` lines. For any failure, re-run that file on a clean main checkout first; a failure that also occurs there is pre-existing, report it rather than fix it.

- [ ] **Step 6: Stop without committing.** Report `git diff --stat` and counts.

---

## Controller steps (not for subagents)

1. personify: run the check on each commit message, stage the messages, `gate-review.sh open` once for the whole batch, commit the spec and plan together with Task 1, push, open the PR, monitor CI, merge on a lock, and run `/plugin update personify` on this machine.
2. claude-config: commit Tasks 2 and 3 in the worktree, push, open the PR, and monitor CI. Merge only after step 1's plugin update, then pull main in `/Users/andrewrich/Developer/claude-config`.
3. Tell Andrew that the work machine needs the plugin update before it pulls claude-config.
