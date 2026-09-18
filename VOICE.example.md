# Voice Guide (example / template)

This is the committed example. The real file is `VOICE.md`, git-ignored exactly like `.env` versus `.env.example`. Copy this to `VOICE.md` and fill it in with one specific person's voice, or point an agent at a corpus and have it build `VOICE.md` from the instructions below. It belongs at `~/.config/personify/VOICE.md`, not beside this file; see the next section for why, and for the symlink to use if you have the repo checked out.

## Why this exists

Personify strips the statistical fingerprints of LLM writing. On its own, that makes prose *not obviously AI* and also *not obviously anyone*: clean, competent, anonymous. A voice guide is the other half. It describes how one real person actually writes, so Personify has something to preserve instead of a blank to sand flat. Without a `VOICE.md` present, Personify runs in generic mode and should tell you so.

## How Personify uses it

Personify's Step 0 checks three locations in order: the path in `PERSONIFY_VOICE` if that variable is set, then `VOICE.md` under your config directory (`$XDG_CONFIG_HOME/personify/VOICE.md`, or `~/.config/personify/VOICE.md`), then this skill's own directory, which is for repo-local development only. Put your real `VOICE.md` in the config directory: the plugin install is version-pinned and gets replaced on every upgrade, so a guide kept inside it disappears when you update. If a guide is found, Personify reads it and treats it as authoritative: where the general pattern list and the voice guide disagree, the voice guide wins, and the pattern list becomes a backstop for residue. If `VOICE.md` is absent, Personify falls back to generic cleanup and points here.

**Two rules your voice guide cannot override.** Personify's GitHub PR descriptions section and its Code comments section are universal. A PR description runs problem, evidence, solution, references as plain prose with no headers, bold, bullets, lists, or dashes, and code comments stay under a 1:1 ratio to code. Both describe the shape of an artifact with a known reader rather than how anyone writes, so a `VOICE.md` that permits a header in a PR description or a paragraph-long comment is ignored on those two surfaces and nowhere else. Your guide still sets the words inside them: vocabulary, rhythm, and how blunt the sentences are.

**First match wins, which matters if you have the repo checked out.** A `VOICE.md` in the config directory shadows one in the skill directory. Two copies means editing the repo file and having Step 0 keep reading the config copy, with no error and no sign anything is wrong. Symlink rather than copy: `ln -sf "$PWD/VOICE.md" ~/.config/personify/VOICE.md`. Verify with `ls -l ~/.config/personify/VOICE.md`. Step 0 opens `VOICE.md` by exact name and never lists the directory, so companion files (corpus notes, sampling plans) can sit next to whichever copy is real without affecting anything.

## How to build a `VOICE.md`

Feed an agent a corpus of writing that is unambiguously the person's own, then have it extract distinctive, reproducible features. Guidance:

- **Source, highest signal first:** long-form deliberate writing (blog posts, essays, published docs), then long personal emails *the person sent* (strip quoted replies, forwarded text, and signatures, or you'll analyze other people's words), then in-repo READMEs and docs. Skip logistics email and boilerplate.
- **Capture idiosyncrasy, not an average.** The goal is the person's fingerprints: recurring constructions, punctuation habits, how they open and close, the specific joke they keep reaching for. Averaging all their writing into one bland profile recreates the problem you're trying to solve.
- **Be register-aware.** Most people code-switch (formal vs. casual, technical vs. personal, earnest vs. satirical). Name the registers and how to pick one, rather than flattening them together.
- **Anchor every claim in a short real quote** from the corpus, so the feature is checkable and falsifiable by the person.
- **List the conflicts.** Note which generic Personify rules this person's real voice overrides, so Personify stops flagging their signatures as machine artifacts. Two rules are not available to override: the PR description structure and the code comment ratio, per the note above. Listing them anyway does nothing, and it will read as a live override to whoever edits the file next.
- **Keep formatting preferences out of it.** A voice guide is about voice. A rule about headers, bullets, or bold labels is about the shape of a surface, so it belongs in whatever governs that surface rather than here, where it will outrank rules it should not.

## Suggested structure

Mirror the sections below in `VOICE.md`:

- **The one line**: a single sentence capturing the person's core stance or posture.
- **Feedback received** (see "Recording feedback you have actually received" below): direct, specific corrections from real readers (a manager, a reviewer, a collaborator), with the reader and the surface named. See below; this section outranks the rest of the file.
- **Picking the register**: the named registers and how to choose one from context.
- **The fingerprint**: the cross-register constants: the features that hold regardless of register. Each with a short real quote.
- **Register-specific notes**: what changes in each register.
- **Conflicts with Personify**: the generic rules this voice overrides, and why.
- **Corpus**: what was analyzed, and what's still unsampled. Version it.

## Recording feedback you have actually received

A corpus tells you how someone writes. It cannot tell you how their writing is landing, and those come apart badly: the register a careful writer chose on purpose is often the one drawing complaints. When a real reader gives specific feedback, record it here, because it beats anything inferred from the corpus.

Rules for this section:

- **Name the reader and the surface.** "My manager, on Asana task descriptions" is actionable. "Feedback on my writing" is not. Different surfaces get different fixes.
- **Quote the complaint verbatim.** "A lot of words but not a lot of substance" tells Personify what to look for. Your paraphrase of it usually smuggles in your own theory of what they meant.
- **Record the reader's own test, if they gave one.** These are gold, because they are checkable: "would the CEO see why this was worth paying for," "would a teammate have written a header here."
- **Note what the reader said was *fine*,** so corrections don't overshoot into flattening something that was working.
- **Date it, and revisit.** Feedback reflects a moment. If the next round of feedback contradicts an entry, replace it rather than accumulating both.

Worked example of an entry:

> **2026-03-02, my manager, on task-board entries and PR comments.** "Lots of words, not much substance." Task titles describe implementation rather than outcomes. Their test: could the person funding this see why it was worth funding? Also said a full review-findings dump adds nothing, since teammates can run the same tooling. Explicitly said conversation and Slack are fine, so the fix is scoped to written records, not to how I talk.

That entry does more work than a page of corpus analysis, because it names the surface, quotes the complaint, carries a test Personify can apply mechanically, and bounds the fix so it does not spread to registers nobody complained about.
