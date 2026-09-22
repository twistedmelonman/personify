// Process step 5 of the skill appends a status line after the rewritten text:
//
//     [arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22]
//
// That line is presentation for a person reading the result in a terminal. It
// is not part of the text. An agent calling this bridge on the way to
// `gh pr create` pastes whatever comes back into the PR body, so the line ends
// up in the PR, where it means nothing to a reviewer and reads as tool exhaust
// (twistedmelonman/personify#86).
//
// This is the same class of leak as strip-preamble.ts and a much easier case.
// The preamble strip has to tell "so I'll apply the voice guide's rules" from
// someone writing about writing, and gets it wrong in both directions if the
// pattern is loosened. This line has a fixed shape, sits on the last line, and
// carries a bracket at each end, so an anchored match has no plausible false
// positive against prose.
//
// Not suppressed at the source. Step 5 keeps emitting the line, because a
// person running /personify in a terminal wants it: it names the primary arm
// and the evidence record to pass to `show both`. The MCP boundary is the
// programmatic one, so that is where the line comes off.

// Both required fields, in order, with the separator the skill uses. Matching
// the whole shape rather than a leading "[arm" keeps a bracketed sentence in
// the user's own text from qualifying.
//
// Tolerances, each for a real reason:
//   - Either arm letter, since the primary is whichever the reviewer picked.
//   - The middle field's wording is not pinned. It is prose the model writes
//     ("arm A differed on 3 spans"), and pinning it would fail open on a
//     rewording, which is the wrong direction for a strip.
//   - Any trailing fields after the evidence timestamp, which is how the
//     unconsolidated nudge arrives: "· 25 unconsolidated, /personify:...".
//   - Optional surrounding whitespace and an optional trailing newline.
//
// The timestamp is matched by shape, not validated as a date. A malformed one
// is still the status line and still should not reach a PR body.
const STATUS_LINE =
  /^[ \t]*\[[ \t]*arm [AB] primary[ \t]*·[^\]\n]*·[ \t]*evidence:[ \t]*[0-9T:-]+[^\]\n]*\][ \t]*$/;

/**
 * Remove the step 5 status line from the end of a personify result.
 *
 * Only the last non-empty line is a candidate, and only when the whole line
 * matches. A status line mid-document is not a status line: it is the user
 * quoting one, which happens in this repo's own evidence records.
 *
 * Returns the text unchanged when no status line is present, which is the
 * common case for text that never went through the two-arm harness.
 */
export function stripStatusLine(text: string): string {
  if (text.trim().length === 0) return "";

  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // Walk back over trailing blank lines to find the last line with content.
  let last = lines.length - 1;
  while (last >= 0 && lines[last].trim().length === 0) last -= 1;
  if (last < 0) return "";

  if (!STATUS_LINE.test(lines[last])) return text.trimEnd();

  // Never return empty. A result that is only a status line means the rewrite
  // itself went missing, and handing back "" turns that into a silent
  // truncation at the call site. Passing it through keeps the failure visible.
  const remaining = lines.slice(0, last).join("\n").trim();
  if (remaining.length === 0) return text.trimEnd();

  return remaining;
}
