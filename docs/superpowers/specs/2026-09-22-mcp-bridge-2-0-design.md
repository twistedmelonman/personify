# MCP bridge 2.0 design

Date: 2026-09-22
Status: approved in conversation, pending written review
Scope: PR3 of the Personify 2.0 sequence (`mcp-server/` only)

## The problem this solves

The Desktop bridge was built for 1.x. It spawns the Claude Code CLI, asks for
"the resulting text and nothing else," strips a preamble and a status line off
stdout, and tells Desktop the output is final. Under 2.0 that contract is
wrong in four ways:

1. The 2.0 skill ends in a Pangram check, and a result that failed the check
   is not final text. It is a draft that needs review.
2. The CLI runs with `--permission-mode auto` and no allowlist. Whether the
   check's Bash call is permitted under `--print` was never verified.
3. `mode: "both"`, `SHOW_BOTH_SUFFIX`, and `strip-status-line.ts` serve the
   1.x A/B arms, which 2.0 deleted.
4. Nothing in the bridge can tell a checked text from an unchecked one. It
   relays whatever the model printed.

Andrew's direction: bias toward independent operation, not user-mediated, and
keep the number of places where sender and receiver must agree as small as
possible.

## Rejected: the bridge runs the check itself

The first design had the bridge run `pangram_check.py` on the CLI's draft.
That needs the skill to stop before its own check when a caller says so,
which means a new documented draft-only mode in SKILL.md and a matching
instruction in the bridge. Two components kept in sync by prose, with nothing
testing the agreement. Rejected for that reason.

## Design: the skill runs the check, the bridge verifies the stamp

1. **The bridge chooses the publish file.** It creates a temp directory and
   tells the CLI that the file this text publishes from is `<tmp>/body.md`.
   SKILL.md step 2 already says to write the result to the file it will
   publish from, so the skill needs no change.
2. **The skill runs its own check, unchanged.** One submission, made where
   the skill's own rules say it is made.
3. **The bridge decides from the stamp, not from the model's words.** After
   the CLI exits, it reads the bytes of `body.md`, takes their sha256, and
   looks for `~/.config/personify/stamps/<sha256>.json`.
4. **Desktop gets the bytes of `body.md`**, never the CLI's stdout, on the
   verified path. The bytes that were checked are the bytes delivered.

The only agreement between the bridge and the skill is the stamp: the
filename is the sha256 of the raw bytes, and the content carries `verdict`
and `sha256`. That contract already exists, the script writes it, the review
gate hooks are built on it, and code checks it. If anything drifts, such as
the model editing `body.md` after the check, the hashes stop matching and the
result falls to not verified. Drift fails closed.

The cost of this design: on a non-Human result the bridge knows only that the
text is not verified. The verdict name, the flagged spans, and the skip or
outage reason come from the model's report. That text goes to manual review
either way, and the reader sees it labeled as the model's report.

## CLI invocation (measured)

Measured on 2026-09-22 against Claude Code with the installed 2.0.0 plugin,
four runs:

| Run | Change | Result |
|---|---|---|
| 1 | Prompt after `--allowedTools` | Invalid: the variadic flag consumed the prompt as a tool name. The model saw only stdin. |
| 2 | Prompt first, Bash rule only | Read of `VOICE.md` and Write of `body.md` denied. |
| 3 | Added Read rules, `Write(...)` rule | Read works, write still denied. |
| 4 | `Edit(...)` rule for the write | Works: file written, check ran once, verdict AI, no stamp. |

In every run, calls outside the allowlist were denied automatically under
`--print` with no prompt, including four environment probes and a compound
`pangram_check.py ...; echo exit=$?` command. Run 4 took 36 s and cost
$0.29 of Claude usage and $0.003 of Pangram.

The resulting argv, in this order:

```
claude --print "<instruction>" --output-format json --allowedTools \
  "Bash(python3 <installPath>/scripts/pangram_check.py:*)" \
  "Read(~/.config/personify/**)" \
  "Read(/<installPath>/**)" \
  "Read(/<realpath of ~/.config/personify/VOICE.md>)" \
  "Edit(/<tmp>/body.md)"
```

- The prompt must precede `--allowedTools`. Run 1 is the failure otherwise.
- `--permission-mode auto` is dropped. The default mode with an explicit
  allowlist is what was measured.
- Absolute paths in permission rules take a leading `/` on top of the path's
  own, so `/Users/...` becomes `//Users/...`.
- File writes are granted with `Edit(...)`. `Write(...)` did not grant them.
- The `VOICE.md` rule is resolved per call. If no guide exists the rule is
  omitted and the skill falls back to `VOICE.example.md`, which the
  `installPath` rule covers.
- `--output-format json` gives the model's final text in `result`, used only
  for the not-verified and failed reports.

The instruction names the skill, the stdin text, and the publish file, and
asks the model to write its final text there and follow the skill's check.
It does not restate any rule from SKILL.md.

## What Desktop receives

| Outcome | How the bridge knows | `content` | `isError` |
|---|---|---|---|
| verified | `body.md` exists and a stamp at `stamps/<sha256>.json` parses, has `verdict: "Human"`, and a matching `sha256` | First block: the bytes of `body.md`, nothing else | false |
| not_verified | `body.md` exists, no valid stamp | `NOT VERIFIED: Pangram did not pass this text. Review it before sending.`, then the model's report, then the draft in a fence | false |
| failed | `body.md` missing, or the CLI timed out, failed to spawn, or exited non-zero, or a precondition failed | `personify failed: <reason>`, plus the model's last output when there is one | true |

Not verified is not an error. A draft awaiting review is a normal result, and
`isError: true` tends to make the calling model retry, which would be a second
submission.

`structuredContent` carries `{ outcome, sha256?, task_id? }`, declared through
`outputSchema` (supported in `@modelcontextprotocol/sdk` 1.30.0). The `_meta`
instruction key is removed: the existing code comment records that nothing in
the SDK forwards a result's `_meta` into model context.

The tool description becomes conditional. Output with no `NOT VERIFIED` line
is final and is relayed exactly as returned. Output with that line is shown
to the reader as returned, and nothing in it is sent anywhere. The lesson
of issue #50 (content renders straight to the reader) now works for the
design: the label is meant to reach the reader.

The version staleness note moves out of the text into a second content block
and into `structuredContent`, so the first block of a verified result is
exactly the stamped bytes.

## Timeouts and failure modes

One budget, kept at 180 s. A measured call takes 30 to 40 s including the
check. The script's own worst case is about 220 s (30 polls, backoff capped
at 8 s), and the CLI's Bash tool cuts it off earlier at its 120 s default.
Every way a limit trips fails closed: the script dying leaves no stamp (not
verified), the bridge's budget expiring is failed. Claude Desktop's own MCP
call timeout is unknown, so the shipped value stays rather than a guessed
one.

Preconditions, checked in order before spawning:

1. The personify plugin is installed: `installed_plugins.json` has an entry
   and its `installPath` contains `scripts/pangram_check.py`. Otherwise failed,
   no CLI call.
2. Text is non-empty.
3. The OAuth token loads (`token.ts`, unchanged).

During and after the call:

- The temp directory is created with `mkdtemp` at mode 0700 and removed in a
  `finally` on every path.
- A stamp written after the bridge gave up is harmless: it matches bytes the
  bridge never delivered.
- A malformed stamp (unparseable, wrong verdict, mismatched sha256) counts as
  no stamp.

Known and accepted: user settings still load in the spawned CLI.
`--setting-sources` would isolate it, but `enabledPlugins` lives in user
settings and dropping them may unload the plugin itself; that was not tested.
A broad user-level allow rule could give the model a second way to run the
check. Low risk, recorded here rather than solved in PR3.

## Units

| Unit | Job | Status |
|---|---|---|
| `install-locator.ts` | Read `installed_plugins.json`, return `installPath` and the script path. `version-check.ts` reuses it. | new |
| `cli-args.ts` | Pure function building the argv above. | new |
| `stamp-verifier.ts` | Hash bytes, check the stamp, return verified or not verified. Filesystem injected. | new |
| `result-format.ts` | Outcome to `CallToolResult`: content blocks, `isError`, `structuredContent`. | new |
| `cli-runner.ts` | Spawn, timeout, temp directory lifecycle, parse `result` from the JSON output. | rewritten |
| `index.ts` | Schema without `mode`, conditional description, `outputSchema`. | rewritten |
| `strip-status-line.ts` and test | 1.x status line. | deleted |
| `strip-preamble.ts` and test | Cleaned stdout into final text. The verified path no longer reads stdout. | deleted |
| `SHOW_BOTH_SUFFIX`, `mode`, `_meta` key | 1.x A/B mode and an unread relay key. | deleted |

## Testing

All tests keep mocking `claude`. New coverage:

- argv: the prompt precedes `--allowedTools` (regression for run 1), and the
  five rules are exact.
- Stamp fixtures: valid, wrong verdict, mismatched sha256, malformed JSON,
  absent.
- The temp directory is removed on success, non-zero exit, timeout, and spawn
  error.
- A verified result's first content block equals the file bytes exactly.
- Missing plugin install fails before any spawn.

The `mcp-server` vitest job already exists in `.github/workflows/validate.yml`.
The plan's note to add one is already done.

Manual acceptance after merge: one real call through the built bridge, then
one from Claude Desktop. About $0.30 of Claude usage and $0.003 of Pangram
each.

## Versions

- `mcp-server/package.json` 0.2.0 to 0.3.0: the tool schema breaks.
- `createServer` reads its version from the package instead of the stale
  hard-coded `"0.1.0"`.
- The skill version does not change. PR3 touches no shipped skill file.
- `mcp-server/README.md` updated for the outcomes and the removed `mode`.

## Out of scope

- #72, Desktop running a stale gitignored `dist/`.
- #93, whether the skill should pass human-reading input through unchanged.
  Found during the measurement above; it changes the skill, not the bridge.
