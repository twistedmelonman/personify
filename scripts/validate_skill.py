#!/usr/bin/env python3
"""Sanity-check SKILL.md structure. Not a version-lockstep validator: this repo
tracks its own pattern list independently rather than syncing against another
project's release cadence."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_PATH = ROOT / "SKILL.md"
TAXONOMY_PATH = ROOT / "rules" / "taxonomy.md"


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not SKILL_PATH.exists():
        fail("SKILL.md not found")

    text = SKILL_PATH.read_text(encoding="utf-8")

    frontmatter_match = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
    if frontmatter_match is None:
        fail("SKILL.md must start with YAML frontmatter")
    frontmatter = frontmatter_match.group(1)

    for required_key in ("name:", "description:", "version:", "license:"):
        if not re.search(rf"(?m)^{re.escape(required_key)}", frontmatter):
            key = required_key[:-1]
            fail(f"SKILL.md frontmatter missing required key: {key}")

    for nonportable_key in ("compatibility:", "allowed-tools:"):
        if re.search(rf"(?m)^{re.escape(nonportable_key)}", frontmatter):
            key = nonportable_key[:-1]
            fail(f"Remove nonportable frontmatter key: {key}")

    if not TAXONOMY_PATH.exists():
        fail("rules/taxonomy.md not found")
    taxonomy = TAXONOMY_PATH.read_text(encoding="utf-8")

    heading_letters = re.findall(r"(?m)^### ([A-Z])\. ", taxonomy)
    if not heading_letters:
        fail("No pattern-group headings found in rules/taxonomy.md")

    # Letters must ascend and never repeat, but gaps are allowed. Consolidation
    # deletes a group that fired in no recorded run, and the letter it used
    # retires with it rather than being reused. Renumbering the survivors would
    # be worse than the gap: every record in ~/.claude/personify-evidence/ keys
    # its arm_a_groups on these letters, so a shift silently rewrites the whole
    # historical corpus and the next consolidation counts against the wrong
    # groups.
    if sorted(set(heading_letters)) != heading_letters:
        fail(
            "Pattern-group headings must ascend A, B, C... with no repeats; "
            f"gaps from retired groups are allowed. Found {heading_letters}"
        )

    if re.search(r"(?m)^### [A-Z]\. ", text):
        fail("Pattern groups must live in rules/taxonomy.md, not SKILL.md")

    first, last = heading_letters[0], heading_letters[-1]
    count = len(heading_letters)
    print(f"SKILL.md is valid: {count} pattern groups ({first}-{last})")


if __name__ == "__main__":
    main()
