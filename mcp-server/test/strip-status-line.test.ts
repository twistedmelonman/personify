import { describe, it, expect } from "vitest";
import { stripStatusLine } from "../src/strip-status-line.js";

// Verbatim from SKILL.md Process step 5, which is the format the skill emits.
const STATUS_LINE =
  "[arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22]";

// The step 5 variant that appears once unconsolidated records reach 25. It
// appends to the same line rather than emitting a second one.
const STATUS_LINE_WITH_NUDGE =
  "[arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22 · 25 unconsolidated, /personify:personify-consolidate]";

const BODY =
  "When the release pipeline runs, it fails at the assume-role step. It should be able to assume `ci-release`.\n\nGives `deploy-bot` assume-role on `ci-release`.";

describe("stripStatusLine", () => {
  it("removes the status line from the end of a result", () => {
    expect(stripStatusLine(`${BODY}\n\n${STATUS_LINE}`)).toBe(BODY);
  });

  it("removes the variant carrying the unconsolidated nudge", () => {
    expect(stripStatusLine(`${BODY}\n\n${STATUS_LINE_WITH_NUDGE}`)).toBe(BODY);
  });

  it("handles arm A as primary", () => {
    const line =
      "[arm A primary · arm B differed on 1 span · evidence: 2026-09-17T19-15-46]";
    expect(stripStatusLine(`${BODY}\n\n${line}`)).toBe(BODY);
  });

  it("strips when the line directly abuts the text", () => {
    expect(stripStatusLine(`${BODY}\n${STATUS_LINE}`)).toBe(BODY);
  });

  it("strips through trailing blank lines and whitespace", () => {
    expect(stripStatusLine(`${BODY}\n\n${STATUS_LINE}\n\n  \n`)).toBe(BODY);
  });

  it("tolerates leading and trailing whitespace on the line itself", () => {
    expect(stripStatusLine(`${BODY}\n\n   ${STATUS_LINE}   `)).toBe(BODY);
  });

  it("normalizes CRLF input", () => {
    expect(stripStatusLine(`${BODY}\r\n\r\n${STATUS_LINE}\r\n`)).toBe(BODY);
  });

  // The common case: text that never went through the two-arm harness, or a
  // result whose status line was already removed.
  it("returns text unchanged when no status line is present", () => {
    expect(stripStatusLine(BODY)).toBe(BODY);
  });

  it("returns empty for empty or whitespace-only input", () => {
    expect(stripStatusLine("")).toBe("");
    expect(stripStatusLine("   \n\n  ")).toBe("");
  });

  // A status line that is not last is the user quoting one. This repo's own
  // evidence records and its regression case files do exactly that, so a
  // mid-document match would eat content.
  it("leaves a status line that is not the last line", () => {
    const quoting = `The skill appends this:\n\n${STATUS_LINE}\n\nwhich an agent then pastes into the PR body.`;
    expect(stripStatusLine(quoting)).toBe(quoting);
  });

  // Never return empty from non-empty input: a result that is only a status
  // line means the rewrite went missing, and silently returning "" would turn
  // that into an invisible truncation at the call site.
  it("passes through a result that is only a status line", () => {
    expect(stripStatusLine(STATUS_LINE)).toBe(STATUS_LINE);
    expect(stripStatusLine(`\n${STATUS_LINE}\n`)).toBe(`\n${STATUS_LINE}`);
  });

  describe("does not strip prose that merely resembles the line", () => {
    const cases: Array<[string, string]> = [
      ["a bracketed sentence", "[This is a note I wrote in brackets.]"],
      ["brackets naming an arm without the full shape", "[arm B primary]"],
      [
        "the fields present but out of order",
        "[evidence: 2026-08-31T09-14-22 · arm B primary · arm A differed]",
      ],
      [
        "a missing evidence field",
        "[arm B primary · arm A differed on 3 spans]",
      ],
      [
        "a markdown link that happens to end the text",
        "See [the evidence record](https://example.com/arm-b-primary)",
      ],
      [
        "prose mentioning the primary arm",
        "arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22",
      ],
      [
        "an unclosed bracket",
        "[arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22",
      ],
    ];

    for (const [name, tail] of cases) {
      it(name, () => {
        const text = `${BODY}\n\n${tail}`;
        expect(stripStatusLine(text)).toBe(text);
      });
    }
  });

  // A trailing code block is content. A fenced line inside it cannot be the
  // status line, because step 5 emits the line after the text, never inside a
  // fence.
  it("leaves a fenced status line alone", () => {
    const fenced = `${BODY}\n\n\`\`\`\n${STATUS_LINE}\n\`\`\``;
    expect(stripStatusLine(fenced)).toBe(fenced);
  });
});
