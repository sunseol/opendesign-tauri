import { agentCapabilities } from '../capabilities.js';
import { DEFAULT_MODEL_OPTION } from './shared.js';
import type { RuntimeAgentDef } from '../types.js';

const CODEBUDDY_FALLBACK_MODELS = [
  DEFAULT_MODEL_OPTION,
  { id: 'glm-5.1-ioa', label: 'glm-5.1-ioa' },
  { id: 'glm-5v-turbo-ioa', label: 'glm-5v-turbo-ioa' },
  { id: 'claude-opus-4.8-1m', label: 'claude-opus-4.8-1m' },
  { id: 'claude-opus-4.8', label: 'claude-opus-4.8' },
  { id: 'claude-sonnet-4.6-1m', label: 'claude-sonnet-4.6-1m' },
  { id: 'claude-haiku-4.5', label: 'claude-haiku-4.5' },
  { id: 'gpt-5.5', label: 'gpt-5.5' },
  { id: 'gpt-5.4', label: 'gpt-5.4' },
  { id: 'gpt-5.3-codex', label: 'gpt-5.3-codex' },
  { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash' },
  { id: 'deepseek-v4-pro-ioa', label: 'deepseek-v4-pro-ioa' },
  { id: 'deepseek-v4-flash-ioa', label: 'deepseek-v4-flash-ioa' },
  { id: 'kimi-k2.6-ioa', label: 'kimi-k2.6-ioa' },
  { id: 'minimax-m3-ioa', label: 'minimax-m3-ioa' },
  { id: 'minimax-m2.7-ioa', label: 'minimax-m2.7-ioa' },
];

export const codebuddyAgentDef = {
  id: 'codebuddy',
  name: 'Codebuddy Code',
  bin: 'codebuddy',
  fallbackBins: ['cbc'],
  versionArgs: ['--version'],
  helpArgs: ['-p', '--help'],
  capabilityFlags: {
    '--include-partial-messages': 'partialMessages',
    '--add-dir': 'addDir',
  },
  fallbackModels: CODEBUDDY_FALLBACK_MODELS,
  reasoningOptions: [
    { id: 'default', label: 'Default' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'xhigh', label: 'XHigh' },
    { id: 'max', label: 'Max' },
  ],
  buildArgs: (_prompt, _imagePaths, extraAllowedDirs = [], options = {}) => {
    const caps = agentCapabilities.get('codebuddy') || {};
    const args = [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
    ];
    if (caps.partialMessages) {
      args.push('--include-partial-messages');
    }
    if (options.model && options.model !== 'default') {
      args.push('--model', options.model);
    }
    if (options.reasoning && options.reasoning !== 'default') {
      args.push('--effort', options.reasoning);
    }
    const dirs = (extraAllowedDirs || []).filter(
      (d) => typeof d === 'string' && d.length > 0,
    );
    if (dirs.length > 0 && caps.addDir !== false) {
      args.push('--add-dir', ...dirs);
    }
    args.push('--permission-mode', 'bypassPermissions');
    return args;
  },
  promptViaStdin: true,
  promptInputFormat: 'stream-json',
  streamFormat: 'claude-stream-json',
  externalMcpInjection: 'claude-mcp-json',
} satisfies RuntimeAgentDef;
