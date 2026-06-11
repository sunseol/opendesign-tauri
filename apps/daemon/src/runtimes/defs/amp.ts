import { DEFAULT_MODEL_OPTION } from './shared.js';
import type { RuntimeAgentDef } from '../types.js';

// Amp CLI runs as a headless coding agent with a Claude-compatible JSONL
// stream, so the daemon can reuse the existing claude-stream-json parser.
const AMP_MODES = new Set(['deep', 'smart', 'rush']);

export const ampAgentDef = {
  id: 'amp',
  name: 'Amp',
  bin: 'amp',
  versionArgs: ['--version'],
  // The model picker selects Amp's agent mode.
  fallbackModels: [
    DEFAULT_MODEL_OPTION,
    { id: 'smart', label: 'Smart (mode)' },
    { id: 'deep', label: 'Deep (mode)' },
    { id: 'rush', label: 'Rush (mode)' },
  ],
  supportsCustomModel: false,
  buildArgs: (_prompt, _imagePaths, _extraAllowedDirs = [], options = {}) => {
    const args = ['-x', '--stream-json', '--dangerously-allow-all'];
    if (options.model && options.model !== 'default' && AMP_MODES.has(options.model)) {
      args.push('--mode', options.model);
    }
    return args;
  },
  promptViaStdin: true,
  streamFormat: 'claude-stream-json',
} satisfies RuntimeAgentDef;
