# Checks: over-commented code

Exercises the Code comments section, a universal rule. Run with and without a
voice guide loaded; the ratio and content checks must pass identically both
times.

## Ratio: the hard rule

- [ ] Comment lines do not exceed code lines. The input is 11 comment lines
      against 7 code lines, which already fails.
- [ ] The result is far below 1:1, not merely at it. One comment against 7 code
      lines is the target.

## Content

- [ ] No comment narrates the line under it. "Return the cached session,"
      "Finally, return the session we fetched," and "we look up the session in
      the cache" are all gone.
- [ ] No link survives. The wiki URL is cut.
- [ ] No comment explains why an obvious thing is obvious ("going to the
      network on every refresh would be slow").
- [ ] No "because X and Y, then Z" chains. No comment runs past one line.
- [ ] No comment addresses the reader ("we want to avoid that if at all
      possible," "Note that").

## The fact that must survive

- [ ] The 55 second TTL still has its rationale attached: the auth service
      rotates signing keys on a 60 second cycle. This is the one comment worth
      keeping, and dropping it fails the case under `rules/hard.md` rule 5.
- [ ] That rationale lives in a comment next to the `ttl=55`, not in prose
      outside the code block.
- [ ] The number stays 55. Not 60, not "about a minute."

## Never invent facts

- [ ] No comment asserts a mechanism the input did not carry. Nothing about
      thundering herds, cache stampedes, clock skew, or retry behavior.
- [ ] `user_id_for`, `CACHE`, `AUTH`, and `refresh_session` are written exactly
      as they are. No renaming.

## Code is not touched

- [ ] The code itself is unchanged. This skill edits comments, not logic. A run
      that refactors the function, reorders statements, or changes the early
      return has exceeded its scope and fails even if the comments are right.

## Docstring carve-out

- [ ] Run a variant where the leading comment block is a proper docstring
      describing the function's contract for a caller. It is reference material
      under Technical content, so the 1:1 ratio does not apply to it and it is
      not cut for length. Cutting a docstring on ratio grounds is the
      over-correction this check exists to catch.

## Voice-guide precedence

- [ ] Run with Andrew's `VOICE.md` loaded. The output is not more chatty, does
      not gain a bold label, and does not gain a dash. The voice guide sets the
      wording of the one surviving comment and nothing else.
