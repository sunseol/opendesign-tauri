export interface OpenCodeCliFailureDiagnosticInput {
  readonly exitCode: number | null;
  readonly stderrTail: string;
  readonly stdoutTail: string;
}

const OPEN_CODE_UPDATE_GUIDANCE =
  'OpenCode CLI appears to be outdated or incompatible with Open Design\'s JSON run mode. ' +
  'Update it with `npm i -g opencode-ai@latest`, then retry the OpenCode runtime test.';

function looksLikeOutdatedOpenCodeHelp(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ');
  return (
    (/default ["']?text["']?/i.test(normalized) &&
      /--prompt string Prompt to run in non-interactive mode/i.test(normalized) &&
      /--version Version/i.test(normalized)) ||
    /unknown (?:option|flag).*--format/i.test(normalized) ||
    /invalid (?:option|flag|choice).*json/i.test(normalized)
  );
}

export function diagnoseOpenCodeCliFailure(
  input: OpenCodeCliFailureDiagnosticInput,
): string | null {
  if (input.exitCode === 0 || input.exitCode === null) return null;
  const text = `${input.stderrTail}\n${input.stdoutTail}`;
  if (!looksLikeOutdatedOpenCodeHelp(text)) return null;
  return OPEN_CODE_UPDATE_GUIDANCE;
}
