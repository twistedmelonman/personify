# Pattern groups (arm A)

The hand-maintained taxonomy. Arm A reads this file and reports which
lettered groups it applied. Arm B must never read it: see the design spec
at docs/superpowers/specs/2026-08-31-ab-harness-design.md.

## Pattern groups

### A. Inflated significance

Watch for: "stands as a testament to," "marks a pivotal moment," "underscores its importance," "the evolving landscape of," "represents a shift," anything that assigns cosmic weight to an ordinary fact. Fix: state the fact plainly and let the reader decide if it's a big deal.

### B. Empty vocabulary cluster

Words that spike hard in LLM output relative to human baseline: delve, intricate, tapestry, foster, garner, underscore (verb), leverage, holistic, navigate (figurative), robust, landscape (abstract), shape (abstract, for a process or idea rather than a physical object), load-bearing (figurative, for anything other than an actual physical support), dance (figurative, for a multi-step computing process rather than actual dancing), testament, vibrant, crucial, pivotal.

Extended set: meticulous, bolster, interplay, multifaceted, nuanced (as filler), utilize, commence, facilitate, encompass, paramount, groundbreaking, cutting-edge, game-changing, transformative, revolutionize, seamless, comprehensive (describing your own output), endeavor, aforementioned, harness, spearhead, showcase, unprecedented, remarkable, profound, synergy, pain points, thought leadership, moving forward, circle back, rest assured, in essence, it goes without saying.

Stock phrases from the same distribution: "in today's [adjective] [noun]," "at its core," "in the realm of," "when it comes to," "this is where X comes in," "whether you're a X or a Y," "at the end of the day," "the bottom line is," "here's the thing," "in a nutshell," "without further ado," "in conclusion," "overall" as a paragraph opener, "firstly / secondly / thirdly," "I hope this finds you well," "please don't hesitate to reach out."

These are weighted signals, not banned words. One in isolation means nothing, and several of them are the correct word in a technical context: "robust" about a retry policy, "comprehensive" about someone else's test suite. Several in one paragraph is a tell. Judge the cluster, not the hit, and see What NOT to flag.

"utilize" and "commence" are the exception: those two are always "use" and "start," because the substitution never loses meaning. They live in group V's verb-inflation list, which is where hard substitutions belong. Everything above stays a weighted signal.

**Physical-structure metaphors for code. These are banned, not weighted.** A building, a body, or a machine borrowed to describe software someone can read the actual mechanism of: load-bearing, seam, ladder, spine, rail, scaffold, substrate, machinery, ratchet, lever, keystone, foundation (abstract), and the carry family used of code (a check that "carries" a guarantee, a module that "carries" the retry logic). Also the survival family used of code: survived, survives, "the assertion survived the refactor."

The test that decides a borderline case: is there a plainer, more specific way to say this? If yes, the metaphor is the tell and gets replaced. If the metaphor is itself the plain idiom and every alternative says less, keep it. "monitoring is wired up" passes, because "monitoring is configured" says less about whether it reaches anything. "the retry logic is load-bearing" fails, because "removing the retry logic breaks X" is both plainer and more specific. Words like plumbing, wiring, and glue sit on this line and go either way. Judge them by this test, not by a list.

Scope, because it is narrow and the rest of this file depends on it. The ban covers these words used to describe **software** whose actual mechanism the writer could name instead. It does not cover: the literal sense (a load-bearing wall, a seam in a texture, a physical rail, a ladder); a type or symbol named in the code (`Carrier`, `Substrate`, a `scaffold` command); or the ordinary editorial sense of carry and survive applied to **writing** rather than to code, as in "the sentence carries one idea" or "what survives compression." That editorial usage is standard English about text, it is used throughout this file, and it is not the tell.

Why banned rather than weighted: each one dresses an ordinary fact as an insight. "This check is load-bearing" says the check matters, at more words and less precisely than "removing this check breaks X." The metaphor also flatters the writer, which is the group K failure arriving one word at a time. Fix: name the mechanism. "load-bearing" becomes what breaks without it. "the seam between A and B" becomes the interface, the boundary, or the actual function that connects them. "survived the refactor" becomes "the refactor did not change it." See group S for the same tell at paragraph scale, and Work register for the ASD-STE100 bias this follows from.

**Hyphenated precision coinages, weighted.** byte-identical, byte-for-byte, pre-fix, post-fix, wall-clock, fan-out, in-flight, one-line, hand-rolled, unit-tested, fail-open, fail-closed, round-trip, no-op, on-disk, per-request. These are real terms and several are the only accurate word for the thing. The tell is reaching for one where a plain word would do, and stacking several in a paragraph: "byte-identical" for two files that are the same, "pre-fix" for before, "wall-clock" for how long it took when no other clock is in play. Use the coinage when the distinction it draws is live in the sentence, and the plain word when it is not.

**Adverbs and adjectives from the same distribution, weighted rather than banned:** quietly, loudly, silently, genuine, genuinely, honest, honesty, honestly, deliberate, deliberately, latent, precisely, exactly, merely, structurally, unconditionally, verbatim, cleanly. Each has a correct use: a job that fails silently is a real and specific failure mode, and "deliberately" is right when the alternative reading is that something was an accident. The tell is the cluster and the decorative use, where the adverb sets a mood rather than adding a fact.

This is a weighted signal and not a default cut. Delete the adverb and read the sentence again. If the sentence still says the same thing, leave the adverb out; if it loses a fact, such as which of two failure modes happened, keep it. Never delete one to hit a word count, and never add one the source did not support, since that invents specificity (Work register). Counts are not on this list at all: an exact number is a fact, and where a voice guide asks for exact counts it wins outright, per Step 0.

### C. Copula avoidance

"Serves as," "boasts," "features," "stands as" substituted for plain "is/has." Fix: use the boring verb.

### D. Negative parallelism / "not X, but Y"

"It's not just about the beat, it's the atmosphere." Also tailing negations like "no wasted motion" bolted onto a sentence. This construction creates an illusion of insight while adding nothing. State the point once, directly.

### E. Rule of three, everywhere

Not just three-item lists ("innovation, inspiration, insight") but three-part *structures*: three-step processes, three examples, three parallel clauses per paragraph, used as the skeleton of an entire piece. If you can't stop finding threes, you're pattern-completing. Vary list length; use two, four, or none.

### F. Epistrophe / repetition as gravity

Repeating a word or clause purely to manufacture weight ("falls, and falls, and falls"; closing on "the biggest X I have ever seen"). No new information, just emphasis through repetition. Cut it; if the content needs the repetition to feel important, the content isn't earning the importance on its own.

### G. Staccato fragments as punchlines

Long buildup sentence, then a one- or two-word fragment dropped for drama ("That is the story now." "Ubiquity."). A single clipped sentence for emphasis is fine. A run of them in one piece is engineered drama. Use full sentences, or cut the theatrics.

### H. Self-narrating structure

The text announces its own outline as it goes: "it is worth naming the steps precisely," "now think about what that means," "which brings us to the trap," "let's dive in." Just make the point; don't narrate making it.

Emotional-arc section headers are the same tell in heading form. Short headers naming a mood or beat rather than a topic ("The weather," "The scream," "The close") turn the piece into a script narrating its own dramatic structure. Fine once as a title. A full set of them running through one piece is self-narration by another route.

### I. Rhetorical question as connective tissue

Posing a question purely to answer it in the next sentence, used repeatedly as the joint between sections rather than genuine inquiry. Fine once. A tell as a recurring transition device.

### J. False-discovery framing

"It turns out that X" used to dress up an asserted premise as an empirical finding when nothing was tested or discovered. State the claim; don't costume it as a revelation.

### K. Escalating grandiosity

Each section or closing line tries to out-stake the last ("a categorically larger event" -> "the biggest one I have ever seen"). Stakes should come from evidence, not adjectival inflation.

### L. False ranges

"From the Big Bang to dark matter" where the two ends aren't actually on a meaningful scale. List the actual topics instead.

### M. Vague attribution

"Experts believe," "industry reports suggest," "observers have noted" without a named source. Name the source or cut the claim.

### N. Formulaic "despite challenges" close

"Despite these challenges, X continues to thrive." Formulaic hedge-then-boost pattern that adds nothing sourced. Keep the concrete facts, cut the boosterism.

### O. Style mechanics

- Em/en dashes: cut, no exceptions (no dashes: `rules/hard.md`, rule 1). Replace with a period, comma, or colon. Not parentheses: see the aside rule below.
- Parenthetical asides: no parentheses, and no relocating an aside into a different set of parentheses elsewhere. Sort by content first. An aside carrying color, hedging, or restatement gets deleted outright. An aside carrying a fact, number, or technical caveat is never deleted (never invent facts: `rules/hard.md`, rule 3): promote it into the sentence as a plain clause, or make it its own short sentence. The rule bans the parenthetical construction, not the information inside it. Same for appositives and "which"/"that" clauses.
- Exclamation marks: at most one per long piece, and usually zero. Enthusiasm comes from word choice.
- Ellipses: only for genuinely trailing off, never as a transition.
- Semicolons: fine to use. Models underuse them and good human writers reach for them naturally.
- Markdown in plain-text contexts (email, DM, SMS, Slack): no headers, no bold, no asterisks. Raw asterisks rendering as literal symbols is an instant tell.
- Hashtag stacks: zero to two, integrated into the sentence.
- Emoji as bullet points: every line starting with a checkmark or flame is slop. One or two emoji in a casual post is fine.
- Boldface used mechanically on scattered terms: drop it
- "**Label:** content" bullet lists: convert to prose or a plain list
- Title Case Headings: sentence case instead
- Emoji as decoration: remove
- Curly quotes: straight quotes
- Hyphenating predicate-position compounds ("the report is high-quality"): only hyphenate when attributive ("a high-quality report")

### P. Chatbot residue

"I hope this helps," "Great question!," "Let me know if you'd like me to expand," cutoff disclaimers ("as of my last update"), speculative gap-filling dressed as fact ("likely grew up in a middle-class household"). Cut, or state plainly what isn't known.

### Q. Filler and hedging

"In order to" -> "to." "Due to the fact that" -> "because." "Could potentially possibly" -> "may." "It is important to note that" -> cut it, state the thing.

### R. Aphorism-per-paragraph density

Nearly every paragraph lands on a standalone, quotable epigram ("Volume reads as veracity," "The calm is not a temperament, it is a tax"). One or two of these in a long piece is a writer's signature. When almost every paragraph ends this way, the piece reads as a string of pull-quotes rather than an argument, and it starts to sound engineered even when hand-written. Let some paragraphs just end.

### S. One extended metaphor doing all the structural work

A single image introduced early (a dial, a fire, a tax) that the piece keeps returning to as its organizing device for every subsequent point. Effective in small doses; overused it becomes a crutch that substitutes for making the next point on its own terms. Watch for a metaphor reappearing three or more times as connective tissue rather than illustration.

### T. Self-justifying importance claims

A sentence asserts its own importance in place of content: "the key insight here, and this is the crucial part, is that the cache is cold on first request." Cut the assertion, keep the fact. Distinct from H (narrating the outline) and A (inflating an ordinary fact): here the sentence is about its own weight, not the structure or the subject.

### U. Point-by-point question mirroring

Quoting or restating each of the asker's sub-points in order, then answering each fully in its own paragraph, so the response's structure exactly tracks the question's enumeration. This reads as assistant-triage regardless of how good the individual answers are: a human reply merges points, answers out of order, or skips a sub-question the first answer already covers. Fix: answer in flowing prose using the order the points naturally connect in, not the order they were asked in. Fix it by reorganizing the response, not by chopping sentences at random: the two problems are separate, and fragmenting a mirrored answer leaves it still mirrored. In long-form prose, complete correctly punctuated sentences are not themselves a tell (see What NOT to flag). In work communication, fragments are actively wanted, but for the reasons in Work register, not as a fix for this group.

### V. Too many words for a simple concept

The highest-priority pattern in this skill, alongside W. A simple idea arrives wrapped in a construction three times its necessary size. The sentence is grammatical, accurate, and completely correct, which is exactly why it slips through: nothing is wrong with it except that nobody would say it that way.

The tell isn't vocabulary, it's ratio. Count the words against the idea underneath. "We should consider whether it might make sense to revisit the caching approach" carries one idea, "maybe we should redo the cache," in four times the words. Every extra word is doing hedging or throat-clearing rather than carrying meaning.

Specific constructions to cut:

- Nominalizations back to verbs: "perform an analysis of" to "analyze," "make a determination" to "decide," "provide clarification" to "clarify," "has a dependency on" to "needs."
- Verb inflation: "utilize" to "use," "commence" to "start," "facilitate" to "help," "implement a fix" to "fix," "leverage" to "use."
- Prepositional pileups: "in the event that" to "if," "for the purpose of" to "to," "with regard to" to "about," "in the vicinity of" to "near," "at this point in time" to "now," "on a daily basis" to "daily."
- Hedge stacks: "it seems like it might potentially be" to "may be." One hedge maximum, and only when the uncertainty is real.
- Setup clauses that delay the point: "what I'm seeing here is that the test fails" to "the test fails." "The reason for this is that" to "because."
- Existential openers: "there are several files that need updating" to "several files need updating." "It is the case that" to nothing.
- Dead metaphors for a process: "the ssh authentication dance" to "ssh authentication," "the token renewal dance" to "token renewal." Name the process with the plain word for it, or "process" or "flow" if it needs a noun. The metaphor adds a knowing wink, not information, and it dodges saying which steps are actually involved.

Fix: say it the way you'd say it out loud to a coworker standing at your desk, then keep that version. If the short version sounds blunt or unpolished, that's the target, not a problem to fix. Blunt reads as human. Polished reads as generated.

Do not preserve length by relocating words. The compressed version is the output.

### W. Impersonal framing

The highest-priority pattern alongside V. A human made a choice, held an opinion, or did a thing, and the sentence hides that human behind a process, an abstraction, or a passive construction. This is the single strongest reason correct technical writing reads as machine-generated: machines have no first person, so prose with no first person reads as machine-written even when a person wrote it.

Watch for:

- Passive voice hiding the actor: "the config was updated" to "I updated the config." "It was decided that" to "we decided" or "I decided." "Mistakes were made" to who made them.
- Abstractions as grammatical subject: "this approach introduces risk" to "I think this breaks under load." "The implementation handles retries" to "it retries." "The changes address the issue" to "this fixes the bug."
- Opinions laundered as observations: "it may be worth considering X" to "I'd do X." "One could argue that" to "I think." "There are concerns about" to "I'm worried about."
- Missing subjects generally: if a sentence describes a judgment, someone made it. Name them, usually "I" or "we."
- Credential openers: "as the author of this module, I..." Just say the thing.

Fix: put a person in the sentence. "I," "we," "you," or a named human. State opinions as opinions and own them: "I think," "I'd rather," "I don't know," "this seems wrong to me." Hedging into impersonality to sound measured is the exact move that reads as AI.

Carve-outs, both narrow. Reference documentation and API docs stay neutral, because there genuinely is no actor. And a PR description narrating what its own diff does can lead with the verb ("gives `deploy-bot` assume-role"), since the author is unambiguous from the PR metadata. Everywhere else at work, including review comments, status updates, Slack, design docs, and email to the team, takes the first person. The carve-out is about actors that are already obvious, not permission to hedge: any sentence carrying a judgment, a doubt, or a decision names the person who holds it, PR descriptions included.

### X. Uniform rhythm and parataxis

Two opposite failures, both measurable, both tells.

Uniform sentence length: three consecutive sentences of roughly the same length reads as generated regardless of content. Mix a four-word sentence against a thirty-word one. This needs three sentences to apply at all, so it's silent on a two-line Slack message. Don't manufacture length variance in something too short to have rhythm.

Parataxis: a run of short declaratives with no connective tissue. "The build failed. The cache was stale. I cleared it." Reads like a poem, signals AI immediately. Connect them so the syntax shows how the ideas relate: "build failed because the cache was stale, cleared it."

Related structural tells: the same paragraph pattern repeated throughout (topic sentence, explanation, example, transition, repeat), parallel structure across every section, and more than five to seven bullets in a row. Vary it. Let some paragraphs be one sentence. Let some end without a transition.

Note the interaction with V: compression is not permission to produce parataxis. Compress by cutting words, then connect what remains with conjunctions and subordination, not by chopping into a stack of stubs.

### Y. Hedging seesaw and corporate pep talk

Hedging seesaw: presenting both sides at equal weight to avoid committing. "There are benefits to X, though Y also has merits, and the right choice depends on context." Pick a side, state it plainly, give a counterpoint one sentence at most. If you genuinely don't know, say "I don't know" and stop, which is a position and reads as human.

Corporate pep talk: cheerleading register with no experience behind it. "Empower," "elevate," "supercharge," "unlock the power of," "move the needle," "take it to the next level," "bridge the gap," "streamline your workflow." Also the closing-boosterism reflex, which is group N seen from a different angle. Write like someone who has actually done the work, including the parts that were annoying.

Also in this family: filler transitions used as connective tissue, "moreover," "furthermore," "additionally," "notably," "importantly," "interestingly," "indeed." Delete them. The relationship between two sentences should come from their content, and if it doesn't, the transition word is patching a structural problem.

### Z. Implementation described instead of outcome

The text lists what was built, in accurate technical terms, and never says what it produces or why anyone should care. Every noun is correct. The reader still cannot tell what they got. Compression does not fix this one, which is what separates it from V and W.

"Ingest glue for the staging bucket, flat-file index, no managed DB for a trial, single container deployment, matches the layout two other services already use" is the pattern. It is precise, dense, and honest, and it fails, because it answers "what did you assemble" when the reader asked "what can we do now that we could not do before."

The test, and it is a hard one to pass: **if this were shown to the person paying for the work, could they tell why it was worth paying for?** Not whether they would understand the jargon. Whether they could see the point. Apply it to every task title, milestone, status update, and PR description.

How to fix it:

- Lead with the end state, not the parts. "The package proxy is running and serving internal builds" rather than an inventory of the modules that make it run.
- Write titles as declarative end states, the thing being true when you are done: "config index deployed to the cluster with health checks" rather than "config index work."
- Name the capability, then the mechanism, and only if the mechanism matters to the reader. Implementation detail belongs in the body or in the diff.
- Cut the "follows the existing pattern" reassurance unless a reviewer specifically needs it. It is defensive completeness (see the GitHub section) and it reads as filler to anyone above the code.
- Never log something that happened as if it were work you did. "A teammate asked about pairing" is an event. "Paired with them on the registry auth patch" is work.

This pattern coexists with V (too many words) and is not the same failure. V is a long sentence carrying a small idea. Z is an accurate sentence carrying the wrong kind of idea, and it survives compression untouched: shortening a list of components just yields a shorter list of components. Fix Z first, because it changes what the sentence is about; then apply V to whatever survives.

Distinct from A (inflated significance) in the exact opposite direction. A dresses an ordinary fact in cosmic language. Z strips a genuinely valuable outcome down to plumbing. The fix for A is to deflate; the fix for Z is to state the value plainly, once, without adjectives.
