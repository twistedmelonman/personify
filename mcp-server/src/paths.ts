import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// Must match config_root() in scripts/pangram_check.py, which decides where
// stamps are written. An empty XDG_CONFIG_HOME falls through, as it does in
// Python's `or`.
export function configRoot(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "personify");
}

// Same lookup order as SKILL.md Step 0. The realpath is what the CLI's Read
// rule has to name, since ~/.config/personify/VOICE.md is usually a symlink.
export async function resolveVoiceGuide(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const candidate = env.PERSONIFY_VOICE || join(configRoot(env), "VOICE.md");
  try {
    return await realpath(candidate);
  } catch {
    // No guide is a supported state: the skill falls back to
    // VOICE.example.md, which the installPath Read rule already covers.
    return null;
  }
}
