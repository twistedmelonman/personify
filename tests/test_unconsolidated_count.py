"""The unconsolidated count drives the consolidation nudge, and getting it
wrong manufactures a nudge for a directory that was already consolidated.
These tests run the real script against temporary directories rather than
asserting on documentation, because the bug this script exists to fix
(counting a directory whose marker is a hidden dotfile) passes every
doc-level check. Stdlib unittest, per tests/test_rules_files.py.
"""

import os
import pathlib
import subprocess
import tempfile
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "unconsolidated_count.sh"


def count(directory):
    """Run the script against `directory` and return (exit_code, stdout)."""
    result = subprocess.run(
        [str(SCRIPT), str(directory)],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode, result.stdout.strip()


class TestUnconsolidatedCount(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _record(self, name):
        (self.dir / name).write_text("", encoding="utf-8")

    def _marker(self):
        (self.dir / ".consolidated").write_text("stamp\n", encoding="utf-8")

    def test_script_exists_and_is_executable(self):
        self.assertTrue(SCRIPT.exists(), f"missing {SCRIPT}")
        self.assertTrue(os.access(SCRIPT, os.X_OK), f"not executable: {SCRIPT}")

    def test_empty_directory_counts_zero(self):
        self.assertEqual(count(self.dir), (0, "0"))

    def test_no_marker_counts_every_record(self):
        for name in ("a.md", "b.md", "c.md"):
            self._record(name)
        self.assertEqual(count(self.dir), (0, "3"))

    def test_marker_newer_than_records_counts_zero(self):
        for name in ("a.md", "b.md", "c.md"):
            self._record(name)
        time.sleep(1.1)
        self._marker()
        self.assertEqual(count(self.dir), (0, "0"))

    def test_counts_only_records_written_after_the_marker(self):
        self._record("old.md")
        time.sleep(1.1)
        self._marker()
        time.sleep(1.1)
        self._record("new_one.md")
        self._record("new_two.md")
        self.assertEqual(count(self.dir), (0, "2"))

    def test_marker_itself_is_never_counted(self):
        """The regression this script exists for: a plain directory count
        sees neither the dotfile nor the distinction it encodes."""
        self._marker()
        self.assertEqual(count(self.dir), (0, "0"))

    def test_non_markdown_files_are_ignored(self):
        self._record("a.md")
        (self.dir / "notes.txt").write_text("", encoding="utf-8")
        (self.dir / "data.json").write_text("", encoding="utf-8")
        self.assertEqual(count(self.dir), (0, "1"))

    def test_missing_directory_fails_loudly(self):
        code, out = count(self.dir / "does-not-exist")
        self.assertEqual(code, 1)
        self.assertEqual(out, "")


if __name__ == "__main__":
    unittest.main()
