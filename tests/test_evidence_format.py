"""The evidence format is a contract between the recorder and consolidation.
These tests pin the parts consolidation depends on. Stdlib unittest, per
tests/test_rules_files.py.
"""

import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
FORMAT = ROOT / "docs" / "evidence-format.md"

REQUIRED_FIELDS = (
    "surface:",
    "audience:",
    "audience_assumed:",
    "thread:",
    "project:",
    "arm_a_groups:",
    "arm_b_removals:",
    "reviewer_winner:",
    "reviewer_confidence:",
    "shared_residue:",
    "final_captured:",
)


class TestEvidenceFormat(unittest.TestCase):
    def test_format_doc_exists(self):
        self.assertTrue(FORMAT.exists())

    def test_every_required_field_is_documented(self):
        text = FORMAT.read_text(encoding="utf-8")
        missing = [f for f in REQUIRED_FIELDS if f not in text]
        self.assertEqual(missing, [], f"undocumented record fields: {missing}")

    def test_consolidated_marker_is_specified(self):
        text = FORMAT.read_text(encoding="utf-8")
        self.assertIn(".consolidated", text)
        self.assertIn("unconsolidated", text)


if __name__ == "__main__":
    unittest.main()
