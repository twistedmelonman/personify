"""Structural checks on the rules files.

Stdlib unittest, not pytest: this repo installs no Python dependencies and CI
runs plain python3. Adding pytest would mean a dependency and an install step
for four assertions.
"""

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
HARD = ROOT / "rules" / "hard.md"
TAXONOMY = ROOT / "rules" / "taxonomy.md"
LEARNED = ROOT / "rules" / "learned.md"


class TestHardRules(unittest.TestCase):
    def test_hard_rules_exist(self):
        self.assertTrue(HARD.exists(), "rules/hard.md must exist")

    def test_hard_rules_stay_short(self):
        lines = HARD.read_text(encoding="utf-8").splitlines()
        self.assertLess(
            len(lines), 60, f"rules/hard.md is {len(lines)} lines, limit is 60"
        )

    def test_hard_rules_have_no_lettered_groups(self):
        text = HARD.read_text(encoding="utf-8")
        self.assertIsNone(
            re.search(r"(?m)^### [A-Z]\. ", text),
            "hard.md must not contain taxonomy groups; that is arm A's file",
        )

    def test_no_dashes_in_rules_files(self):
        for path in (HARD, TAXONOMY):
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("—", text, f"em dash in {path.name}")
            self.assertNotIn("–", text, f"en dash in {path.name}")


class TestLearnedRules(unittest.TestCase):
    def test_learned_rules_exist(self):
        self.assertTrue(LEARNED.exists(), "rules/learned.md must exist")

    def test_learned_rules_have_no_lettered_groups(self):
        text = LEARNED.read_text(encoding="utf-8")
        self.assertIsNone(
            re.search(r"(?m)^### [A-Z]\. ", text),
            "learned.md must not use taxonomy letters; those belong to arm A",
        )

    def test_learned_entries_cite_evidence(self):
        """Every rule cites the record count that justifies it.

        Rules are the "### " entries under the "## Rules" section. Keying on
        structure rather than on a list of heading names to skip: a name-based
        skip list silently exempts any rule that happens to reuse a structural
        heading's text, and offsets found by re-splitting on heading text
        attribute the wrong body to a duplicate label.
        """
        text = LEARNED.read_text(encoding="utf-8")
        section = re.search(r"(?m)^## Rules$(.*)\Z", text, re.DOTALL)
        self.assertIsNotNone(section, "learned.md needs a '## Rules' section")
        body = section.group(1)

        entries = list(re.finditer(r"(?m)^### (.+)$", body))
        for i, match in enumerate(entries):
            end = entries[i + 1].start() if i + 1 < len(entries) else len(body)
            self.assertIn(
                "Evidence:",
                body[match.end():end],
                f"rule {match.group(1).strip()!r} has no Evidence: line",
            )


if __name__ == "__main__":
    unittest.main()
