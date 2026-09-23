import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// tsc never deletes output for a removed source file, so a stale module in
// dist/ would keep loading after its source is gone.
rmSync(join(dirname(fileURLToPath(import.meta.url)), "..", "dist"), {
  recursive: true,
  force: true,
});
