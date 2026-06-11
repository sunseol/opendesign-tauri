// Canonical prompt sent by the "Continue the run" affordance on a resumable
// failed run. It is intentionally not a replay of the original user turn: the
// daemon resumes the persisted CLI session for this conversation and agent.
export const RESUME_CONTINUE_PROMPT =
  'The previous turn was interrupted by a transient failure. ' +
  'If your last response was cut off, continue it from where you left off ' +
  'and keep any work already completed; otherwise complete the original ' +
  'request. Inspect the current project files as needed before making ' +
  'further changes.';
