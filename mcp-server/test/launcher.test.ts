import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Claude Desktop starts the launcher several times at once (a probe it kills
// within milliseconds, the chat server, a shared pool). Concurrent `npm ci`
// runs in one directory delete each other's node_modules, so the launcher
// must let exactly one instance install or build. These tests run the real
// script against fake npm and node on PATH: fast, and nothing is installed.

const LAUNCHER = new URL("../bin/personify-mcp", import.meta.url).pathname;

// Fake npm: records each call, sleeps so the calls overlap, then leaves the
// files a real `npm ci` (which builds through prepare) would leave.
const FAKE_NPM = `#!/usr/bin/env bash
dir="$2"; shift 2
echo "start $*" >> "$FAKE_LOG"
sleep "\${FAKE_NPM_SLEEP:-1}"
mkdir -p "$dir/node_modules" "$dir/dist"
touch "$dir/node_modules/.package-lock.json" "$dir/dist/index.js"
echo "done $*" >> "$FAKE_LOG"
`;

// Fake node: stands in for the server by printing one line on stdout.
const FAKE_NODE = `#!/usr/bin/env bash
echo "server $1"
`;

let root: string;
let serverDir: string;
let binDir: string;
let log: string;

function writeExecutable(path: string, body: string) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function launch(env: Record<string, string> = {}) {
  const child = spawn(join(serverDir, "bin", "personify-mcp"), [], {
    env: {
      PATH: `${binDir}:/usr/bin:/bin`,
      FAKE_LOG: log,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));
  const done = new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) =>
    child.on("close", (code) => resolve({ code, stdout, stderr })),
  );
  return { child, done };
}

function npmCalls(): string[] {
  return existsSync(log)
    ? readFileSync(log, "utf8").split("\n").filter(Boolean)
    : [];
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "personify-launcher-")));
  serverDir = join(root, "mcp-server");
  binDir = join(root, "fakebin");
  log = join(root, "npm.log");
  mkdirSync(join(serverDir, "bin"), { recursive: true });
  mkdirSync(join(serverDir, "src"));
  mkdirSync(binDir);
  copyFileSync(LAUNCHER, join(serverDir, "bin", "personify-mcp"));
  chmodSync(join(serverDir, "bin", "personify-mcp"), 0o755);
  for (const f of ["package.json", "package-lock.json", "tsconfig.json"]) {
    writeFileSync(join(serverDir, f), "{}\n");
  }
  writeFileSync(join(serverDir, "src", "index.ts"), "\n");
  writeExecutable(join(binDir, "npm"), FAKE_NPM);
  writeExecutable(join(binDir, "node"), FAKE_NODE);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("bin/personify-mcp", () => {
  it("installs once when three instances start together", async () => {
    const runs = [launch(), launch(), launch()];
    const results = await Promise.all(runs.map((r) => r.done));

    expect(npmCalls()).toEqual(["start ci", "done ci"]);
    for (const r of results) {
      expect(r.code).toBe(0);
      expect(r.stdout).toBe(`server ${join(serverDir, "dist", "index.js")}\n`);
    }
    expect(existsSync(join(serverDir, ".build-lock"))).toBe(false);
  }, 20_000);

  it("takes over a lock left by a process that no longer exists", async () => {
    mkdirSync(join(serverDir, ".build-lock"));
    // The pid of a child that has already exited, so it is known to be gone.
    const gone = spawn("true");
    await new Promise((r) => gone.on("close", r));
    writeFileSync(join(serverDir, ".build-lock", "pid"), `${gone.pid}\n`);

    const { done } = launch();
    const r = await done;

    expect(r.code).toBe(0);
    expect(r.stderr).toContain("stale build lock");
    expect(npmCalls()).toEqual(["start ci", "done ci"]);
  }, 20_000);

  it("stops its npm and frees the lock when it is terminated mid-install", async () => {
    const { child, done } = launch({ FAKE_NPM_SLEEP: "5" });
    await new Promise((r) => setTimeout(r, 1_000));
    child.kill("SIGTERM");
    const r = await done;

    expect(r.code).not.toBe(0);
    expect(existsSync(join(serverDir, ".build-lock"))).toBe(false);
    // Give an orphaned npm time to finish: it must not.
    await new Promise((r) => setTimeout(r, 5_500));
    expect(npmCalls()).toEqual(["start ci"]);
  }, 20_000);

  it("skips the lock entirely when dist is current", async () => {
    mkdirSync(join(serverDir, "node_modules"));
    mkdirSync(join(serverDir, "dist"));
    writeFileSync(join(serverDir, "node_modules", ".package-lock.json"), "");
    writeFileSync(join(serverDir, "dist", "index.js"), "");

    const r = await launch().done;

    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(npmCalls()).toEqual([]);
  }, 20_000);
});
