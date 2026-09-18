## Summary

This pull request implements a fix for an issue that was recently identified in
the session-token refresh path. It should be noted that the root cause turned
out to be somewhat subtle.

## Background

- The token cache stores entries keyed on the user ID.
- The refresh routine looks up entries by the session ID instead.
- As a result, a refresh can miss a cached entry that is actually present.

**Impact:** This is a critical reliability issue that undermines the integrity
of our authentication layer, and addressing it is an important step toward
hardening the session subsystem.

## Changes

- Changed the lookup in `refresh_session()` to key on the user ID.
- Added a regression test in `tests/test_session.py`.
- Minor formatting cleanup in the same file.

## Testing

Ran the full test suite locally and everything passes. No integration tests
apply to this path, so none were run. I did not test against staging since the
change is confined to a single lookup. Let me know if you'd like me to run
anything else before merge.
