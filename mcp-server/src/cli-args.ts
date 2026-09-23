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

export type VoiceGuideInput = { path: string; realpath: string };

export type CliArgsInput = {
  installPath: string;
  voiceGuide: VoiceGuideInput | null;
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
//
// There is no configRoot rule: the only thing the skill reads under the
// config directory is VOICE.md, granted below by its own path and realpath.
// A blanket Read(//<configRoot>/**) would also expose the bridge's OAuth
// token file, which lives in the same directory.
export function buildCliArgs(input: CliArgsInput): string[] {
  const paths = [input.installPath, input.bodyPath];
  if (input.voiceGuide)
    paths.push(input.voiceGuide.path, input.voiceGuide.realpath);
  for (const path of paths) {
    if (!path.startsWith("/")) {
      throw new Error(`permission rule path must be absolute: ${path}`);
    }
  }
  const voiceRules = input.voiceGuide
    ? [
        `Read(/${input.voiceGuide.path})`,
        // A symlinked guide needs both rules: Claude Code checks a Read
        // against the symlink path and its resolved target separately.
        ...(input.voiceGuide.realpath !== input.voiceGuide.path
          ? [`Read(/${input.voiceGuide.realpath})`]
          : []),
      ]
    : [];
  const rules = [
    `Bash(python3 ${input.installPath}/scripts/pangram_check.py:*)`,
    `Read(/${input.installPath}/**)`,
    ...voiceRules,
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
