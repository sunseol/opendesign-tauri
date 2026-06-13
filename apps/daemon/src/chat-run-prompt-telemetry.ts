import {
  buildPromptStackTelemetry,
  type PromptStackTelemetry,
  type PromptTelemetryInputSection,
  type PromptTelemetrySectionKind,
} from './prompt-telemetry.js';

export interface ChatRunPromptTelemetryInput {
  readonly composedPrompt: string;
  readonly formOverride?: string | null;
  readonly daemonSystemPrompt?: string | null;
  readonly runtimeToolPrompt?: string | null;
  readonly researchCommandContract?: string | null;
  readonly runContextPrompt?: string | null;
  readonly browserUsePromptGuard?: string | null;
  readonly clientSystemPrompt?: string | null;
  readonly echoGuard?: string | null;
  readonly userRequestPrompt?: string | null;
  readonly skillPrompt?: string | null;
  readonly designSystemPrompt?: string | null;
  readonly pluginStagePrompt?: string | null;
  readonly cwdHint?: string | null;
  readonly cwd?: string | null;
  readonly linkedDirsHint?: string | null;
  readonly linkedDirs?: readonly unknown[] | null;
  readonly attachmentHint?: string | null;
  readonly attachments?: readonly unknown[] | null;
  readonly commentHint?: string | null;
  readonly commentAttachments?: readonly unknown[] | null;
  readonly imagePathHint?: string | null;
  readonly promptImagePaths?: readonly unknown[] | null;
}

function inputSection(
  kind: PromptTelemetrySectionKind,
  content: string | null | undefined,
  metadata?: unknown,
): PromptTelemetryInputSection {
  const section: {
    kind: PromptTelemetrySectionKind;
    content?: string | null;
    metadata?: unknown;
  } = { kind };
  if (content !== undefined) section.content = content;
  if (metadata !== undefined) section.metadata = metadata;
  return section;
}

export function buildChatRunPromptTelemetry(
  input: ChatRunPromptTelemetryInput,
): PromptStackTelemetry {
  const sections = [
    inputSection('formOverride', input.formOverride),
    inputSection('daemonSystemPrompt', input.daemonSystemPrompt),
    inputSection('runtimeToolPrompt', input.runtimeToolPrompt),
    inputSection('researchCommandContract', input.researchCommandContract),
    inputSection('runContextPrompt', input.runContextPrompt),
    inputSection('browserUsePromptGuard', input.browserUsePromptGuard),
    inputSection('clientSystemPrompt', input.clientSystemPrompt),
    inputSection('echoGuard', input.echoGuard),
    inputSection('userRequest', input.userRequestPrompt),
    inputSection('skillPrompt', input.skillPrompt),
    inputSection('designSystemPrompt', input.designSystemPrompt),
    inputSection('pluginStagePrompt', input.pluginStagePrompt),
    inputSection('cwdHint', input.cwdHint, input.cwd ? [input.cwd] : undefined),
    inputSection(
      'linkedDirsHint',
      input.linkedDirsHint,
      input.linkedDirs ?? undefined,
    ),
    inputSection('attachments', input.attachmentHint, input.attachments ?? undefined),
    inputSection(
      'commentAttachments',
      input.commentHint,
      input.commentAttachments ?? undefined,
    ),
    inputSection(
      'promptImagePaths',
      input.imagePathHint,
      input.promptImagePaths ?? undefined,
    ),
  ];

  return buildPromptStackTelemetry({
    composedPrompt: input.composedPrompt,
    sections,
  });
}
