import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Outcome } from "./types.js";

export const NOT_VERIFIED_LINE =
  "NOT VERIFIED: Pangram did not pass this text. Review it before sending.";

export const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    outcome: { type: "string", enum: ["verified", "not_verified", "failed"] },
    sha256: { type: "string" },
    task_id: { type: "string" },
    staleness: { type: "string" },
  },
  required: ["outcome"],
};

// A fence one backtick longer than the longest run in the draft, so a PR body
// with its own code block cannot close the fence early.
function fence(text: string): string {
  const runs = [...text.matchAll(/`+/g)].map((m) => m[0].length);
  const marker = "`".repeat(Math.max(2, ...runs) + 1);
  const body = text.endsWith("\n") ? text : `${text}\n`;
  return `${marker}\n${body}${marker}`;
}

export function formatResult(
  outcome: Outcome,
  stalenessNote: string | null,
): CallToolResult {
  const staleness = stalenessNote ? { staleness: stalenessNote } : {};
  const noteBlock = stalenessNote
    ? [{ type: "text" as const, text: stalenessNote }]
    : [];

  if (outcome.kind === "verified") {
    // The first block is exactly the stamped bytes. Nothing is appended to
    // it, or the text relayed would no longer be the text that was checked.
    return {
      isError: false,
      content: [{ type: "text", text: outcome.text }, ...noteBlock],
      structuredContent: {
        outcome: "verified",
        sha256: outcome.sha256,
        ...(outcome.taskId ? { task_id: outcome.taskId } : {}),
        ...staleness,
      },
    };
  }

  if (outcome.kind === "not_verified") {
    // Not an error: a draft awaiting review is a normal result, and isError
    // invites the calling model to retry, which would be a second submission.
    // The label is in the content on purpose, since content reaches the reader.
    return {
      isError: false,
      content: [
        {
          type: "text",
          text: `${NOT_VERIFIED_LINE}\n\n${outcome.report}\n\n${fence(outcome.draft)}`,
        },
        ...noteBlock,
      ],
      structuredContent: {
        outcome: "not_verified",
        sha256: outcome.sha256,
        ...staleness,
      },
    };
  }

  // A failed report can hold the model's whole draft, so it is fenced like
  // the not-verified draft above: without a fence it could read as final text.
  const report = outcome.report ? `\n\n${fence(outcome.report)}` : "";
  return {
    isError: true,
    content: [
      { type: "text", text: `personify failed: ${outcome.error}${report}` },
      ...noteBlock,
    ],
    structuredContent: { outcome: "failed", ...staleness },
  };
}
