import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

const { checkPangramKey, interpretPreflight } =
  await import("../src/key-preflight.js");

function makeFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

const missing = JSON.stringify({
  status: "UNAVAILABLE",
  error: "no Pangram API key found. Install it with --install-key.",
});

beforeEach(() => spawnMock.mockReset());

describe("interpretPreflight", () => {
  it("passes on exit 0", () => {
    expect(interpretPreflight(0, '{"status":"KEY_OK"}')).toEqual({
      kind: "ok",
    });
  });

  it("reports the script's message on exit 5 with its JSON", () => {
    expect(interpretPreflight(5, missing)).toEqual({
      kind: "missing",
      error: "no Pangram API key found. Install it with --install-key.",
    });
  });

  // 2.0.1 and earlier reject any argument with exit 5, usage on stderr, and
  // an empty stdout. That is not a missing key.
  it("skips on exit 5 without the script's JSON", () => {
    expect(interpretPreflight(5, "").kind).toBe("skipped");
    expect(interpretPreflight(5, '{"status":"PASS"}').kind).toBe("skipped");
  });

  it("skips on an argparse rejection (exit 2)", () => {
    expect(interpretPreflight(2, "").kind).toBe("skipped");
  });

  it("skips when the process was killed (null code)", () => {
    expect(interpretPreflight(null, "").kind).toBe("skipped");
  });
});

describe("checkPangramKey", () => {
  it("runs python3 on the script with --check-key and no stdin", async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const env = { PATH: "/usr/bin" };
    const promise = checkPangramKey("/install/scripts/pangram_check.py", env);
    const [cmd, args, opts] = spawnMock.mock.calls[0];
    expect(cmd).toBe("python3");
    expect(args).toEqual(["/install/scripts/pangram_check.py", "--check-key"]);
    expect(opts).toMatchObject({
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    child.stdout.emit("data", Buffer.from('{"status":"KEY_OK"}'));
    child.emit("close", 0);
    expect(await promise).toEqual({ kind: "ok" });
  });

  it("returns missing with the message when no key resolves", async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = checkPangramKey("/s.py", {});
    child.stdout.emit("data", Buffer.from(missing));
    child.stderr.emit("data", Buffer.from("pangram_check: no key"));
    child.emit("close", 5);
    expect(await promise).toMatchObject({ kind: "missing" });
  });

  it("skips when python3 cannot be spawned", async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = checkPangramKey("/s.py", {});
    child.emit("error", new Error("ENOENT"));
    expect(await promise).toMatchObject({ kind: "skipped" });
  });

  it("kills the child and skips on timeout", async () => {
    vi.useFakeTimers();
    try {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      const promise = checkPangramKey("/s.py", {}, 1000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await promise).toMatchObject({ kind: "skipped" });
      expect(child.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
