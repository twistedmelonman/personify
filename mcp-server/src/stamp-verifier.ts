import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type StampCheck =
  | { verified: true; sha256: string; taskId?: string }
  | { verified: false; sha256: string };

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// The stamp is the only agreement between this bridge and the skill.
// pangram_check.py writes <stamps>/<sha256 of raw stdin>.json on a Human
// verdict and on nothing else, so a matching stamp means these exact bytes
// were classified Human. Anything short of that is not verified: drift fails
// closed.
export async function checkStamp(
  bytes: Buffer,
  stampsDir: string,
): Promise<StampCheck> {
  const sha256 = sha256Hex(bytes);
  let stamp: unknown;
  try {
    stamp = JSON.parse(
      await readFile(join(stampsDir, `${sha256}.json`), "utf8"),
    );
  } catch {
    // Absent or unreadable is the normal not-verified case, not an error.
    return { verified: false, sha256 };
  }
  const record = stamp as {
    verdict?: unknown;
    sha256?: unknown;
    task_id?: unknown;
  };
  if (record?.verdict !== "Human" || record?.sha256 !== sha256) {
    return { verified: false, sha256 };
  }
  return {
    verified: true,
    sha256,
    ...(typeof record.task_id === "string" ? { taskId: record.task_id } : {}),
  };
}
