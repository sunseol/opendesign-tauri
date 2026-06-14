export {
  AGENT_SLUGS,
  isAgentSlug,
  type AgentSlug,
  type CliInstallPlan,
  type InstallPlan,
  type JsonInstallPlan,
  type ManualInstallPlan,
  type McpLaunchSpec,
  type PlanContext,
} from './mcp-agent-install-types.js';
export { planAgentInstall } from './mcp-agent-install-plan.js';
export { applyJsonInstall, removeJsonInstall } from './mcp-agent-install-json.js';
