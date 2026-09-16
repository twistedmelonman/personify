# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repository *is* a single Claude Code Skill, packaged as an installable plugin: `SKILL.md` at the repo root defines "personify," a skill that edits prose to remove statistical fingerprints of LLM-generated writing (em dashes, inflated-significance phrasing, rule-of-three padding, vague attribution, etc.) while preserving the writer's actual voice. `SKILL.md`'s content is the entire functional deliverable; everything else in the repo exists to distribute and validate that one file.

- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` make `/plugin marketplace add smartwatermelon/personify` work in Claude Code. `plugin.json`'s `skills` field points at the repo root (`./`), since `SKILL.md` lives there rather than under the conventional `skills/<name>/` subdirectory; without it, the plugin loads and the skill still works, but Claude Desktop's plugin detail panel won't list it under "Skills." Keep this field if `SKILL.md`'s location ever changes.
- `.github/workflows/validate.yml` runs `scripts/validate_skill.py` on push/PR: checks SKILL.md's frontmatter has required keys and no non-portable ones (`compatibility`, `allowed-tools` break plugin-marketplace validation), and that pattern-group headings run A, B, C... with no gaps. It deliberately does *not* cross-check version numbers against blader/humanizer's releases the way that project's own validator does — personify's version history isn't kept in lockstep with anything external. It also doesn't enforce a bump on every SKILL.md change, but one is needed anyway: see the version-bump note below.
- `README.md` and `LICENSE` are independently written; `LICENSE`'s provenance note credits blader/humanizer for the original taxonomy this skill grew out of, without making this repo track that project's releases.
- `mcp-server/` is a separate Node/TypeScript package (its own `package.json`, tests via `vitest`) that bridges Claude Desktop to this skill by shelling out to the Claude Code CLI. It is versioned independently of `SKILL.md`/`plugin.json`: the lockstep version-bump rule below applies only to the skill content, not to this bridge. See `mcp-server/README.md`.

The `.claude/` directory (note: no hyphen, different from `.claude-plugin/`) is boilerplate from a git template (project-specific config/hook scaffolding for Andrew's global Claude Code infrastructure at `~/.claude/`). Nothing in it is customized for this repo — `config.sh.template` is unmodified and `hooks/extensions/` only has the disabled example.

## Working on this repo

There is no build step. The only thing to run locally is the validator:

```bash
python3 scripts/validate_skill.py
```

- The skill's pattern taxonomy (sections A through Z) is Andrew's own, extended over time as he flags new AI-writing tells in conversation. When adding a new pattern group, follow the existing format: a short label, a description of the tell, and a one-line fix. **Letters retire and are never reused.** `/personify-consolidate` deletes a group that fired in no recorded run, and its letter retires with it, so the sequence has gaps. `scripts/validate_skill.py` requires the headings to ascend with no repeats and allows those gaps. Do not re-letter the survivors to close a gap: every record in `~/.claude/personify-evidence/` keys its `arm_a_groups` on these letters, so a shift silently rewrites the whole historical corpus and the next consolidation counts dead rules against the wrong groups. Adding a new group means taking the next unused letter, or merging two overlapping groups to free one (SKILL.md's Provenance names the merge candidates). Past Z, extend the validator to AA/AB. Cross-references live in Process, inside other pattern groups, in Work register, in the GitHub and Task boards sections, and in Provenance; grep for `group [A-Z]` and verify every hit after any taxonomy change.
- The "What NOT to flag" section exists to prevent over-correction (flattening legitimate human writing that happens to hit one pattern once). Keep new patterns consistent with that calibration: look for clusters, not single hits.
- Per the skill's own hard rule (Process step 6), no em dashes or en dashes should appear in rewritten output. This applies to edits to `SKILL.md` and `VOICE.example.md` themselves too, for consistency.
- This is explicitly framed as independent of, not synced with, the upstream `blader/humanizer` project it forked in spirit from — don't try to reconcile pattern lists against that repo.
- **Bump `version` on every content change to `SKILL.md`, in both `SKILL.md`'s frontmatter and `.claude-plugin/plugin.json`, keeping the two in lockstep with each other.** Installed plugin caches (`~/.claude/plugins/cache/`) key off this version field: `/plugin update` treats an unchanged version as nothing to pull, so a content edit with no version bump leaves users on stale, cached content even after the marketplace clone itself is current. This is unrelated to the point above about not syncing versions to blader/humanizer; that's about not chasing a third party's release numbers, not about never bumping this repo's own.
