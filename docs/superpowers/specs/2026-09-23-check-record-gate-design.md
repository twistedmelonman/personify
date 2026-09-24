# Check-record gate: prove Pangram saw publish text

Date: 2026-09-23
Scope: twistedmelonman/personify (`scripts/pangram_check.py`, SKILL.md) and
twistedmelonman/claude-config (`scripts/gate-review.sh`,
`scripts/hook-block-gate-dir-write.sh`). Two PRs, personify first.

This is the hook the detector-client commit (#90) called "the hook that comes
in PR5". It is narrower than that note implied: it does not require a Human
verdict.

## Goal

Every commit message, PR body, and issue body an agent publishes over the
visual approval gate has been submitted to Pangram first, and Andrew sees the
result while he approves it. The gate enforces that the check ran. It does not
enforce the verdict. Andrew's APPROVED stays the final call.

Why not require Human: Claude-assisted prose scores AI 1.0, and editing does
not move the verdict (measured; see the #90 commit message). A Human-only gate
would block nearly every agent-drafted body over 40 words, with no path to
unblock it except Andrew rewriting the text himself.

## Decisions

1. The gate proves the check ran; it does not require a Human verdict.
2. Enforcement is at `gate-review.sh stage`, not at commit time. Andrew's
   edits in BBEdit change the bytes after the check. Checking at stage means
   those edits need no re-check, and the commit hook does not change.
3. Forgery protection is the existing dir-write hook, extended to cover
   `~/.config/personify/checks/` and `stamps/`. This matches the accepted stance for merge-locks
   and gate-review: a forcing function, not a cryptographic lock. No network
   call at stage. The check-record lookup honors `XDG_CONFIG_HOME`, so an
   agent that sets that variable to a directory it controls can write a check
   record the hook never sees and bypass it that way. This is the same class
   as the existing `GATE_REVIEW_DIR` override, and it is accepted for the
   same reason.

## personify changes

`pangram_check.py` writes a check record for every run that reaches a result:

- Path: `<config_root>/checks/<sha256>.json`, where `config_root` is the
  existing function (`$XDG_CONFIG_HOME/personify`, default
  `~/.config/personify`) and the sha256 is over the raw stdin bytes, the same
  key the stamps use.
- Written by the same atomic, 0600-file, 0700-directory routine as
  `write_stamp`. Factor the shared part out rather than duplicate it.
- Fields: `sha256`, `status` (`PASS`, `FAIL`, or `SKIPPED`), `verdict`,
  `fraction_ai`, `word_count`, `task_id`, `model`, `timestamp`. A SKIPPED
  record carries `sha256`, `status`, `word_count`, `timestamp`; the others are
  null. A Mixed verdict is `status: FAIL`, `verdict: Mixed`, matching the
  report.
- A run that ends in an error (no key, API unavailable, bad response) writes
  no record.

Unchanged: `stamps/` stays Human-only; the bridge and `stamp-verifier.ts` do
not change; exit codes do not change.

SKILL.md "The check" states that every run leaves a record and that
`gate-review stage` refuses text without one. Version 2.0.2 to 2.0.3 in
SKILL.md and `.claude-plugin/plugin.json`.

Tests (`tests/test_pangram_check.py`, injected transport, no network): a record
is written for PASS, FAIL, Mixed, and SKIPPED; none on error; file 0600 and
directory 0700; a FAIL run still writes no stamp; the record key equals the
raw-bytes hash.

## claude-config changes

`gate-review.sh stage <name> <file>`:

- Hash the file's raw bytes with `sha256sum`. Not `_hash`, which strips
  trailing whitespace and would never match the record key.
- Look up `${XDG_CONFIG_HOME:-$HOME/.config}/personify/checks/<sha>.json`.
  Treat an empty `XDG_CONFIG_HOME` as unset, as `config_root` does.
- No record: exit 1, stage nothing, and print the command to run:
  `python3 <plugin>/scripts/pangram_check.py < <absolute file>`.
- A record of any status is accepted.

`gate-review.sh open`: the framing header gets one line per pending item,
read from that item's record, for example:

```
# commit-msg: FAIL (AI, fraction_ai 1.00, 212 words)
# pr-body: SKIPPED (31 words, under the floor)
```

These are `#` lines above the first `=== name ===`, which `_split_batch`
already strips, so approved bytes do not change. A pending item whose record
has disappeared since stage shows `NO RECORD`; open does not block on it,
because stage already enforced the check.

`hook-block-gate-dir-write.sh`: add `~/.config/personify/checks/` and
`~/.config/personify/stamps/` to the write-blocked directories, both the
literal-home and `~` spellings. Not the whole `personify/` directory: the
Pangram key file lives there, and writing it from Bash must stay possible.
Reads pass.
`pangram_check.py` writes from inside Python, so its command line never names
the path and is not blocked.

Not changed: `hook-block-personify.sh`, `gate-review.sh check`, approval
semantics.

Tests: extend `scripts/tests/test-gate-review-approval.sh` for stage refusing
without a record, stage succeeding with one, the raw-bytes key (a file with
trailing whitespace), and header verdict lines leaving approved bytes intact.
Add dir-write cases for `echo >`, `cp`, and `tee` into
`~/.config/personify/checks/`, plus a read that must pass. Set
`XDG_CONFIG_HOME` to a temp dir in tests.

## Rollout

1. Merge personify, then `/plugin update` on each machine so records exist.
2. Merge claude-config after that. In the other order every stage fails until
   the plugin updates.
3. The work machine needs the plugin update before it pulls claude-config.

## Out of scope

Re-verifying a record's `task_id` against Pangram; any Human-verdict
requirement; the approved-count bug (claude-config#565).
