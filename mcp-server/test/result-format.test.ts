import { describe, it, expect } from "vitest";
import { formatResult, NOT_VERIFIED_LINE } from "../src/result-format.js";

const sha = "a".repeat(64);

describe("formatResult", () => {
  it("returns only the verified bytes in the first block", () => {
    const r = formatResult(
      { kind: "verified", text: "Final.\n", sha256: sha, taskId: "t" },
      null,
    );
    expect(r.isError).toBe(false);
    expect(r.content).toEqual([{ type: "text", text: "Final.\n" }]);
    expect(r.structuredContent).toEqual({
      outcome: "verified",
      sha256: sha,
      task_id: "t",
    });
  });

  it("puts the staleness note in its own block, never in the verified text", () => {
    const r = formatResult(
      { kind: "verified", text: "Final.", sha256: sha },
      "[update available]",
    );
    expect(r.content[0]).toEqual({ type: "text", text: "Final." });
    expect(r.content[1]).toEqual({ type: "text", text: "[update available]" });
    expect(r.structuredContent).toMatchObject({
      staleness: "[update available]",
    });
  });

  it("labels a not-verified draft and keeps it out of isError", () => {
    const r = formatResult(
      {
        kind: "not_verified",
        draft: "Draft.",
        sha256: sha,
        report: "Verdict AI.",
      },
      null,
    );
    expect(r.isError).toBe(false);
    const text = r.content[0].text as string;
    expect(text.startsWith(NOT_VERIFIED_LINE)).toBe(true);
    expect(text).toContain("Verdict AI.");
    expect(text).toContain("```\nDraft.\n```");
    expect(r.structuredContent).toEqual({
      outcome: "not_verified",
      sha256: sha,
    });
  });

  it("fences a draft that contains its own code fence with a longer fence", () => {
    const draft = "Body.\n\n```sh\nnpm test\n```\n";
    const r = formatResult(
      { kind: "not_verified", draft, sha256: sha, report: "r" },
      null,
    );
    const text = r.content[0].text as string;
    expect(text).toContain("````\n" + draft + "````");
  });

  it("reports a failure as a tool error with the model's output when present", () => {
    const r = formatResult(
      { kind: "failed", error: "timed out", report: "partial" },
      null,
    );
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("personify failed: timed out\n\npartial");
    expect(r.structuredContent).toEqual({ outcome: "failed" });
  });

  it("reports a failure without a report", () => {
    const r = formatResult({ kind: "failed", error: "no text provided" }, null);
    expect(r.content[0].text).toBe("personify failed: no text provided");
  });
});
