import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// tsconfig.json has outDir=dist, rootDir=src, so src/desktop-config.ts
// compiles to dist/desktop-config.js, not dist/src/desktop-config.js.
import {
  mergeConfig,
  DEFAULT_DESKTOP_CONFIG_PATH,
} from "../dist/desktop-config.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const launcherPath = join(scriptDir, "..", "bin", "personify-mcp");

async function main() {
  if (process.platform !== "darwin") {
    console.error(
      "install-desktop-config only supports macOS today. " +
        "See mcp-server/README.md's \"Configure in Claude Desktop\" section " +
        "for manual instructions on other platforms.",
    );
    process.exitCode = 1;
    return;
  }

  try {
    await access(launcherPath, constants.X_OK);
  } catch (err) {
    console.error(
      `${launcherPath} is missing or not executable (${err.code}). ` +
        `Restore it with "git checkout -- bin/personify-mcp" and ` +
        `"chmod +x bin/personify-mcp".`,
    );
    process.exitCode = 1;
    return;
  }

  let existing;
  try {
    const raw = await readFile(DEFAULT_DESKTOP_CONFIG_PATH, "utf8");
    existing = raw.trim().length === 0 ? undefined : JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      existing = undefined;
    } else if (err instanceof SyntaxError) {
      console.error(
        `${DEFAULT_DESKTOP_CONFIG_PATH} exists but is not valid JSON. ` +
          "Fix or remove it, then run this script again. Refusing to overwrite " +
          "a file that might contain other configuration.",
      );
      process.exitCode = 1;
      return;
    } else {
      throw err;
    }
  }

  let merged;
  try {
    merged = mergeConfig(existing, launcherPath);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  await mkdir(dirname(DEFAULT_DESKTOP_CONFIG_PATH), { recursive: true });
  await writeFile(
    DEFAULT_DESKTOP_CONFIG_PATH,
    JSON.stringify(merged, null, 2) + "\n",
    "utf8",
  );

  console.log(
    `Configured personify in ${DEFAULT_DESKTOP_CONFIG_PATH} (command: ${launcherPath}). ` +
      "Restart Claude Desktop for the change to take effect.",
  );
}

main().catch((err) => {
  console.error("install-desktop-config failed:", err.message);
  process.exitCode = 1;
});
