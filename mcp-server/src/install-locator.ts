import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_INSTALLED_PLUGINS_PATH = join(
  homedir(),
  ".claude/plugins/installed_plugins.json",
);

const PLUGIN_KEY = "personify@personify";

export type InstalledEntry = { installPath: string; version: string };
export type InstallLocation = InstalledEntry & { scriptPath: string };

export async function readInstalledEntry(
  path: string = DEFAULT_INSTALLED_PLUGINS_PATH,
): Promise<InstalledEntry | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    const entry = parsed?.plugins?.[PLUGIN_KEY]?.[0];
    if (
      typeof entry?.installPath !== "string" ||
      typeof entry?.version !== "string"
    ) {
      return null;
    }
    return { installPath: entry.installPath, version: entry.version };
  } catch {
    return null;
  }
}

// The bridge runs the installed copy of the check script, the same one the
// CLI's skill loads, so there is one script with three callers.
export async function locateInstall(
  path: string = DEFAULT_INSTALLED_PLUGINS_PATH,
): Promise<InstallLocation | null> {
  const entry = await readInstalledEntry(path);
  if (!entry || !entry.installPath.startsWith("/")) return null;
  const scriptPath = join(entry.installPath, "scripts", "pangram_check.py");
  try {
    await access(scriptPath, constants.R_OK);
  } catch {
    return null;
  }
  return { ...entry, scriptPath };
}
