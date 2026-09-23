import { spawn } from "node:child_process";

// Long enough for the script's own Keychain (5 s) and `op read` (15 s) limits.
export const PREFLIGHT_TIMEOUT_MS = 30_000;

const EXIT_UNAVAILABLE = 5;

export type PreflightResult =
  | { kind: "ok" }
  | { kind: "missing"; error: string }
  | { kind: "skipped"; reason: string };

// Only exit 5 with the script's own JSON on stdout means "no key". An installed
// skill older than 2.0.2 rejects the flag (exit 5 with usage text on stderr and
// nothing on stdout), and an argparse-style rejection exits 2; both skip the
// preflight so the call proceeds exactly as it did before the flag existed.
export function interpretPreflight(
  code: number | null,
  stdout: string,
): PreflightResult {
  if (code === 0) return { kind: "ok" };
  if (code === EXIT_UNAVAILABLE) {
    try {
      const parsed = JSON.parse(stdout);
      if (
        parsed?.status === "UNAVAILABLE" &&
        typeof parsed.error === "string"
      ) {
        return { kind: "missing", error: parsed.error };
      }
    } catch {
      // Not the script's JSON: fall through to skip.
    }
    return { kind: "skipped", reason: "the check script predates --check-key" };
  }
  return { kind: "skipped", reason: `--check-key exited ${code}` };
}

export function checkPangramKey(
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number = PREFLIGHT_TIMEOUT_MS,
): Promise<PreflightResult> {
  return new Promise((resolve) => {
    const child = spawn("python3", [scriptPath, "--check-key"], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let settled = false;
    const finish = (result: PreflightResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ kind: "skipped", reason: "--check-key timed out" });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", () => {
      // Drained so a chatty script cannot block on a full pipe.
    });
    child.on("error", (err) =>
      finish({
        kind: "skipped",
        reason: `could not run python3: ${err.message}`,
      }),
    );
    child.on("close", (code) => finish(interpretPreflight(code, stdout)));
  });
}
