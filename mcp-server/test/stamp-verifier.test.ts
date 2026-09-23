import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { checkStamp, sha256Hex } from "../src/stamp-verifier.js";

const bytes = Buffer.from("Checked text.\n", "utf8");
const digest = createHash("sha256").update(bytes).digest("hex");

describe("checkStamp", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "stamps-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const write = (body: string) => writeFile(join(dir, `${digest}.json`), body);

  it("hashes raw bytes", () => {
    expect(sha256Hex(bytes)).toBe(digest);
  });

  it("verifies a Human stamp whose sha256 matches", async () => {
    await write(
      JSON.stringify({ sha256: digest, verdict: "Human", task_id: "t-1" }),
    );
    expect(await checkStamp(bytes, dir)).toEqual({
      verified: true,
      sha256: digest,
      taskId: "t-1",
    });
  });

  it("does not verify when no stamp exists", async () => {
    expect(await checkStamp(bytes, dir)).toEqual({
      verified: false,
      sha256: digest,
    });
  });

  it("does not verify a stamp with a non-Human verdict", async () => {
    await write(JSON.stringify({ sha256: digest, verdict: "AI" }));
    expect((await checkStamp(bytes, dir)).verified).toBe(false);
  });

  it("does not verify a stamp whose sha256 field disagrees with its name", async () => {
    await write(JSON.stringify({ sha256: "0".repeat(64), verdict: "Human" }));
    expect((await checkStamp(bytes, dir)).verified).toBe(false);
  });

  it("does not verify malformed JSON", async () => {
    await write("{not json");
    expect((await checkStamp(bytes, dir)).verified).toBe(false);
  });

  it("does not verify when the bytes changed after the check", async () => {
    await write(JSON.stringify({ sha256: digest, verdict: "Human" }));
    const edited = Buffer.from("Checked text.", "utf8"); // trailing newline dropped
    expect((await checkStamp(edited, dir)).verified).toBe(false);
  });
});
