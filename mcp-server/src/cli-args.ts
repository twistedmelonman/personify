// The instruction names the publish file and nothing else. It restates no
// rule from SKILL.md: step 2 of the skill already writes the result to "the
// file it will publish from", so naming that file is the whole contract.
export function buildInstruction(bodyPath: string): string {
  return (
    "Run the personify:personify skill on the text provided via stdin. " +
    `The file this text publishes from is ${bodyPath}. Write your final ` +
    "text to that file, then follow the skill's check against it."
  );
}

export type CliArgsInput = {
  installPath: string;
  configRoot: string;
  voiceGuidePath: string | null;
  bodyPath: string;
};

// Every rule here was measured on 2026-09-22 (see the spec). Under --print,
// anything not listed is denied without a prompt, which is the fail-closed
// behavior this relies on. Absolute paths in a permission rule take one
// extra leading slash, and file writes are granted by Edit, not Write.
// The double slash is not a typo: in a rule, `/path` is relative to the
// settings source (the working directory for CLI flags) and only `//path`
// is the filesystem root. See "Read and Edit" path patterns in
// https://code.claude.com/docs/en/permissions.
export function buildCliArgs(input: CliArgsInput): string[] {
  const paths = [input.installPath, input.configRoot, input.bodyPath];
  if (input.voiceGuidePath) paths.push(input.voiceGuidePath);
  for (const path of paths) {
    if (!path.startsWith("/")) {
      throw new Error(`permission rule path must be absolute: ${path}`);
    }
  }
  const rules = [
    `Bash(python3 ${input.installPath}/scripts/pangram_check.py:*)`,
    `Read(/${input.configRoot}/**)`,
    `Read(/${input.installPath}/**)`,
    ...(input.voiceGuidePath ? [`Read(/${input.voiceGuidePath})`] : []),
    // The check reads the file through a `< body.md` redirect, which the CLI
    // checks as a Read; Edit alone let the model write it but not check it.
    `Read(/${input.bodyPath})`,
    `Edit(/${input.bodyPath})`,
  ];
  // The prompt must come before --allowedTools, which is variadic.
  return [
    "--print",
    buildInstruction(input.bodyPath),
    "--output-format",
    "json",
    "--allowedTools",
    ...rules,
  ];
}
