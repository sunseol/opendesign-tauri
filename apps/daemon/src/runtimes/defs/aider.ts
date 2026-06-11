import { DEFAULT_MODEL_OPTION } from './shared.js';
import type { RuntimeAgentDef } from '../types.js';

export const aiderAgentDef = {
  id: 'aider',
  name: 'Aider',
  bin: 'aider',
  versionArgs: ['--version'],
  fallbackModels: [
    DEFAULT_MODEL_OPTION,
    { id: 'sonnet', label: 'sonnet' },
    { id: 'gpt-4o', label: 'gpt-4o' },
    { id: 'deepseek/deepseek-chat', label: 'deepseek/deepseek-chat' },
    { id: 'gemini/gemini-2.0-flash', label: 'gemini/gemini-2.0-flash' },
  ],
  buildArgs: (prompt, _imagePaths, _extra, options = {}) => {
    const args = [
      '--yes-always',
      '--no-pretty',
      '--no-git',
      '--no-auto-commits',
      '--no-suggest-shell-commands',
      '--no-show-model-warnings',
    ];
    if (options.model && options.model !== 'default') {
      args.push('--model', options.model);
    }
    args.push('--message', prompt);
    return args;
  },
  maxPromptArgBytes: 30_000,
  streamFormat: 'plain',
  installUrl: 'https://aider.chat/docs/install.html',
  docsUrl: 'https://aider.chat',
} satisfies RuntimeAgentDef;
