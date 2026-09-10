---
name: personify
version: 1.1.0
description: Strip AI-writing tells from prose before sending, publishing, or shipping it. Use when editing text (emails, docs, comments, PRs, blog drafts, essays) someone else will read. Compresses wordy phrasing, puts a person back in impersonal sentences, and reframes implementation detail as outcomes a non-expert reader can see the value in. Covers task boards and PR comments, not just prose. Reads an optional per-user voice guide (VOICE.md) and treats it as authoritative, so output sounds like a specific person rather than generically clean. Derivative of blader/humanizer (MIT); see license field.
license: MIT (derivative of blader/humanizer; see Provenance)
---

# Personify

Edit text to remove the statistical fingerprints of LLM writing, without flattening it into voiceless "clean" prose. Two failure modes to avoid equally: leaving AI tells in, and over-correcting into generic dryness that has no writer behind it.

## Step 0: Load the voice guide first

Before applying anything below, you MUST actually check disk for the voice guide with a real tool call (Read, or `ls` via Bash). Do not infer its presence or absence from conversation context, memory, or a prior turn. Check these locations in order and use the first that exists:

1. The path in the `PERSONIFY_VOICE` environment variable, if set.
2. `VOICE.md` under the user's config directory: `$XDG_CONFIG_HOME/personify/VOICE.md`, or `~/.config/personify/VOICE.md` when `XDG_CONFIG_HOME` is unset.
3. `VOICE.md` in this skill's own directory (repo-local development only).

Read only the first hit; do not merge two guides. If a guide exists at both 2 and 3, the config copy wins and the skill-directory copy is dead weight that will drift. Tell the user, naming both paths and suggesting a symlink, since silent staleness is the usual outcome: edits land in the repo copy while this skill keeps loading the config one.

Never state that a voice guide is "missing," "not configured," or "not found" without having just run a tool call against that exact path in this turn. If you have not made that call yet, make it before saying anything about voice-guide status.

If a voice guide is found, read it fully and treat it as authoritative. It describes one specific person's writing. Where it conflicts with any rule in this skill, the voice guide wins; the pattern groups in `rules/taxonomy.md` and the hard rules in `rules/hard.md` are only a backstop for residue it doesn't address.

If no voice guide is found, read `VOICE.example.md` (in this skill's directory) for what one looks like and how to build it. Without a voice guide this skill makes text non-robotic but not distinctive: clean, competent, anonymous. Proceed with the general rules and say so, so the user knows a voice guide is what turns "not obviously AI" into "sounds like them."

The voice guide is personal and never committed (git-ignored, like `.env`). It lives at a stable path outside the plugin install on purpose: the plugin installs into a version-pinned directory that is replaced on every upgrade, so a guide kept inside the install would be lost on each update. The committed `VOICE.example.md` documents the structure without containing anyone's voice.

## Process

Step 0 above still runs first. The voice guide reaches both arms.

### 1. Probe the context

Determine four things before rewriting anything. Infer first. Ask only when a
wrong answer would change the output.

- Surface. A PR URL means a PR comment. A repo with a branch and a diff means a
  PR description. Headers and length suggest a document. Ask only when two
  surfaces with different registers are equally likely.
- Audience. Own repo means a familiar teammate, which is the default. A public
  repo issue reply means a stranger. The voice guide may name recurring people.
  Ask only when the text addresses someone by name you have no read on.
- Thread. Run `gh pr view --comments` or `gh issue view --comments` when a URL
  or number is present. Never ask. If it is unavailable, record it as absent
  and continue.
- Project. Read the working directory, its CLAUDE.md, and its README. Never ask.

Record every inferred value, and mark assumed ones as assumed. A recorded wrong
assumption is better than a question that makes this tool annoying enough to
stop using.

These `gh` calls are read-only. Never post, comment, or modify.

### 2. Run both arms on the same text

Every `rules/` and `reviewer/` path in this file is relative to this skill's
own directory, the one holding this SKILL.md, never to the user's working
directory. The plugin installs into a version-pinned directory, and the text
being edited usually lives in some other repo entirely, so resolving these
against the working directory looks for rule files in the user's project and
finds nothing.

Arm A reads `rules/taxonomy.md` and `rules/learned.md`. It reports which
lettered groups it applied.

Arm B reads `rules/hard.md` and `rules/learned.md`. It must not read
`rules/taxonomy.md`. It reports what it removed in plain description, never by
letter.

Both receive identical context and the same voice guide. Neither sees the
other's output.

Run each arm as its own subagent, with its own context. This is not an
optimization, it is what makes arm B's isolation real. Reading a file puts its
content in context, and no instruction can make a model unread it, so an arm B
that shares a context with arm A has already seen the taxonomy whatever this
file says. One context per arm is the only version of "must not read
`rules/taxonomy.md`" that holds.

Each arm's subagent gets: the text, the context block from step 1, the voice
guide, and the paths to its own rule files. Not the other arm's rule files, and
not the other arm's output.

### 3. Review

Run `reviewer/PROMPT.md` with the context and both candidates, labeled 1 and 2,
without saying which arm produced which. Assign the labels by a real coin flip,
not by choosing: run `python3 -c "import secrets; print(secrets.randbelow(2))"`
and give arm A label 1 when it prints 0, label 2 when it prints 1. A model
asked to "pick randomly" settles into a fixed assignment, which is the position
bias this is meant to remove. Record which arm got which label in the evidence
record.

Send the reviewer the two rewritten texts and the context. Nothing else. In
particular, do NOT send it either arm's report of what it applied: arm A
reports lettered groups such as "V, W, Z" and arm B reports plain descriptions,
so those reports identify the arms on sight and defeat the randomization. The
reports go into the evidence record, which the reviewer does not read.

### 4. Record before showing anything

Write the run to `~/.claude/personify-evidence/YYYY-MM-DDTHH-MM-SS.md` before
displaying output. Create that directory if it does not exist. The time uses
hyphens rather than colons because a colon is not portable in a filename.

`docs/evidence-format.md` defines what goes in the file and is required
reading before writing one. In short: YAML frontmatter carrying the fields
consolidation counts, then five verbatim sections holding the input, each arm's
output, the reviewer's four lines, and the user's own text when it is captured.
Record `arm_a_label`, which says whether the reviewer saw arm A as candidate 1
or 2, because without it a winning label cannot be traced back to an arm.

The record is what `show both` reads later, so it must exist by the time the
user sees the result.

### 5. Show the quiet default

The primary arm is whichever one the reviewer picked. Output that arm's text.
On a tie, output arm A's text and name arm A as primary, so the default favors
the rule set that is already in use and a tie never silently advances the new
one.

Name the primary arm in the status line by the letter it actually was, not by
copying the example below.

Output the winning text, then one line:

    [arm B primary · arm A differed on 3 spans · evidence: 2026-08-31T09-14-22]

Show the full comparison instead when the user asked for it, when the reviewer
reported low confidence, or when the arms differ on more than a third of their
spans. A span here is a sentence: split each arm's output on sentence
boundaries, and count a sentence as differing when it is not character-for-
character identical to the sentence at the same position in the other arm's
output. When the two outputs have different sentence counts, use the longer
count as the denominator, since a dropped or added sentence is itself a
difference.

The full comparison carries five things, in this order: the context block from
step 1, each arm's own report of what it applied, both texts, the diff from arm
A to arm B, and the reviewer's verdict with the shared residue it named.

    CONTEXT  surface: PR review comment · audience: teammate, familiar
             thread: 4 prior comments, disagreement about retry logic
             project: personify

    ARM A                              ARM B
    applied: V, W, Z                   removed: two hedges, a header
                                       nobody asked for, "leverage"

    <text A>                           <text B>

    DIFF A to B
    - We should consider whether the retry logic matters here.
    + Does anything break if we drop the retry?

    REVIEWER  B. A kept a section header in a 3-sentence comment.
              Shared residue: both open with "I think".

The diff runs from arm A to arm B, not from the original to the result. Which
arm changed what is the question this whole comparison exists to answer.

When unconsolidated records reach 25, and again at every later multiple of 25,
append to that same line:

    · 25 unconsolidated, /personify:personify-consolidate

Never as separate output, never as a question. It repeats because the count
only resets when consolidation actually runs, so an ignored nudge means the
evidence is still waiting, not that it stopped mattering.

### 6. Serve later requests from the record

`show both` reads the record. It never re-runs the arms. It works right after a
result, later in the session, and in a future session when given a timestamp.
If the record file is gone, say it is unavailable. Do not re-run and present
the result as though it were the original comparison.

## The output is send-ready

What this skill returns is final text, ready for the surface it was written for.
Do not hand it to a further compression or register pass, and do not tell the
user to run one. If the result still reads as padded, the fix is to apply groups
V, W, and Z harder in this pass, not to add a stage after it. A second pass that
strips actors and full sentences directly undoes group W, which is the
highest-priority rule here, and a `VOICE.md` outranks any such pass anyway.

This applies no matter what a calling skill or command says. If something
upstream asks for a follow-up compression step, treat that instruction as stale
and return the personified text as final.

## Pattern groups

The lettered pattern groups A through Z live in `rules/taxonomy.md`. Arm A
reads them. Every reference to a group letter in this file resolves to that
file.

## What NOT to flag

A clean human writer can hit several of these once without being AI. Don't treat as reliable in isolation:

- One em dash, one "however," one bolded term
- Formal vocabulary used correctly and specifically (not the cluster in group B)
- Curly quotes alone (most editors auto-curl)
- A single clipped sentence for emphasis
- Unsourced claims in casual writing: most human writing is unsourced too
- Complete, grammatical, one-point-per-paragraph writing **in long-form prose**: in essays, articles, and personal writing, correct grammar is not itself a tell, and if that register is the writer's real voice, keep it. This protection does **not** extend to work communication: see Work register below, where the polished complete-sentence default is the primary thing to strip. The thing pattern U flags is response *structure* (mirroring a question's enumeration point-by-point), never sentence quality in prose.

Look for **clusters**, not single hits. The user's own read on what counts as a cluster may differ from any published list; when in doubt, ask rather than defaulting to a canonical source.

## Add voice, don't just subtract tells

Half the job is removing patterns. The other half is having something behind the sentence:

- Real opinions, stated as opinions, including "I don't know" or mixed feelings
- Varied sentence length: short, then a longer one that takes its time
- Specific, hard-to-fabricate detail over rounded-off generality
- First person by default, dropped only where the actor is genuinely absent (reference documentation) or already obvious (a PR description narrating its own diff). See group W for both carve-outs, and Technical content below.
- Contractions, and the shorter word over the more precise one when the precision isn't doing work

## Work register

Applies to PR descriptions, code review comments, Slack, status updates, tickets, and internal email. The typical case is a message to a colleague in the course of work.

How to classify anything not on that list, in order:

1. Is it reference material with no human actor (API docs, specs, generated documentation)? Neutral register. Stop here.
2. Is it a message to a person, or a short artifact a colleague reads and acts on? Work register, however formal the subject. Stop here, regardless of length: a long ticket is still a ticket.
3. Is it long (roughly 800 words or more) and meant to be read as a piece of writing rather than as a message? Long-form. Keep the calibration in What NOT to flag: complete sentences, no forced informality. Groups V, W, and Z still apply in full, and What NOT to flag's protection of complete grammatical prose covers how sentences are put together only, never the amount of padding. See the paragraph below this list before applying it.
4. Still ambiguous? Ask which register the user wants rather than guessing. Getting this wrong is expensive in both directions.

Step 3 exempts a text from forced informality. It does not exempt it from groups V, W, and Z. Length is not evidence that the words are doing work: a 4000-word design doc can carry a 400-word idea, and the long-form classification is about how sentences are built and about register, never about the ratio of words to ideas. Run the V test (is the idea smaller than the word count?), the W test (who did this, and are they in the sentence?), and the Z test (could the person paying for this see why it was worth paying for?) on long-form text exactly as hard as on a Slack message. What changes at step 3 is that the compressed result keeps complete sentences and standard capitalization. What does not change is how much gets cut.

This is the loophole worth watching for, because it is the one that lets the original complaint back in. A padded status update classified as a message gets compressed. The same padding inside a long document can pass as "that register is just formal," and formal is precisely how the polished-but-empty writing reads.

The two axes are audience and length, and they come apart. A company blog post is work by purpose but long-form by nature, so it takes classification step 3 above. A long design doc is the same: work-register vocabulary and first person, but complete sentences rather than lowercase fragments, because nobody skims a 4000-word architecture doc the way they skim Slack. A README sits between reference and message; if it explains decisions and tradeoffs, it takes the first person, and if it only documents an interface, it goes neutral. External email to a customer or vendor is work register with the informality dialed back: contractions and first person yes, lowercase starts and fragments no.

The premise: a careful writer's natural work register is polished, complete, evenly hedged, and impersonal, and that register is now indistinguishable from model output. Grammatical polish is not the goal here. Sounding like a specific tired person typing between meetings is the goal. Bias hard toward informal and short. When a rewrite feels too blunt or too casual, it is probably right.

Compression removes words. It never adds specificity. This is the failure mode of everything above: rewriting toward how you'd say it out loud pulls hard toward concrete mechanism, and concrete mechanism is often exactly what the source didn't have. "the invalidation logic may be the source of the stale reads" compresses to "cache invalidation was the cause," not to "cache invalidation was dropping the wrong keys." The second is punchier, sounds more human, and asserts something nobody established. If the vague version is what you know, ship the vague version short (never invent facts: `rules/hard.md`, rule 3).

Write for a reader with no context. This is the rule that cuts hardest against the instinct to make a permanent record precise and technical. Task boards, milestones, and status updates get read by people who were not in the conversation, do not know the codebase, and are deciding whether the work was worth funding. Precision aimed at a peer reads as opacity to them, and opacity reads as either padding or as text nobody thought about. Assume the reader knows the goal and nothing about the implementation. Group Z is the pattern this produces when it goes wrong.

Bias toward ASD-STE100. Simplified Technical English is the controlled-language standard aerospace uses for maintenance manuals, and its instincts are the right ones here: one meaning per word, one topic per sentence, active voice, present tense where it works, and the simple approved word rather than a synonym reaching for variety. Use, not utilize. Start, not initiate. Before, not prior to. Avoid noun clusters longer than three words. Keep articles; dropping them is the fragment habit above, not this rule.

The half of STE that matters most here is the ban on metaphor. A controlled language forbids figurative usage because a reader must not have to work out which sense is meant, and the group B metaphor ban is the same rule. Bias away from flowery, expansive, or self-aggrandizing description of your own work: the word that makes a change sound consequential is almost never the word that says what the change does.

Where STE and accuracy conflict, accuracy wins. Do not simplify a statement into something vague or untrue, and do not rewrite a technical term, command name, file path, flag, or quoted output. Those are exempt and get written exactly as they are.

The floor: blunt is the target, curt is not. Cutting hedges and softeners is the job. Cutting so far that a reader hears hostility or dismissal is a different failure, and it is not fixed by adding the hedges back. It is fixed by keeping the sentence short and the tone neutral.

Defaults, which override the general guidance elsewhere in this skill:

- Fragments are fine. Sentences without subjects are fine. Lowercase sentence starts are fine where the team does that. This applies to messages, not to long documents reached by classification step 3 above, which keep complete sentences while still taking the first person and the compression.
- Contractions always. "don't," "can't," "it's," "I'd." Never "do not" or "cannot" unless the emphasis is real.
- First person, always, per group W. "I checked," "I'd rather," "I don't know."
- No parenthetical asides, per group O. If it carries a fact, promote it into the sentence as a clause; otherwise it's gone.
- One hedge maximum per message, and only for real uncertainty. Delete "I think it might possibly," "it seems like," "arguably," "to some extent."
- No transition words doing structural work: "moreover," "furthermore," "additionally," "notably," "that said" as a reflex.
- Drop framing that sets up a point instead of making it: "in this section we'll cover," "to understand this, it helps to first," "just to give some context."
- Cut a subordinate clause if it only restates or hedges the clause it's attached to.
- Use a list when the content is genuinely a list (steps, findings, changes). Don't force prose into a list, or a list into prose.
- Skip the greeting and the sign-off in short internal messages. Start with the content.

What survives compression, and this is not negotiable: names, numbers, file paths, error text, technical caveats, and anything a reader would act on. What gets cut: hedges, qualifiers, restatements, throat-clearing, defensive completeness, and softening. Losing nuance is acceptable here. Losing a fact is not (never invent facts: `rules/hard.md`, rule 3).

Worked example, a status update:

Before:

> I wanted to provide a quick update on the caching work. After performing an analysis of the current implementation, it was determined that the invalidation logic may potentially be the source of the stale reads we've been observing. I've implemented a fix for this in #412, though it's worth noting that there could be additional edge cases we haven't yet identified, as testing so far has been limited to the read path. Please don't hesitate to reach out if you have any questions.

After:

> I found the stale reads: cache invalidation was the cause, fixed in #412. there might be more edge cases since I only tested the read path.

Every fact survives: the cause, the PR number, and the caveat that only the read path was tested. Gone: the update-about-an-update opener, the nominalization ("performing an analysis of" becomes the verb "found"), the passive with no actor ("it was determined" becomes "I found"), the hedge stack ("may potentially" becomes a single "might"), the "worth noting," and the sign-off.

Two things the rewrite does besides cutting. It starts with the finding instead of announcing that a finding is coming. And it connects clauses with a colon and "since" rather than stacking three bare declaratives, because compression is not a license for parataxis (group X). "found the stale reads. cache invalidation was wrong. only tested the read path." would be shorter and worse: it loses the causal link and reads as generated in a different way.

## Technical content

Reference documentation, API docs, and published specs keep a neutral register: there is no actor to name, so group W's first-person rule doesn't apply. Everything else technical follows Work register above.

Even here, cut words, not content. Keep every fact, caveat, and detail the original covers. The target is the same information in fewer words.

## GitHub PR descriptions and review comments

A specific failure mode within technical content: unearned structure and defensive completeness, rather than flowery prose. None of the pattern groups in `rules/taxonomy.md` catch it, because the sentences themselves can be plain. What reads as AI-generated here is ceremony: headers a one-line change doesn't need, and a rundown of tests that don't apply that nobody asked about.

- **Size the description to the diff.** A one-line, self-explanatory change gets a one-line description. Headers ("Summary," "Testing," "Impact") are earned by a PR that actually spans multiple files or concerns and needs navigation, not a default template.
- **State what and why. Never how.** The diff is the how. If the description restates what the code already shows, cut it.
- **No inflated stakes on routine changes.** "grants the service account the permissions it needs" beats "a critical step in modernizing our access architecture." Say the plain thing.
- **Match the local register.** If the team's PRs run to fragments and lowercase starts, that's the norm, not a lapse. Don't upgrade a one-line change into a complete, formally punctuated paragraph out of reflex.
- **Label review-comment severity explicitly.** "Nit:" / "Optional:" / "FYI:" instead of diplomatic hedging that leaves the reader guessing whether something is blocking.
- **Say the one thing you concluded, not everything a review surfaced.** Your teammates can run the same automated review you can, so a comprehensive findings dump adds nothing they couldn't generate themselves, and it reads as generated precisely because it is what an automated tool produces. Value comes from judgment: which finding actually matters here, and what you think should happen. One considered comment beats eight correct ones. If you reviewed with a tool, that's fine, but what you post should be the conclusion you reached after reading it, in your words.
- **No chatbot sign-offs.** Cut "let me know if you have questions," "happy to adjust," "hope this helps." If there's a real open question, ask it directly and stop there.
- **Code blocks for exact output.** Terminal output, error messages, and diffs go in a code block verbatim, never paraphrased into prose.
- **One paragraph is usually the ceiling for "why."** Plenty of real, substantial PRs ship with no written description beyond the title. Default to letting the title and diff carry the load; add prose only when a reviewer would otherwise be confused.

Worked example, a small IAM permissions change:

Before (defensive completeness, unearned headers):

> ## Security-critical access delta
>
> This grants the `deploy-bot` service account `sts:AssumeRole` on the `ci-release` role and adds it to that role's trust policy. This is a narrow, existing-role grant to a single named principal, not a new role or broadened trust.
>
> ## Validation
>
> No `modules/iam_role` changes, so no test suite applies. No policy coverage applies to this path, so no targeted policy-check run. Reviewed the diff directly; no plan/apply run, per repo guardrails.
>
> This PR is ready to merge upon approval.

After (matches the team's actual register):
> gives `deploy-bot` assume-role on `ci-release` so the new release pipeline can run. `terraform fmt` clean, nothing manual after merge.

Everything true in the original survives. What's cut: the header ceremony, and the enumeration of checks that don't apply. If a reviewer would ask "did you check X," answer it inline when asked, don't pre-empt every possible question in the description.

Note what the rewrite does beyond cutting. The parenthetical aside became a subordinate clause carrying the same fact ("so the new release pipeline can run"). Group O bans the parenthetical construction, not the information: the reason this grant exists is a fact a reviewer needs, so it gets promoted into the sentence rather than deleted. Had the aside been color rather than fact, it would be gone entirely. Two short clauses got connected instead of stacked, per group X. The first person is optional here and only here: a PR description whose subject is the diff itself can lead with the verb, since the author is unambiguous from the PR metadata. The moment the description carries a judgment ("I'd rather do X," "I'm not sure this covers Y"), group W applies in full and the "I" goes back in.

## Task boards and project trackers

Asana, Jira, Linear, and anything else leadership scrolls through. The failure here is not prose quality at all, so none of the pattern groups except Z will catch it. What gets flagged as AI-written on a task board is usually a title that describes implementation, a description dense with components, and a granularity that logs keystrokes rather than outcomes.

- **Titles are declarative end states.** The thing that is true when the task is done: "ingest trial is deployed and processing records," not "trial instance deployed" and not "work on ingest." A title that does not name its subject fails even when its description explains everything, because the board view shows titles.
- **One task per outcome, not per step.** A milestone-level task spanning a week and a half beats eight one-day tasks tracking the steps inside it. Use subtasks for your own checklist: they collapse out of the board view, so they give you granular progress tracking without turning the timeline into noise.
- **Set start dates, not just due dates.** A task with only an end date renders as a single day on a timeline, which misrepresents a week of work. Shift both ends as reality moves, including pulling the end date out when something takes longer. The board is a record of what happened, not a commitment you failed to hit.
- **Never log an event as a task.** "So-and-so asked about pairing" is something that happened to you. "Paired with so-and-so on the auth patch" is work you did. If you did not do it, it does not go on the board.
- **Descriptions answer why, not what.** The title says what. The description says what it enables and what it unblocks. A list of components (bucket, metadata store, single pod) belongs in the RFC or the PR, not here.
- **Apply the funding test from group Z to every title.** Could the person paying for this see why it was worth paying for?

Worked example, a data-ingest task:

Before, title and description:

> trial instance deployed
>
> Ingest glue for the staging bucket, flat-file index, no managed DB for a trial, single container deployment. Matches the layout two other services already use. Config only, no application source in this repo.

After:

> ingest trial is deployed and processing records
>
> Proves we can ingest one source end to end, so we can decide whether to extend it to the rest. Config only, no application source here. Single container, staging bucket, flat-file index instead of a managed DB, since it's a trial.

The title now names its subject and states an end state, and it is the same length as the one it replaces. The description leads with what the work proves and what it unblocks, then keeps the implementation choices in one clause at the end where a curious reader still finds them.

What the rewrite does not do is invent. "So we can decide whether to extend it" restates what a trial is for, not a roadmap claim about which source comes next: the original did not say, so neither does the rewrite. The only fact dropped is "matches the layout two other services already use," which is reviewer reassurance rather than a fact about the outcome, and belongs in the PR if anywhere. Everything else moves rather than disappears.

## Provenance

This skill started as a fork-in-spirit of [blader/humanizer](https://github.com/blader/humanizer) (MIT license), which is itself built on Wikipedia's "Signs of AI writing" guide (WikiProject AI Cleanup). Credit to Blader for the original taxonomy and the draft -> audit -> rewrite process this skill still follows. This is a from-scratch rewrite rather than a literal fork, kept independent on purpose: Andrew wants a list that reflects his own read of what sounds AI-generated, updated on his own schedule, rather than tracking someone else's repo.

Pattern groups E through K were added after close reading of specific pieces flagged as bad examples in conversation with Claude: a viral essay dense with rhetorical-hinge writing. Pattern groups R and S were added after reading a skilled human writer's advice newsletter whose polish leans hard on techniques that double as classic model tells: dense aphorism, mood-named section headers, one metaphor stretched across the whole piece. Pattern group T was added from a GitHub issue flagging a specific sentence that named its own importance rather than earning it. Pattern group U and the GitHub PR descriptions and review comments section were added after a colleague flagged Andrew's PR descriptions and review comments as reading AI-generated; close comparison against real team PRs on the same repo showed the tell wasn't prose-level at all, it was unearned section headers, defensive "here's what I didn't test and why" writeups nobody asked for, and, separately, a habit of answering multi-part questions by mirroring their enumeration point-by-point. Sources kept off the record intentionally; the patterns are what matter, not the byline.

Pattern groups V through Y, the Work register section, and the expanded vocabulary in group B were added after feedback that Andrew's writing read as AI-generated in cases where no model output was involved at all. The diagnosis: a natural technical register that's polished, complete, evenly hedged, and impersonal, which is now the model default. Groups X and Y, the extended group B vocabulary, and the plain-text formatting rules in group O draw on [jalaalrd/anti-ai-slop-writing](https://github.com/jalaalrd/anti-ai-slop-writing) (MIT), rewritten to fit this skill's cluster-based calibration rather than its hard banned-word framing. Groups V and W are not from that repo; they were named by Andrew as the two patterns that matter most, and they carry the highest priority in this skill. That change also inverted this skill's earlier stance protecting complete grammatical prose in work contexts, which is why What NOT to flag and group U now scope that protection to long-form writing only. The register-classification list in Work register came out of adversarial review of that change: the first draft defined scope by enumerating work formats and long-form formats, which left most real inputs (company blog posts, long design docs, READMEs, external email) unclassified and let the model pick a branch arbitrarily.

Group Z, the Task boards section, the "write for a reader with no context" rule, and the review-comment guidance about saying one thing rather than dumping findings all came from closer review of that feedback, which corrected the diagnosis. The actual complaint was "a lot of words but not a lot of substance," and the test given was whether the person paying for the work could see why it was worth paying for, which is a complaint about what the writing is about rather than how it is phrased. Compression and de-abstraction (groups V and W) are real fixes but they do not touch it: a shorter list of implementation components is still a list of implementation components. Most of the flagged examples were task titles and descriptions rather than prose, and the feedback explicitly said the direct conversational register was fine, which is why the fixes here are scoped to written records. Group S (emotional-arc section headers) was folded into H (self-narrating structure), which it already cross-referenced as the same tell, to free a letter for Z; the groups after it each moved back one letter accordingly, so the old U through Z are now T through Y.

The group B metaphor ban, the hyphenated-coinage list, and the ASD-STE100 bias in Work register came from [The load-bearing vocabulary of Claude](https://louisabraham.github.io/load-bearing/), which clusters the vocabulary of 47,464 GitHub pull requests scraped since January 2025. One of its eight clusters appears in 2026 and reaches 45% of human-attributed PRs, and its top words by lift are load-bearing at 123 times the corpus rate, then quietly, survived, latent, genuine, seam, genuinely, ladder, carries, pre-fix, byte-identical. That ranking is evidence about frequency, not a ban list: it is dominated by ordinary technical English (bytes, median, four, green) and by shop jargon that is simply what the corpus is about (subagent, harness, worktree), and importing it wholesale would flatten exactly the writing What NOT to flag protects. What got taken is the top tier of it, split by whether the substitution loses anything. The structural metaphors are banned because naming the mechanism is always available and always better. The adverbs and the coinages stay weighted because each has a use where it is the accurate word. Andrew's own read set that line, per this file's standing rule that his judgment is the source of truth rather than any external list.

Groups V, W, and Z carry a regression set in `tests/regression/`, added as a standing guardrail so they don't quietly lose priority to the easier-to-spot stylistic groups. Run it on any commit that touches a pattern group, the Process steps, Work register, or Task boards. The cases are judged by hand rather than diffed, and the set exists because these three groups trace to the actual complaint (a lot of words but not a lot of substance) while the stylistic groups are the ones a future edit will naturally optimize for, since they are easy to verify.

Note for future edits: `scripts/validate_skill.py` requires pattern-group headings to run A, B, C with no gaps, so Z is the last available letter and the taxonomy is now full. The intended path for a twenty-seventh pattern is to merge related groups rather than extend the scheme to AA: several groups already overlap heavily (H and S both cover self-narration, A and K both cover inflation, N and Z both cover boosterism), and consolidating them would free letters while making the list easier to apply. Extending the validator to AA/AB is the fallback if merging would lose a distinction worth keeping.

This file does not track upstream version changes. Andrew's own judgment on what reads as AI-generated is the source of truth here, not the Wikipedia list or any third-party repo; extend or edit pattern groups directly as new tells get spotted.

## Staying current

This pattern list keeps growing as new AI-writing tells get flagged. If it has been a while since you last pulled this skill, check <https://github.com/smartwatermelon/personify> for newer pattern groups worth picking up. This is a suggestion, not an auto-update: pull changes in manually and review them before relying on them.
