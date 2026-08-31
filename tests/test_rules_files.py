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


if __name__ == "__main__":
    unittest.main()
