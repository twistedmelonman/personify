import { describe, it, expect } from "vitest";
import { buildCliArgs, buildInstruction } from "../src/cli-args.js";

const base = {
  installPath: "/plug/2.0.0",
  configRoot: "/home/u/.config/personify",
  voiceGuidePath: "/repo/VOICE.md",
  bodyPath: "/private/tmp/p-1/body.md",
};

describe("buildCliArgs", () => {
  // Measured 2026-09-22: --allowedTools is variadic, so a prompt placed after
  // it was consumed as a tool name and the model never saw the instruction.
  it("puts the prompt before --allowedTools", () => {
    const args = buildCliArgs(base);
    expect(args.slice(0, 5)).toEqual([
      "--print",
      buildInstruction(base.bodyPath),
      "--output-format",
      "json",
      "--allowedTools",
    ]);
  });

  // Measured 2026-09-23: with only the Edit rule, the CLI wrote body.md but
  // denied the check's `< body.md` redirect, which is checked as a Read of a
  // file outside the working directory. No check ran, so no stamp.
  it("allows exactly the six measured rules", () => {
    expect(buildCliArgs(base).slice(5)).toEqual([
      "Bash(python3 /plug/2.0.0/scripts/pangram_check.py:*)",
      "Read(//home/u/.config/personify/**)",
      "Read(//plug/2.0.0/**)",
      "Read(//repo/VOICE.md)",
      "Read(//private/tmp/p-1/body.md)",
      "Edit(//private/tmp/p-1/body.md)",
    ]);
  });

  it("omits the voice guide rule when no guide resolved", () => {
    const rules = buildCliArgs({ ...base, voiceGuidePath: null }).slice(5);
    expect(rules).toHaveLength(5);
    expect(rules.some((r) => r.includes("VOICE"))).toBe(false);
  });

  it("never passes --permission-mode", () => {
    expect(buildCliArgs(base)).not.toContain("--permission-mode");
  });

  it("rejects a relative path rather than emit a rule that matches nothing", () => {
    expect(() => buildCliArgs({ ...base, bodyPath: "body.md" })).toThrow(
      /absolute/,
    );
  });
});

describe("buildInstruction", () => {
  it("names the skill and the publish file", () => {
    const text = buildInstruction("/private/tmp/p-1/body.md");
    expect(text).toContain("personify:personify");
    expect(text).toContain("/private/tmp/p-1/body.md");
  });
});
