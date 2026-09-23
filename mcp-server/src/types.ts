export type CliResult =
  { ok: true; text: string } | { ok: false; error: string };

export type VersionCheckResult =
  { stale: false } | { stale: true; installed: string; latest: string };

export type Outcome =
  | { kind: "verified"; text: string; sha256: string; taskId?: string }
  | { kind: "not_verified"; draft: string; sha256: string; report: string }
  | { kind: "failed"; error: string; report?: string };
