#!/usr/bin/env bash
# Print the number of unconsolidated personify evidence records.
#
# Why this exists: the marker that records the last consolidation is named
# `.consolidated`, a dotfile. `ls` does not list dotfiles without `-a`, so
# counting the directory directly (`ls -1 "$DIR"/*.md | wc -l`) silently
# reports every record ever written as unconsolidated. That has produced a
# false "N unconsolidated" nudge three separate times against a directory
# consolidated days earlier.
#
# Usage: scripts/unconsolidated_count.sh [evidence-dir]
# Prints a single integer on stdout. Exit 0 on success, 1 on a missing
# directory.

set -euo pipefail

DIR="${1:-${HOME}/.claude/personify-evidence}"
MARKER="${DIR}/.consolidated"

if [[ ! -d "${DIR}" ]]; then
  printf 'no evidence directory at %s\n' "${DIR}" >&2
  exit 1
fi

# No marker means consolidation has never run, so every record is
# unconsolidated. Counted with find so an empty directory yields 0 rather
# than a literal unmatched glob.
if [[ ! -f "${MARKER}" ]]; then
  find "${DIR}" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' '
  exit 0
fi

# `find -newer` compares mtime against the marker file itself, which is the
# same comparison the marker's own contents describe. Using the file rather
# than parsing the timestamp inside it avoids a second format to keep in
# sync, and a record written in the same second as the marker counts as
# already consolidated, which is the safe direction: it under-reports by at
# most one rather than nagging.
find "${DIR}" -maxdepth 1 -type f -name '*.md' -newer "${MARKER}" | wc -l | tr -d ' '
