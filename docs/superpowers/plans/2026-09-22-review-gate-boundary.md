# Review gate boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate published text through Pangram only where Andrew cares what a reader thinks, decided by a destination list he declares rather than by a judgment Claude makes per artifact.

**Architecture:** A classifier module maps a destination (a filesystem path, or a repository plus artifact type) to gated or exempt, reading a config file Andrew owns. The existing `gh` PATH shim calls it before a publish. Secret resolution moves to the macOS login keychain, which is reachable without a TTY. The gate distinguishes a verdict it received from a check that never ran.

**Tech Stack:** Python 3.13 standard library only (`ast`, `json`, `subprocess`, `urllib`), bash for the shim, `security` for keychain access, unittest for tests.

**Spec:** `docs/superpowers/specs/2026-09-22-review-gate-boundary-design.md`

## Global Constraints

- No em dashes or en dashes in any file this plan touches, including code comments and test fixtures. Hard rule 1 of the skill.
- Python standard library only. The client has no third-party dependencies and must keep none.
- `SKILL.md` frontmatter `version` and `.claude-plugin/plugin.json` `version` move together, exactly. `scripts/validate_skill.py` asserts it.
- No tracked Markdown file may cite a lettered pattern group. The validator fails the build on one.
- Never `git add .` or `git add -A`. Stage files individually by path.
- Shell scripts are GNU Bash 5.x compatible and pass `shellcheck -S info` with no `# shellcheck disable` directives.
- Stamps live at `~/.config/personify/stamps/<sha256>.json`, mode 0600 inside a 0700 directory, and never under `~/.claude/gate-review/`.
- The stamp is keyed on the sha256 of raw stdin bytes, hashed before any decoding or stripping.

## Review Focus

- A destination that matches no rule must be gated, not exempt. A classifier that returns exempt on an unknown input inverts the design. Task 1 tests it.
- A config file that is missing, empty, or malformed must fail closed and say so, rather than degrade to exempting everything. Task 2 tests all three.
- An exempt path must not match by prefix alone: `docs/plans-archive/` is not `docs/plans/`, and `evil/docs/plans/` is not either. Task 1 tests both.
- `UNAVAILABLE` must remain distinguishable from `AI` at every layer that reports a result, since overriding the first publishes unreviewed text. Task 5 tests it.
- A keychain item that exists but holds an empty string must fail like a missing key, not like a valid one. Task 3 tests it.

---

### Task 1: The destination classifier

**Files:**

- Create: `scripts/gate_policy.py`
- Test: `tests/test_gate_policy.py`

**Interfaces:**

- Produces: `classify(destination: Destination, policy: Policy) -> str` returning `"gated"` or `"exempt"`; `Destination` is a dataclass with fields `path: str | None`, `repo: str | None`, `artifact: str | None`, `account: str | None`; `Policy` is a dataclass with fields `exempt_paths: tuple[str, ...]`, `exempt_surfaces: tuple[tuple[str, str], ...]`, `always_gated_accounts: tuple[str, ...]`.

- [ ] **Step 1: Write the failing test**

```python
import unittest

from scripts.gate_policy import Destination, Policy, classify

POLICY = Policy(
    exempt_paths=("docs/plans/", "docs/superpowers/"),
    exempt_surfaces=(("smartwatermelon/dev-env", "issue"),),
    always_gated_accounts=("andrewmrich",),
)


class TestClassify(unittest.TestCase):
    def test_unknown_destination_is_gated(self):
        d = Destination(path=None, repo=None, artifact=None, account=None)
        self.assertEqual(classify(d, POLICY), "gated")

    def test_exempt_path_is_exempt(self):
        d = Destination(path="docs/plans/x.md", repo=None, artifact=None, account=None)
        self.assertEqual(classify(d, POLICY), "exempt")

    def test_sibling_prefix_is_not_exempt(self):
        d = Destination(path="docs/plans-archive/x.md", repo=None, artifact=None, account=None)
        self.assertEqual(classify(d, POLICY), "gated")

    def test_nested_lookalike_is_not_exempt(self):
        d = Destination(path="evil/docs/plans/x.md", repo=None, artifact=None, account=None)
        self.assertEqual(classify(d, POLICY), "gated")

    def test_exempt_surface_is_exempt(self):
        d = Destination(path=None, repo="smartwatermelon/dev-env", artifact="issue", account=None)
        self.assertEqual(classify(d, POLICY), "exempt")

    def test_pr_description_on_exempt_repo_is_gated(self):
        d = Destination(path=None, repo="smartwatermelon/dev-env", artifact="pr", account=None)
        self.assertEqual(classify(d, POLICY), "gated")

    def test_gated_account_outranks_exempt_path(self):
        d = Destination(path="docs/plans/x.md", repo=None, artifact=None, account="andrewmrich")
        self.assertEqual(classify(d, POLICY), "gated")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_gate_policy -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.gate_policy'`

- [ ] **Step 3: Write minimal implementation**

```python
"""Map a publish destination to gated or exempt.

The classification is data, never a judgment made at call time. Andrew
declares what each destination means; this module only looks it up. An
unrecognized destination is gated, so a destination nobody has classified
never falls through unchecked.
"""

from __future__ import annotations

from dataclasses import dataclass

GATED = "gated"
EXEMPT = "exempt"


@dataclass(frozen=True)
class Destination:
    path: str | None
    repo: str | None
    artifact: str | None
    account: str | None


@dataclass(frozen=True)
class Policy:
    exempt_paths: tuple[str, ...]
    exempt_surfaces: tuple[tuple[str, str], ...]
    always_gated_accounts: tuple[str, ...]


def _path_is_exempt(path: str, prefixes: tuple[str, ...]) -> bool:
    """Match whole path segments, never a bare string prefix.

    "docs/plans-archive/" shares six characters with "docs/plans/" and is a
    different directory. Comparing segment lists rather than strings keeps
    the first from matching the second, and keeps "evil/docs/plans/" from
    matching either, since the comparison is anchored at the start.
    """
    parts = [p for p in path.split("/") if p]
    for prefix in prefixes:
        want = [p for p in prefix.split("/") if p]
        if parts[: len(want)] == want:
            return True
    return False


def classify(destination: Destination, policy: Policy) -> str:
    if destination.account and destination.account in policy.always_gated_accounts:
        return GATED
    if destination.path and _path_is_exempt(destination.path, policy.exempt_paths):
        return EXEMPT
    if destination.repo and destination.artifact:
        if (destination.repo, destination.artifact) in policy.exempt_surfaces:
            return EXEMPT
    return GATED
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_gate_policy -v`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gate_policy.py tests/test_gate_policy.py
git commit -m "feat(gate): classify a destination as gated or exempt"
```

---

### Task 2: Load the policy from a file Andrew owns

**Files:**

- Modify: `scripts/gate_policy.py`
- Modify: `tests/test_gate_policy.py`
- Create: `docs/gate-policy.example.json`

**Interfaces:**

- Consumes: `Policy` from Task 1.
- Produces: `load_policy(path: Path) -> Policy`, raising `PolicyError` on a missing, empty, or malformed file.

- [ ] **Step 1: Write the failing test**

```python
import json
import tempfile
import unittest
from pathlib import Path

from scripts.gate_policy import PolicyError, load_policy


class TestLoadPolicy(unittest.TestCase):
    def _write(self, text):
        d = Path(tempfile.mkdtemp())
        p = d / "policy.json"
        p.write_text(text, encoding="utf-8")
        return p

    def test_missing_file_raises(self):
        with self.assertRaises(PolicyError):
            load_policy(Path("/nonexistent/policy.json"))

    def test_empty_file_raises(self):
        with self.assertRaises(PolicyError):
            load_policy(self._write(""))

    def test_malformed_json_raises(self):
        with self.assertRaises(PolicyError):
            load_policy(self._write("{not json"))

    def test_wrong_shape_raises(self):
        with self.assertRaises(PolicyError):
            load_policy(self._write(json.dumps({"exempt_paths": "not a list"})))

    def test_valid_file_loads(self):
        body = json.dumps({
            "exempt_paths": ["docs/plans/"],
            "exempt_surfaces": [{"repo": "smartwatermelon/dev-env", "artifact": "issue"}],
            "always_gated_accounts": ["andrewmrich"],
        })
        policy = load_policy(self._write(body))
        self.assertEqual(policy.exempt_paths, ("docs/plans/",))
        self.assertEqual(policy.exempt_surfaces, (("smartwatermelon/dev-env", "issue"),))
        self.assertEqual(policy.always_gated_accounts, ("andrewmrich",))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_gate_policy -v`
Expected: FAIL with `ImportError: cannot import name 'PolicyError'`

- [ ] **Step 3: Write minimal implementation**

Append to `scripts/gate_policy.py`:

```python
import json
from pathlib import Path


class PolicyError(Exception):
    """The policy file is missing, empty, or not the shape this module needs.

    Every one of those fails closed. A policy that cannot be read must never
    degrade into a permissive default, because the permissive direction here
    publishes unreviewed text.
    """


def _string_tuple(raw, field: str) -> tuple[str, ...]:
    if not isinstance(raw, list) or not all(isinstance(x, str) for x in raw):
        raise PolicyError(f"{field} must be a list of strings")
    return tuple(raw)


def load_policy(path: Path) -> Policy:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as err:
        raise PolicyError(f"cannot read the gate policy at {path}: {err}") from err

    if not text.strip():
        raise PolicyError(f"the gate policy at {path} is empty")

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as err:
        raise PolicyError(f"the gate policy at {path} is not valid JSON: {err}") from err

    if not isinstance(raw, dict):
        raise PolicyError(f"the gate policy at {path} must be a JSON object")

    surfaces_raw = raw.get("exempt_surfaces", [])
    if not isinstance(surfaces_raw, list):
        raise PolicyError("exempt_surfaces must be a list")
    surfaces = []
    for entry in surfaces_raw:
        if not isinstance(entry, dict) or "repo" not in entry or "artifact" not in entry:
            raise PolicyError("each exempt_surfaces entry needs a repo and an artifact")
        surfaces.append((str(entry["repo"]), str(entry["artifact"])))

    return Policy(
        exempt_paths=_string_tuple(raw.get("exempt_paths", []), "exempt_paths"),
        exempt_surfaces=tuple(surfaces),
        always_gated_accounts=_string_tuple(
            raw.get("always_gated_accounts", []), "always_gated_accounts"
        ),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_gate_policy -v`
Expected: PASS, 12 tests

- [ ] **Step 5: Write the example policy**

Create `docs/gate-policy.example.json`:

```json
{
  "exempt_paths": [
    "docs/plans/",
    "docs/superpowers/"
  ],
  "exempt_surfaces": [
    {"repo": "smartwatermelon/dev-env", "artifact": "issue"},
    {"repo": "twistedmelonman/claude-config", "artifact": "issue"},
    {"repo": "twistedmelonman/personify", "artifact": "issue"}
  ],
  "always_gated_accounts": [
    "andrewmrich"
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/gate_policy.py tests/test_gate_policy.py docs/gate-policy.example.json
git commit -m "feat(gate): load the policy from a declared file, fail closed"
```

---

### Task 3: Read the API key from the macOS keychain

**Files:**

- Modify: `scripts/pangram_check.py:191-240`
- Modify: `tests/test_pangram_check.py`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `read_keychain_secret(service: str = KEYCHAIN_SERVICE, account: str = KEYCHAIN_ACCOUNT) -> str | None`, and a `resolve_key` whose order is env, keychain, key file, `op read`.

Measured on 2026-09-22: `security find-generic-password` writes and reads with no prompt and no controlling terminal, so a hook reaches it. The same session showed `op read` succeeding without a TTY because `OP_SERVICE_ACCOUNT_TOKEN` was set in the environment, which means the existing docstring's stated reason for the key file fallback is wrong. Correct the docstring while you are here: what launchd removes is that token, not a terminal.

- [ ] **Step 1: Write the failing test**

```python
import unittest

from scripts.pangram_check import resolve_key


class TestKeychainResolution(unittest.TestCase):
    def test_env_still_wins(self):
        env = {"PANGRAM_API_KEY": "from-env"}
        got = resolve_key(env, keychain_read=lambda: "from-keychain", op_read=lambda: None)
        self.assertEqual(got, "from-env")

    def test_keychain_beats_op(self):
        got = resolve_key({}, keychain_read=lambda: "from-keychain", op_read=lambda: "from-op")
        self.assertEqual(got, "from-keychain")

    def test_empty_keychain_item_is_not_a_key(self):
        """An item that exists holding "" must fail like a missing one."""
        got = resolve_key({}, keychain_read=lambda: "", op_read=lambda: "from-op")
        self.assertEqual(got, "from-op")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_pangram_check.TestKeychainResolution -v`
Expected: FAIL with `TypeError: resolve_key() got an unexpected keyword argument 'keychain_read'`

- [ ] **Step 3: Write minimal implementation**

Add to `scripts/pangram_check.py`:

```python
KEYCHAIN_SERVICE = "personify-pangram"
KEYCHAIN_ACCOUNT = "api-key"


def read_keychain_secret(
    service: str = KEYCHAIN_SERVICE, account: str = KEYCHAIN_ACCOUNT
) -> str | None:
    """Read the key from the macOS login keychain, or return None.

    Verified 2026-09-22: this returns the secret with no prompt and no
    controlling terminal, which is what a hook and a launchd job both need
    and what the 1Password path could not promise.
    """
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", service, "-a", account, "-w"],
            capture_output=True,
            text=True,
            timeout=OP_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    key = result.stdout.strip()
    return key or None
```

Replace `resolve_key` with:

```python
def resolve_key(
    env: dict[str, str],
    keychain_read: Callable[[], str | None] = read_keychain_secret,
    op_read: Callable[[], str | None] = read_op_secret,
) -> str:
    """Resolve the API key from the env var, the keychain, the key file, then 1Password.

    An explicitly exported key wins, since exporting one is a deliberate
    override. The keychain comes next because it is the only source measured
    to work with no terminal and no unlocked desktop app.

    The key file and 1Password remain as fallbacks. `op read` needs
    OP_SERVICE_ACCOUNT_TOKEN or an unlocked desktop app, and launchd supplies
    neither; an earlier comment here blamed the absence of a TTY, which was
    measured false on 2026-09-22.
    """
    from_env = env.get("PANGRAM_API_KEY", "").strip()
    if from_env:
        return from_env

    from_keychain = keychain_read()
    if from_keychain:
        return from_keychain

    from_file = read_key_file(config_root(env) / "pangram-key")
    if from_file:
        return from_file

    from_op = op_read()
    if from_op:
        return from_op

    raise CheckError(
        "no Pangram API key found. Set PANGRAM_API_KEY, or add it to the "
        f"login keychain with \"security add-generic-password -s {KEYCHAIN_SERVICE} "
        f"-a {KEYCHAIN_ACCOUNT} -w\", or write it to "
        f"{config_root(env) / 'pangram-key'} with mode 600."
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_pangram_check -v`
Expected: PASS, all existing tests plus 3 new

- [ ] **Step 5: Commit**

```bash
git add scripts/pangram_check.py tests/test_pangram_check.py
git commit -m "feat(pangram): read the key from the login keychain"
```

---

### Task 4: Make a key failure loud

**Files:**

- Modify: `scripts/pangram_check.py:617-640`
- Modify: `tests/test_pangram_check.py`

**Interfaces:**

- Consumes: `CheckError` and the exit codes from Task 3.
- Produces: `format_loud_failure(message: str) -> str`, a banner written to stderr.

A `CheckError` for a credential problem currently prints one line to stderr and a JSON object to stdout. In a hook nobody reads either. The banner exists so the failure is visible in a terminal even when it scrolls past other output.

- [ ] **Step 1: Write the failing test**

```python
import unittest

from scripts.pangram_check import format_loud_failure


class TestLoudFailure(unittest.TestCase):
    def test_banner_names_the_problem(self):
        out = format_loud_failure("no Pangram API key found. Set PANGRAM_API_KEY")
        self.assertIn("PANGRAM CHECK COULD NOT RUN", out)
        self.assertIn("no Pangram API key found", out)

    def test_banner_says_the_text_was_not_checked(self):
        """UNAVAILABLE is not a verdict, and the banner must not read like one."""
        out = format_loud_failure("HTTP 402")
        self.assertIn("was NOT checked", out)
        self.assertNotIn("verdict", out.lower())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_pangram_check.TestLoudFailure -v`
Expected: FAIL with `ImportError: cannot import name 'format_loud_failure'`

- [ ] **Step 3: Write minimal implementation**

```python
def format_loud_failure(message: str) -> str:
    """Build the banner shown when the check could not run at all.

    This is deliberately not the shape of a verdict. A reader who skims must
    come away knowing the text was never classified, because an unchecked
    artifact overridden as though it had been checked is the one outcome the
    gate exists to prevent.
    """
    rule = "=" * 68
    return "\n".join([
        "",
        rule,
        "  PANGRAM CHECK COULD NOT RUN",
        "",
        f"  {message}",
        "",
        "  The text was NOT checked. Publishing it now publishes something",
        "  no detector and no person has reviewed.",
        rule,
        "",
    ])
```

Then in `main`, replace the `CheckError` handler:

```python
    except CheckError as err:
        print(json.dumps({"status": "UNAVAILABLE", "error": str(err)}, indent=2))
        print(format_loud_failure(str(err)), file=sys.stderr)
        return err.code
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_pangram_check -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/pangram_check.py tests/test_pangram_check.py
git commit -m "feat(pangram): make a credential failure loud in the terminal"
```

---

### Task 5: Keep UNAVAILABLE distinct from AI at the gate

**Files:**

- Create: `scripts/gate_check.py`
- Test: `tests/test_gate_check.py`

**Interfaces:**

- Consumes: `classify` and `load_policy` from Tasks 1 and 2; the exit codes `EXIT_PASS`, `EXIT_FAIL`, `EXIT_FAIL_MIXED`, `EXIT_UNAVAILABLE` from `pangram_check`.
- Produces: `gate_outcome(classification: str, exit_code: int) -> tuple[str, bool]` returning an outcome name and whether an override is offered.

An `AI` verdict means the check ran, so Andrew's override is a decision made with information. `UNAVAILABLE` means it never ran, so the same override would publish unreviewed text. They must not present identically.

- [ ] **Step 1: Write the failing test**

```python
import unittest

from scripts.gate_check import gate_outcome


class TestGateOutcome(unittest.TestCase):
    def test_exempt_skips_without_running(self):
        self.assertEqual(gate_outcome("exempt", None), ("EXEMPT", False))

    def test_human_passes(self):
        self.assertEqual(gate_outcome("gated", 0), ("PASS", False))

    def test_ai_offers_override(self):
        outcome, override = gate_outcome("gated", 2)
        self.assertEqual(outcome, "REVIEW")
        self.assertTrue(override)

    def test_mixed_offers_override(self):
        outcome, override = gate_outcome("gated", 3)
        self.assertEqual(outcome, "REVIEW")
        self.assertTrue(override)

    def test_unavailable_does_not_offer_override(self):
        """The check never ran, so there is nothing to override."""
        outcome, override = gate_outcome("gated", 5)
        self.assertEqual(outcome, "BLOCKED")
        self.assertFalse(override)

    def test_skipped_under_floor_does_not_offer_override(self):
        outcome, override = gate_outcome("gated", 4)
        self.assertEqual(outcome, "BLOCKED")
        self.assertFalse(override)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_gate_check -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.gate_check'`

- [ ] **Step 3: Write minimal implementation**

```python
"""Turn a classification and a detector exit code into a gate outcome.

Three outcomes, and the difference between the last two is the point of the
module. PASS and EXEMPT publish. REVIEW means the detector returned a real
verdict that Andrew can override. BLOCKED means no verdict exists, so there
is nothing to override and the publish stops.
"""

from __future__ import annotations

# Imported rather than restated. Two copies of an exit code drift, and the
# copy that drifts is the one nobody runs.
from pangram_check import EXIT_FAIL, EXIT_FAIL_MIXED, EXIT_PASS

VERDICT_CODES = frozenset({EXIT_FAIL, EXIT_FAIL_MIXED})


def gate_outcome(classification: str, exit_code: int | None) -> tuple[str, bool]:
    if classification == "exempt":
        return ("EXEMPT", False)
    if exit_code == EXIT_PASS:
        return ("PASS", False)
    if exit_code in VERDICT_CODES:
        return ("REVIEW", True)
    return ("BLOCKED", False)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_gate_check -v`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/gate_check.py tests/test_gate_check.py
git commit -m "feat(gate): separate a real verdict from a check that never ran"
```

---

### Task 6: Exercise the missing-key path without touching real credentials

**Files:**

- Modify: `tests/test_pangram_check.py`

**Interfaces:**

- Consumes: `resolve_key` from Task 3.

The spec records that the missing-key path is hard to reach interactively, because secret resolution falls through to `op read` and `op read` succeeds whenever `OP_SERVICE_ACCOUNT_TOKEN` is set or the desktop app is unlocked. Injecting the readers removes the need to remove anyone's credentials: the test supplies readers that return None rather than unsetting the environment.

- [ ] **Step 1: Write the failing test**

```python
import unittest

from scripts.pangram_check import CheckError, resolve_key


class TestMissingKey(unittest.TestCase):
    def test_all_sources_empty_raises(self):
        with self.assertRaises(CheckError) as caught:
            resolve_key({}, keychain_read=lambda: None, op_read=lambda: None)
        self.assertIn("no Pangram API key found", str(caught.exception))

    def test_message_names_every_remedy(self):
        with self.assertRaises(CheckError) as caught:
            resolve_key({}, keychain_read=lambda: None, op_read=lambda: None)
        message = str(caught.exception)
        self.assertIn("PANGRAM_API_KEY", message)
        self.assertIn("security add-generic-password", message)
        self.assertIn("pangram-key", message)


if __name__ == "__main__":
    unittest.main()
```

Note: `resolve_key` reads a key file between the keychain and `op read`, so this test must run with a `config_root` that holds no `pangram-key`. Pass an env mapping whose `XDG_CONFIG_HOME` points at a `tempfile.mkdtemp()` directory rather than relying on the developer's real one.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_pangram_check.TestMissingKey -v`
Expected: FAIL, since the developer's real key file or keychain item satisfies the lookup until the env is redirected

- [ ] **Step 3: Redirect the config root in the test**

```python
import tempfile
import unittest
from pathlib import Path

from scripts.pangram_check import CheckError, resolve_key


class TestMissingKey(unittest.TestCase):
    def setUp(self):
        self.env = {"XDG_CONFIG_HOME": tempfile.mkdtemp()}

    def test_all_sources_empty_raises(self):
        with self.assertRaises(CheckError) as caught:
            resolve_key(self.env, keychain_read=lambda: None, op_read=lambda: None)
        self.assertIn("no Pangram API key found", str(caught.exception))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_pangram_check -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_pangram_check.py
git commit -m "test(pangram): reach the missing-key path by injection"
```

---

### Task 7: Call the classifier from the gh shim

**Files:**

- Modify: `~/Developer/dotfiles/bash/gh-wrapper.sh:579-700`
- Test: `~/Developer/dotfiles/tests/test-gh-wrapper-gate-policy.sh`

**Interfaces:**

- Consumes: `scripts/gate_policy.py` and `scripts/gate_check.py`.

This task lands in the dotfiles repository, not personify, so it is a separate branch, a separate PR, and a separate merge lock. The shim already parses `--body-file` and resolves `pr create` versus `issue create`, so the artifact type is available where the classification needs it.

Before writing code, confirm the two facts this task assumes, since both were read rather than executed: that the shim can see the target repository for an `issue create` (it may be an explicit `--repo`, or inferred from the checkout), and that adding a call here does not break the existing gate-review check that runs on the same path. The first is partly confirmed by reading: `_gh_wrapper_resolve_owner` already resolves the owner from `-R`/`--repo` or the checkout's remote, and the classifier needs the repository name as well, so extend it rather than add a second resolver.

**Wiring, decided 2026-09-22 (spec section "How this composes with the visual approval gate").** `classify_destination` is called inside `_gh_wrapper_approval_gate`, after the body file is resolved and before the gate-review hash check:

1. `exempt` returns 0. Both gates are skipped.
2. `gated` looks for a Pangram stamp on the body file's exact bytes. A `Human` stamp returns 0.
3. An `AI` stamp falls through to the existing gate-review check, with a block message saying a verdict exists.
4. No stamp, or an `UNAVAILABLE` result, falls through to the same check, with a block message saying the text is unreviewed. The two messages must differ.

The test in Step 2 covers the classifier only. Add cases for each of the four paths above, using a fixture stamp directory so no API call is made.

- [ ] **Step 1: Read the existing body-file block**

Run: `sed -n '575,700p' ~/Developer/dotfiles/bash/gh-wrapper.sh`
Expected: the approval check, its argument parsing, and the block message

- [ ] **Step 2: Write the failing test**

```bash
#!/usr/bin/env bash
# Exercises gh-wrapper.sh's gate-policy call. Names gh-wrapper.sh's
# classify_destination function.
set -euo pipefail

source "${HOME}/Developer/dotfiles/bash/gh-wrapper.sh" --source-only

fail=0

got=$(classify_destination "issue" "smartwatermelon/dev-env")
[[ "${got}" == "exempt" ]] || { echo "FAIL: dev-env issue should be exempt, got ${got}"; fail=1; }

got=$(classify_destination "pr" "smartwatermelon/dev-env")
[[ "${got}" == "gated" ]] || { echo "FAIL: dev-env pr should be gated, got ${got}"; fail=1; }

got=$(classify_destination "issue" "some/unlisted-repo")
[[ "${got}" == "gated" ]] || { echo "FAIL: unlisted repo should be gated, got ${got}"; fail=1; }

exit "${fail}"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bash ~/Developer/dotfiles/tests/test-gh-wrapper-gate-policy.sh`
Expected: FAIL with `classify_destination: command not found`

- [ ] **Step 4: Implement the shim function**

```bash
# Ask the gate policy whether this destination is gated. Fails closed: any
# error, any missing dependency, and any unparsable answer is "gated", since
# the permissive direction here publishes unreviewed text.
classify_destination() {
  local artifact="$1" repo="$2"
  local policy="${HOME}/.config/personify/gate-policy.json"
  local script="${HOME}/Developer/personify/scripts/gate_policy.py"

  if [[ ! -r "${policy}" || ! -r "${script}" ]]; then
    echo "gated"
    return 0
  fi

  local answer
  if ! answer=$(python3 "${script}" --repo "${repo}" --artifact "${artifact}" \
      --policy "${policy}" 2>/dev/null); then
    echo "gated"
    return 0
  fi

  case "${answer}" in
    exempt) echo "exempt" ;;
    *) echo "gated" ;;
  esac
}
```

- [ ] **Step 5: Add the CLI entry point to gate_policy.py**

```python
def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", required=True, type=Path)
    parser.add_argument("--path")
    parser.add_argument("--repo")
    parser.add_argument("--artifact")
    parser.add_argument("--account")
    args = parser.parse_args(argv)

    try:
        policy = load_policy(args.policy)
    except PolicyError as err:
        print(f"gate_policy: {err}", file=sys.stderr)
        print(GATED)
        return 1

    destination = Destination(
        path=args.path, repo=args.repo, artifact=args.artifact, account=args.account
    )
    print(classify(destination, policy))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bash ~/Developer/dotfiles/tests/test-gh-wrapper-gate-policy.sh`
Expected: PASS, no output, exit 0

- [ ] **Step 7: Run shellcheck**

Run: `shellcheck -S info ~/Developer/dotfiles/bash/gh-wrapper.sh`
Expected: no output

- [ ] **Step 8: Commit, on a dotfiles branch**

```bash
git -C ~/Developer/dotfiles checkout -b claude/feat-gate-policy-shim
git -C ~/Developer/dotfiles add bash/gh-wrapper.sh tests/test-gh-wrapper-gate-policy.sh
git -C ~/Developer/dotfiles commit -m "feat(gh): ask the gate policy before requiring approval"
```

---

### Task 8: Document the boundary in SKILL.md and bump the version

**Files:**

- Modify: `SKILL.md`
- Modify: `.claude-plugin/plugin.json`
- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: every earlier task.

- [ ] **Step 1: Add the boundary section to SKILL.md**

Place it after the section describing the Pangram submission, as prose with no lettered groups and no dashes. It must state: purpose decides rather than visibility; the exempt list is Andrew's to declare and never Claude's to infer; an unlisted destination is gated; `andrewmrich` is always gated; and a `Human` verdict means no model was detected rather than that the text is fit to publish.

- [ ] **Step 2: Bump both versions in lockstep**

```bash
python3 - <<'PYEOF'
import json, pathlib, re
skill = pathlib.Path("SKILL.md")
text = skill.read_text(encoding="utf-8")
skill.write_text(re.sub(r"(?m)^version: 2\.0\.0$", "version: 2.1.0", text, count=1), encoding="utf-8")
p = pathlib.Path(".claude-plugin/plugin.json")
data = json.loads(p.read_text(encoding="utf-8"))
data["version"] = "2.1.0"
p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PYEOF
```

- [ ] **Step 3: Run the validator**

Run: `python3 scripts/validate_skill.py`
Expected: `SKILL.md is valid: frontmatter, version lockstep, no group references`

- [ ] **Step 4: Run the full suite**

Run: `python3 -m unittest discover -s tests -v && cd mcp-server && npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add SKILL.md .claude-plugin/plugin.json CLAUDE.md
git commit -m "docs(skill): document the review gate boundary"
```

---

## The identity signal already exists

An earlier draft of this section said nothing distinguishes the `andrewmrich`
identity. That was wrong: the check read `~/.gitconfig` and missed
`~/.config/git/config`. Measured 2026-09-22 on this machine and on
`arich-mac.local`:

- git: `includeIf "gitdir:~/Developer/beacon-biosignals/"` loads
  `~/.gitconfig-beacon`, which sets `user.email = andrew.rich@beacon.bio`.
- gh: `_gh_wrapper_sync_identity` in `gh-wrapper.sh` resolves a `desired`
  account per invocation, `andrewmrich` for `beacon-biosignals` and
  `andrewmrich` owners and for checkouts in the employer directory.

So `always_gated_accounts` consumes existing signals: the shim's `desired`
value for GitHub surfaces, and the resolved `user.email` for commits. No new
identity mechanism is needed. On this machine the mechanism is present and
inert, because there is no employer checkout, no `~/.gitconfig-beacon`, and no
`andrewmrich` gh login. The unit tests are the only exercise rule 1 gets here;
a live check belongs on `arich-mac.local`.
