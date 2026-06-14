import type { McpLaunchSpec } from './mcp-agent-install-types.js';

type JsonObject = Record<string, unknown>;

export function genericMcpServersSnippet(spec: McpLaunchSpec, name: string): string {
  const server: JsonObject = {
    command: spec.command,
    args: spec.args,
  };
  if (Object.keys(spec.env).length > 0) {
    server.env = spec.env;
  }
  return JSON.stringify({ mcpServers: { [name]: server } }, null, 2);
}

export function hermesYamlSnippet(spec: McpLaunchSpec, name: string): string {
  const lines = [
    'mcp_servers:',
    `  ${name}:`,
    `    command: ${JSON.stringify(spec.command)}`,
    `    args: ${JSON.stringify(spec.args)}`,
  ];
  const envEntries = Object.entries(spec.env);
  if (envEntries.length > 0) {
    lines.push('    env:');
    for (const [key, value] of envEntries) {
      lines.push(`      ${key}: ${JSON.stringify(value)}`);
    }
  }
  return lines.join('\n');
}

export function vibeTomlSnippet(spec: McpLaunchSpec, name: string): string {
  const argsToml = `[${spec.args.map((arg) => JSON.stringify(arg)).join(', ')}]`;
  return [
    '[[mcp_servers]]',
    `name = ${JSON.stringify(name)}`,
    'transport = "stdio"',
    `command = ${JSON.stringify(spec.command)}`,
    `args = ${argsToml}`,
  ].join('\n');
}
