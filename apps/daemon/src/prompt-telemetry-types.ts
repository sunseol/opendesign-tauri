export const PROMPT_STACK_REDACTION_VERSION = 'prompt-stack-redaction-v1';
export const PROMPT_STACK_PATH_MARKER = '[REDACTED:path]';
export const PROMPT_STACK_KIB = 1024;
export const PROMPT_STACK_DAEMON_SYSTEM_PROMPT_MAX_BYTES =
  128 * PROMPT_STACK_KIB;
export const PROMPT_STACK_SECTION_MAX_BYTES = 64 * PROMPT_STACK_KIB;
export const PROMPT_STACK_TOTAL_CONTENT_MAX_BYTES = 512 * PROMPT_STACK_KIB;

export type PromptTelemetrySectionKind =
  | 'formOverride'
  | 'daemonSystemPrompt'
  | 'runtimeToolPrompt'
  | 'researchCommandContract'
  | 'runContextPrompt'
  | 'clientSystemPrompt'
  | 'echoGuard'
  | 'userRequest'
  | 'skillPrompt'
  | 'designSystemPrompt'
  | 'pluginStagePrompt'
  | 'cwdHint'
  | 'linkedDirsHint'
  | 'attachments'
  | 'commentAttachments'
  | 'promptImagePaths';

export interface PromptTelemetryInputSection {
  readonly kind: PromptTelemetrySectionKind;
  readonly content?: string | null;
  readonly captureContent?: boolean;
  readonly metadata?: unknown;
}

export interface PromptTelemetrySection {
  readonly kind: PromptTelemetrySectionKind;
  readonly ordinal: number;
  readonly present: boolean;
  readonly contentMode: 'redacted-section-content' | 'metadata-only';
  readonly rawBytes: number;
  readonly redactedBytes: number;
  readonly fingerprint: string;
  readonly truncated: boolean;
  readonly truncationReason?: 'section_byte_limit' | 'total_budget_exceeded';
  readonly redactedContent?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface PromptStackTelemetry {
  readonly redactionVersion: typeof PROMPT_STACK_REDACTION_VERSION;
  readonly promptFingerprint: string;
  readonly stackFingerprint: string;
  readonly rawBytes: number;
  readonly redactedBytes: number;
  readonly sectionCount: number;
  readonly redactedContentBytes: number;
  readonly redactedContentBudgetBytes: number;
  readonly sections: readonly PromptTelemetrySection[];
}

export interface StructuredPromptStackInput {
  readonly type: 'open-design.prompt-stack';
  readonly redactionVersion: typeof PROMPT_STACK_REDACTION_VERSION;
  readonly promptFingerprint: string;
  readonly stackFingerprint: string;
  readonly sectionCount: number;
  readonly redactedContentBytes: number;
  readonly redactedContentBudgetBytes: number;
  readonly sections: readonly {
    readonly kind: PromptTelemetrySectionKind;
    readonly ordinal: number;
    readonly contentMode: PromptTelemetrySection['contentMode'];
    readonly rawBytes: number;
    readonly redactedBytes: number;
    readonly fingerprint: string;
    readonly truncated: boolean;
    readonly truncationReason?: PromptTelemetrySection['truncationReason'];
    readonly redactedContent?: string;
    readonly metadata?: Record<string, unknown>;
  }[];
}
