import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { interpretPreflight } from "../src/key-preflight.js";

const script = fileURLToPath(
  new URL("../../scripts/pangram_check.py", import.meta.url),
);

// Resolved with the inherited PATH, because the run below empties it.
const python = spawnSync(
  "python3",
  ["-c", "import sys; print(sys.executable)"],
  { encoding: "utf8" },
).stdout.trim();

// Runs the repo's real script, so the JSON the bridge parses cannot drift
// from what --check-key prints. PATH is empty so neither `op` nor `security`
// can resolve a live credential.
function runCheckKey(extraEnv: Record<string, string> = {}) {
  const home = mkdtempSync(join(tmpdir(), "preflight-contract-"));
  const emptyBin = join(home, "empty-bin");
  mkdirSync(emptyBin);
  try {
    const result = spawnSync(python, [script, "--check-key"], {
      env: { PATH: emptyBin, HOME: home, XDG_CONFIG_HOME: home, ...extraEnv },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return interpretPreflight(result.status, result.stdout);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

describe("--check-key contract with scripts/pangram_check.py", () => {
  it("reads a missing key as missing, with the install command", () => {
    const result = runCheckKey();
    expect(result.kind).toBe("missing");
    if (result.kind === "missing") {
      expect(result.error).toContain("no Pangram API key");
      expect(result.error).toContain("--install-key");
    }
  });

  it("reads a resolvable key as ok", () => {
    expect(runCheckKey({ PANGRAM_API_KEY: "sk-contract" })).toEqual({
      kind: "ok",
    });
  });
});
