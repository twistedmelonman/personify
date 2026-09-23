# personify-mcp

MCP bridge that lets Claude Desktop run the `personify:personify` Claude
Code skill reliably. Desktop calls this server's one tool, `personify`; the
server shells out to `claude --print` to do the actual work, so Desktop
never has to load `VOICE.md` or evaluate Step 0's "treat this file as
authoritative" instruction itself.

See the parent repo's `SKILL.md` for what personify does, and the
referenced issue (twistedmelonman/personify#23) for why this bridge exists:
Desktop has, in practice, denied its own filesystem connector was present
and flagged Step 0 as injection-shaped, even when the connector was
confirmed active. Claude Code CLI does not have this problem.

## Prerequisites

- **Node.js >= 20.19** (check with `node --version`). Install via
  [nodejs.org](https://nodejs.org) or `brew install node`.
- **npm** (bundled with Node; check with `npm --version`).
- **TypeScript compiler (`tsc`)**. `npm install` pulls in TypeScript as a
  dev dependency, and `npm run build` resolves `tsc` from
  `node_modules/.bin` automatically, so a project-local install is normally
  enough. You only need `tsc` available globally (check with
  `tsc --version`) if you invoke it directly outside of `npm run build`,
  e.g. `brew install typescript` on macOS or `npm install -g typescript`.
- The **`claude` CLI** on `PATH` (check with `claude --version`), with the
  `personify` plugin installed (see "Known costs" below). This is needed
  both to build the plugin dependency and to generate the OAuth token in
  "Authenticate."

If `npm install` or `npm run build` fail, run the three `--version` checks
above first; a missing or too-old Node/npm/tsc produces confusing
module-resolution or syntax errors rather than a clear "not found" message.

## Build

From the repo root:

```bash
cd mcp-server
npm install
npm run build
```

## Authenticate

Claude Desktop cannot use your regular `claude` login for this bridge.
`claude` normally reads your OAuth session from the macOS Keychain, and
Keychain access for that credential is restricted to process trees macOS
already trusts, like a Terminal-launched shell. Desktop launches this
server as a child of its own process, a different, untrusted process
tree, so the Keychain read is silently denied and `claude` reports it as
an expired OAuth session, even though your regular terminal `claude`
session is fine.

The fix is a separate, long-lived OAuth token scoped to this bridge only,
generated with:

```bash
claude setup-token
```

This opens a browser authorization flow (the same one `/login` uses) and,
once you approve it, prints a token to your terminal. This token
authenticates against your Claude subscription (Pro, Max, Team, or
Enterprise) exactly like your normal `claude` session does: it is not an
API key, and using it does not switch you to metered API billing.

Copy the printed token into `~/.config/personify/token` (see
`token.example` in this directory for the expected format), then lock
down its permissions so only you can read it:

```bash
mkdir -p ~/.config/personify
# paste the token from "claude setup-token" into ~/.config/personify/token
chmod 600 ~/.config/personify/token
```

The server refuses to start a `claude` call if this file is missing, empty,
or has permissions looser than 600 (owner read/write) or 400 (owner
read-only).

If `XDG_CONFIG_HOME` is set in the environment Claude Desktop itself
launches with, not just your shell, the token is read from
`$XDG_CONFIG_HOME/personify/token` instead. Note that GUI-launched apps on
macOS do not inherit your shell's exports; if you rely on a custom
`XDG_CONFIG_HOME`, set it explicitly via the `env` block in
`claude_desktop_config.json` rather than assuming Desktop sees your
shell's value.

To see or revoke a token you generated this way, visit
[claude.ai/settings](https://claude.ai/settings) and look under the
Claude Code section. Revocation there has been reported as unreliable in
some cases for already-minted `setup-token` credentials; if a token stops
working (or you want to be certain it is gone), delete
`~/.config/personify/token` and run `claude setup-token` again for a
fresh one.

## Configure in Claude Desktop

From `mcp-server/`, after building:

```bash
npm run install-desktop-config
```

This merges a `personify` entry into
`~/Library/Application Support/Claude/claude_desktop_config.json` (creating
the file if it does not exist yet), using the absolute path to this repo's
`dist/index.js`. It only ever touches the `personify` key under
`mcpServers`; any other MCP servers or settings already in that file are
left exactly as they are. Running it again (for example after moving the
repo, or to pick up a rebuilt `dist/`) safely updates the entry in place
rather than duplicating it.

Restart Desktop after running it.

macOS only for now. On other platforms, add the following to
`claude_desktop_config.json` by hand instead (path varies by OS; see
[Anthropic's MCP docs](https://modelcontextprotocol.io) for where Desktop
looks for it there):

```json
{
  "mcpServers": {
    "personify": {
      "command": "node",
      "args": ["/absolute/path/to/personify/mcp-server/dist/index.js"]
    }
  }
}
```

## Known costs (accepted, not engineered around in v1)

- Latency: each call is a cold CLI start, one model draft, and one Pangram
  check; measured at 30 to 40 s and about $0.30 of Claude usage plus $0.003
  of Pangram on 2026-09-22.
- Requires the `claude` CLI to be installed and on `PATH` for whatever user
  account runs Desktop, with the `personify` plugin installed
  (`/plugin marketplace add twistedmelonman/personify && /plugin install personify@personify`),
  and requires the OAuth token file described above under "Authenticate."

## What the tool returns

The bridge runs the `personify:personify` skill through the `claude` CLI,
then decides the outcome from the Pangram stamp the skill's own check script
writes, not from the model's report of what it did.

| Outcome | How the bridge knows | `content` | `isError` |
|---|---|---|---|
| verified | the draft file exists and a stamp at `<config root>/stamps/<sha256>.json` parses, has `verdict: "Human"`, and a matching `sha256` | First block: the bytes of the draft file, nothing else | false |
| not_verified | the draft file exists, no valid stamp | The `NOT VERIFIED` line, then the model's report, then the draft in a fence | false |
| failed | the draft file is missing, or the CLI timed out, failed to spawn, or exited non-zero, or a precondition failed | `personify failed: <reason>`, plus the model's last output when there is one | true |

The `NOT VERIFIED` line is exactly:

```text
NOT VERIFIED: Pangram did not pass this text. Review it before sending.
```

Not verified is not an error. A draft awaiting review is a normal result,
and `isError: true` tends to make the calling model retry, which would be a
second submission.

`structuredContent` carries `{ outcome, sha256?, task_id?, staleness? }`,
declared through the tool's `outputSchema`. When the result is verified, the
first content block is exactly the stamped bytes: nothing is prepended or
appended to it, or the text relayed would no longer be the text that was
checked. A version-staleness note, when there is one, rides in a separate
second content block and in `structuredContent.staleness`.

The tool description is conditional on the outcome: output with no
`NOT VERIFIED` line is final and should be relayed exactly as returned;
output with that line should be shown to the reader as returned, with
nothing in it sent, posted, or published anywhere.

Each call has a 180 s budget. If it expires before the CLI finishes, the
outcome is `failed`. The CLI's own Bash tool has a separate, shorter 120 s
default limit, which can cut the check script off before the bridge's own
budget does; when that happens no stamp gets written, so the result comes
back `not_verified` rather than `verified`, never the reverse.

## Permissions

The bridge calls `claude --print` with a six-rule allowlist and nothing
else. Everything not covered by one of these rules is denied without a
prompt. Each placeholder is an absolute path, so the rule starts with `//`,
which is how Claude Code spells a filesystem-root path in a permission rule:

- `Bash(python3 <installPath>/scripts/pangram_check.py:*)`, running the
  installed personify plugin's own check script.
- `Read(/<configRoot>/**)`, the personify config directory, including where
  the check script writes stamps.
- `Read(/<installPath>/**)`, the installed personify plugin's own files.
- `Read(/<voice guide realpath>)`, only present when a voice guide resolves.
- `Read(/<body.md realpath>)`, so the check can take the draft through a
  `< body.md` redirect. The CLI treats that redirect as a read of a file
  outside the working directory, and denies it without this rule.
- `Edit(/<body.md realpath>)`, the one draft file the skill writes to. Writes
  are granted through `Edit`, not `Write`.

## Manual verification checklist

Run this after any change to `mcp-server/src/`, since the automated test
suite mocks the `claude` subprocess and cannot catch real invocation drift:

1. Build (`npm run build`), configure Desktop per above, fully quit and
   restart Desktop (not just start a new chat: the MCP server process is
   started per Desktop launch).
2. In a **fresh** Desktop chat (no prior priming about personify), ask
   Desktop to personify a short paragraph containing at least one em dash
   and one phrase from `SKILL.md`'s pattern list (e.g. "this represents a
   pivotal shift").
3. Confirm: Desktop calls the `personify` tool (visible in its tool-call
   UI), the returned text has no em dash and no inflated-significance
   phrasing, and the result reads close to what running
   `/personify:personify` directly in a CLI session on the same input
   produces.
   Also confirm the reply starts with the edited text itself, with no relay
   instruction shown to the reader (see "What the tool returns" above). Use
   a long, substantive input, since issue #50 reproduced on long-form
   drafts and not on short ones.
4. Repeat step 2 in a second, separate fresh Desktop session to confirm no
   session-specific priming is required.
5. Break it on purpose: temporarily rename the installed personify plugin
   directory (or unset `PATH` for `claude` in Desktop's environment) and
   confirm the tool call comes back as a visible Desktop-side error, not a
   silent pass-through of the original text.
6. Restore whatever was temporarily changed in step 5.
