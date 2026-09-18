import { spawn } from "node:child_process";
import type { CliResult } from "./types.js";
import { loadOAuthToken } from "./token.js";
import { stripCliPreamble } from "./strip-preamble.js";
import { stripStatusLine } from "./strip-status-line.js";

export const PERSONIFY_INSTRUCTION =
  "Run the personify:personify skill on the text provided via stdin. Your " +
  "entire response must be the resulting text and nothing else. Do not " +
  "explain what register the text is, do not state which rules you are " +
  "applying, do not announce what you are about to do, and do not introduce " +
  'the result with a line like "Here\'s the rewrite:". Start your response ' +
  "with the first character of the edited text. No preamble, no commentary, " +
  "no trailing notes, no markdown code fence around it.";

// Two arms plus a blind review, not one rewrite. The old 30s budget was sized
// for a single pass and times out on nearly every 1.0 invocation.
export const DEFAULT_TIMEOUT_MS = 180_000;

export const SHOW_BOTH_SUFFIX =
  " After producing the result, show both arms: the full comparison with " +
  "context, each arm's reported rules, the A to B diff, and the reviewer " +
  "verdict.";

export async function runPersonify(
  text: string,
  opts: {
    timeoutMs?: number;
    tokenPath?: string;
    mode?: "default" | "both";
  } = {},
): Promise<CliResult> {
  if (text.trim().length === 0) {
    return { ok: false, error: "no text provided" };
  }

  const tokenResult = await loadOAuthToken({ tokenPath: opts.tokenPath });
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const instruction =
      opts.mode === "both"
        ? PERSONIFY_INSTRUCTION + SHOW_BOTH_SUFFIX
        : PERSONIFY_INSTRUCTION;
    const child = spawn(
      "claude",
      ["--print", "--permission-mode", "auto", instruction],
      {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: tokenResult.token },
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      const killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      killTimer.unref();
      resolve({
        ok: false,
        error: `personify CLI call timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        error: `failed to spawn claude CLI: ${err.message}`,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        // "both" mode asked for the full comparison, so its status line and
        // arm reports are the requested payload rather than exhaust. Only the
        // default mode returns text a caller pastes somewhere else.
        const body = stripCliPreamble(stdout);
        resolve({
          ok: true,
          text: opts.mode === "both" ? body : stripStatusLine(body),
        });
      } else {
        resolve({
          ok: false,
          error: `personify CLI exited with exit code ${code}: ${stderr.trim() || stdout.trim()}`,
        });
      }
    });

    child.stdin?.on("error", () => {
      // Swallow EPIPE: the child exited before draining stdin. The real
      // outcome is reported by the close/error handlers above.
    });
    child.stdin?.write(text);
    child.stdin?.end();
  });
}
