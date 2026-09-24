# personify-mcp

MCP bridge that lets Claude Desktop run the `personify:personify` Claude
Code skill reliably. Desktop calls this server's one tool, `personify`; the
server shells out to `claude --print` to do the actual work, so Desktop
never has to load `VOICE.md` or evaluate Step 0's "treat this file as
authoritative" instruction itself.

See the parent repo's `SKILL.md` for what personify does. The bridge exists
because of [Build MCP service for Claude Desktop compatibility](https://github.com/twistedmelonman/personify/issues/23):
Desktop has, in practice, denied its own filesystem connector was present
and flagged Step 0 as injection-shaped, even when the connector was
confirmed active. Claude Code CLI does not have this problem.

## Prerequisites

- **Node.js 20.19 or later in the 20 line, or 22.12 or later.** Check with
  `node --version`. Install from [nodejs.org](https://nodejs.org) or with
  `brew install node`.
- **npm**, which ships with Node. Check with `npm --version`.
- **TypeScript.** `npm ci` installs it as a dev dependency and
  `npm run build` finds `tsc` in `node_modules/.bin`. A global `tsc` is only
  needed to run it outside `npm run build`.
- The **`claude` CLI** on `PATH`, checked with `claude --version`, with the
  `personify` plugin installed as shown under "Known costs" below. The
  bridge runs the skill through it, and "Authenticate" uses it to generate
  the OAuth token.

If `npm ci` or `npm run build` fails, run the `--version` checks above
first. A missing or too-old Node, npm, or `tsc` produces confusing
module-resolution or syntax errors rather than a clear "not found" message.

## Build

From the repo root:

```bash
cd mcp-server
npm ci
```

`npm ci` builds `dist/` through the `prepare` script, and every build clears
`dist/` first, so a source file that was deleted does not leave a stale
module behind.

Desktop does not run `dist/index.js` directly. It runs the launcher,
`bin/personify-mcp`, which rebuilds `dist/` when it is missing or older than
anything in `src/` (running `npm ci` first when `node_modules` is missing or
out of date) and then execs the server. A `git pull` therefore takes effect
on the next Desktop restart, with no manual rebuild. The launcher writes its
build output to stderr, since stdout is the MCP protocol channel; when a
build fails it prints the reason to stderr and exits non-zero, and Desktop
shows the server as failed.

## Pangram API key

Every call is checked by Pangram, so the machine needs the Pangram API key.
Desktop starts the server with a near-empty environment and no terminal, so
neither `PANGRAM_API_KEY` from your shell nor `op read` works there. The key
lives in the macOS login Keychain instead. Install it once, from a terminal
signed in to 1Password:

```bash
python3 <installPath>/scripts/pangram_check.py --install-key
```

`<installPath>` is the personify plugin's install path, listed under
`personify@personify` in `~/.claude/plugins/installed_plugins.json`. Without
1Password, add it by hand; `security` prompts for the key:

```bash
security add-generic-password -U -a "$(id -un)" -s personify-pangram-key -w
```

Before each call the bridge runs `pangram_check.py --check-key`, which makes
no network call. When no key resolves, the call fails at once with the
script's message, which names both commands above, instead of coming back
`NOT VERIFIED` after a full draft. An installed skill older than 2.0.2 does
not know the flag; the bridge then skips the preflight and behaves as bridge
0.3.0 did.

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

This opens the same browser authorization flow `/login` uses and, once you
approve it, prints a token to your terminal. The token authenticates against
your Claude subscription, whether Pro, Max, Team, or Enterprise, exactly like
your normal `claude` session does: it is not an API key, and using it does
not switch you to metered API billing.

Copy the printed token into `~/.config/personify/token`, in the format
`token.example` in this directory shows, then lock down its permissions so
only you can read it:

```bash
mkdir -p ~/.config/personify
# paste the token from "claude setup-token" into ~/.config/personify/token
chmod 600 ~/.config/personify/token
```

The server refuses to start a `claude` call if this file is missing, empty,
or has permissions looser than 600, owner read and write, or 400, owner
read-only.

If `XDG_CONFIG_HOME` is set in the environment Claude Desktop itself
launches with, not just your shell, the token is read from
`$XDG_CONFIG_HOME/personify/token` instead. GUI-launched apps on
macOS do not inherit your shell's exports; if you rely on a custom
`XDG_CONFIG_HOME`, set it explicitly via the `env` block in
`claude_desktop_config.json` rather than assuming Desktop sees your
shell's value.

To see or revoke a token you generated this way, visit
[claude.ai/settings](https://claude.ai/settings) and look under the
Claude Code section. Revocation there may not invalidate a token that
already exists:
[issue 43801 on the Claude Code tracker](https://github.com/anthropics/claude-code/issues/43801)
reports OAuth tokens still working days after revoking every Claude Code
instance on claude.ai. That report is about the VS Code extension's login,
not `setup-token` specifically. If a token stops working, or you want to be
certain it is gone, delete `~/.config/personify/token` and run
`claude setup-token` again for a fresh one.

## Configure in Claude Desktop

From `mcp-server/`, after building:

```bash
npm run install-desktop-config
```

This merges a `personify` entry into
`~/Library/Application Support/Claude/claude_desktop_config.json`, creating
the file if it does not exist yet. The entry's command is the absolute path
to this repo's `bin/personify-mcp` launcher, with no arguments. It only ever
touches the `personify` key under `mcpServers`; any other MCP servers or
settings already in that file are left exactly as they are. Running it again,
for example after moving the repo, updates the entry in place rather than
duplicating it, and it replaces an older `node .../dist/index.js` entry with
the launcher.

Fully quit and restart Desktop after the first install. Desktop reads this
file only at launch. After that, a `git pull` needs only a Desktop restart;
the launcher rebuilds whatever changed.

macOS only for now. On other platforms, add the following to
`claude_desktop_config.json` by hand instead (path varies by OS; see
[Anthropic's MCP docs](https://modelcontextprotocol.io) for where Desktop
looks for it there):

```json
{
  "mcpServers": {
    "personify": {
      "command": "/absolute/path/to/personify/mcp-server/bin/personify-mcp",
      "args": []
    }
  }
}
```

## Known costs (accepted, not engineered around)

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
| failed | the draft file is missing, or the CLI timed out, failed to spawn, or exited non-zero, or a precondition failed | `personify failed: <reason>`, plus the model's last output, fenced, when there is one | true |

The `NOT VERIFIED` line is exactly:

```text
NOT VERIFIED: Pangram did not pass this text. Review it before sending.
```

Not verified is not an error. A draft awaiting review is a normal result,
and `isError: true` tends to make the calling model retry, which would be a
second submission.

`structuredContent` carries the same result in fields, declared through the
tool's `outputSchema`: `outcome`, then `text` when verified, `report` and
`draft` when not verified, and `error` plus an optional `report` when failed,
along with `sha256`, `task_id`, and `staleness` where they apply. The text is
in both places because clients differ in which one reaches the model. In a
live Desktop call on 2026-09-23, with a structured result that held only the
outcome, Desktop's model received those fields and no content text at all, so
it had nothing to show. The structured `text` is the same bytes as the first
content block. When the result is verified, the
first content block is exactly the stamped bytes: nothing is prepended or
appended to it, or the bytes delivered would no longer be the bytes that
were stamped. This is not necessarily every byte Pangram scored, since
`pangram_check.py` strips markup such as fenced code before sending text to
Pangram. A version-staleness note, when there is one, rides in a separate
second content block and in `structuredContent.staleness`.

The tool description is conditional on the outcome and covers both forms.
For the structured form it keys on `outcome`. For the content form only the
FIRST content block matters: a second block, when there is one,
is a plugin staleness note for the user, not part of the text. When the call
did not error and that first block does not start with `NOT VERIFIED` or
`personify failed`, it is final and should be relayed exactly as returned.
Otherwise, whether the first block starts with `NOT VERIFIED` or
`personify failed`, it should be shown to the reader as returned, with
nothing in it sent, posted, or published anywhere.

Each call has a 180 s budget. If it expires before the CLI finishes, the
outcome is `failed`. The CLI's own Bash tool has a separate limit, which
follows `BASH_DEFAULT_TIMEOUT_MS` from your Claude Code settings; user-level
settings load in the spawned CLI. On the maintainer's machine that is
300000 (300 s), longer than the bridge's budget, so the bridge's 180 s fires
first and the outcome is `failed`. If your setting is shorter than 180 s,
the Bash limit can cut the check script off first; no stamp gets written
then, so the result comes back `not_verified` rather than `verified`. Even
then, stamps are content-addressed by the sha256 of the draft bytes, so if
an earlier call already produced a valid stamp for those exact bytes, a
cut-off run can still come back `verified`. That is by design, not a race:
identical bytes were already checked and passed.

## Permissions

The bridge calls `claude --print` with an allowlist of four to six rules,
depending on whether a voice guide resolves and whether it is a symlink, and
nothing else. Everything not covered by one of these rules is denied without
a prompt. Each placeholder is an absolute path, so the rule starts with
`//`, which is how Claude Code spells a filesystem-root path in a permission
rule:

- `Bash(python3 <installPath>/scripts/pangram_check.py:*)`, running the
  installed personify plugin's own check script.
- `Read(/<installPath>/**)`, the installed personify plugin's own files.
- `Read(/<voice guide path>)`, only present when a voice guide resolves.
- `Read(/<voice guide realpath>)`, only present when the voice guide is a
  symlink and its realpath differs from its path. Claude Code checks a Read
  against a symlink separately from a Read against its resolved target, so a
  symlinked guide (the usual case for `~/.config/personify/VOICE.md`) needs
  both rules.
- `Read(/<body.md realpath>)`, so the check can take the draft through a
  `< body.md` redirect. The CLI treats that redirect as a read of a file
  outside the working directory, and denies it without this rule.
- `Edit(/<body.md realpath>)`, the one draft file the skill writes to. Writes
  are granted through `Edit`, not `Write`.

There is deliberately no rule covering the personify config directory as a
whole. The only thing the skill reads there is `VOICE.md`, which is granted
above; a blanket `Read(/<configRoot>/**)` rule would also let the spawned
model read `~/.config/personify/token`, the bridge's own OAuth token, which
lives in the same directory.

User-level Claude Code settings still load in the spawned CLI. A
user-level allow rule you have configured separately (in
`~/.claude/settings.json`, for example) also applies here, on top of the
rules above; it is not sandboxed away by this allowlist.

## Manual verification checklist

Run this after any change to `mcp-server/src/`, since the automated test
suite mocks the `claude` subprocess and cannot catch real invocation drift.

`scripts/pangram_check.py` skips anything under 40 words (`WORD_FLOOR`) and
writes no stamp for a skipped check, so a short input can never come back
`verified`; every step below uses input at or above that floor.

1. Build (`npm run build`), configure Desktop per above, fully quit and
   restart Desktop (not just start a new chat: the MCP server process is
   started per Desktop launch).
2. In a **fresh** Desktop chat (no prior priming about personify), ask
   Desktop to personify a substantive paragraph of at least 40 words,
   containing at least one em dash. Use a long, substantive input beyond
   the floor where practical, since
   [personify tool leaks internal instruction preamble into its output](https://github.com/twistedmelonman/personify/issues/50)
   reproduced on long-form drafts and not on short ones.
3. Confirm the outcome matches one of these three shapes (see "What the
   tool returns" above):
   - **verified**: the reply is the edited text alone, with no em dash, no
     `NOT VERIFIED` line, and no relay instruction shown to the reader.
   - **not_verified**: the reply starts with the `NOT VERIFIED` line, then
     the model's report, then the draft in a fenced block; confirm the
     `NOT VERIFIED` label itself is visible in the Desktop UI, not silently
     swallowed or paraphrased away.
   - **failed**: the reply reads `personify failed: <reason>`, shown to
     Desktop as a tool error, not as text to relay.
   In every case, confirm Desktop calls the `personify` tool (visible in
   its tool-call UI) and that a `not_verified` or `failed` result is never
   sent, posted, or published anywhere by Desktop.
4. Repeat step 2 in a second, separate fresh Desktop session to confirm no
   session-specific priming is required.
5. Break it on purpose: temporarily rename the installed personify plugin
   directory (or unset `PATH` for `claude` in Desktop's environment) and
   confirm the tool call comes back as a visible Desktop-side error, not a
   silent pass-through of the original text.
6. Restore whatever was temporarily changed in step 5.
