import type { Express } from 'express';

import {
  agentCliEnvForAgent,
  type AppConfigPrefs,
  type AgentCliEnvPrefs,
} from './app-config.js';
import {
  cancelVelaLogin,
  forgetVelaLogin,
  mergeVelaEnv,
  readVelaLoginStatus,
  spawnVelaLogin,
} from './integrations/vela.js';
import { amrModelLoadingCache } from './runtimes/amr-model-cache.js';
import type { RouteDeps } from './server-context.js';

export interface RegisterVelaRoutesDeps extends RouteDeps<'http' | 'paths' | 'appConfig'> {}

const AMR_AUTH_ENV_KEYS = ['VELA_RUNTIME_KEY', 'VELA_LINK_URL'] as const;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stripSettingsAmrAuthEnv(appConfig: AppConfigPrefs): AppConfigPrefs {
  const currentAgentCliEnv = appConfig.agentCliEnv ?? {};
  const currentAmrEnv = currentAgentCliEnv.amr ?? {};
  const nextAmrEnv: Record<string, string> = { ...currentAmrEnv };
  for (const key of AMR_AUTH_ENV_KEYS) {
    delete nextAmrEnv[key];
  }

  const nextAgentCliEnv: AgentCliEnvPrefs = { ...currentAgentCliEnv };
  if (Object.keys(nextAmrEnv).length > 0) {
    nextAgentCliEnv.amr = nextAmrEnv;
  } else {
    delete nextAgentCliEnv.amr;
  }

  const nextConfig: AppConfigPrefs = { ...appConfig };
  if (Object.keys(nextAgentCliEnv).length > 0) {
    nextConfig.agentCliEnv = nextAgentCliEnv;
  } else {
    delete nextConfig.agentCliEnv;
  }
  return nextConfig;
}

export function registerVelaRoutes(app: Express, ctx: RegisterVelaRoutesDeps) {
  const { isLocalSameOrigin, resolvedPortRef } = ctx.http;
  const { RUNTIME_DATA_DIR } = ctx.paths;
  const { readAppConfig, writeAppConfig } = ctx.appConfig;
  const getResolvedPort = () => resolvedPortRef.current;

  const readConfiguredAmrEnv = async (): Promise<Record<string, string>> => {
    const appConfig = await readAppConfig(RUNTIME_DATA_DIR);
    return agentCliEnvForAgent(appConfig.agentCliEnv, 'amr');
  };

  app.get('/api/integrations/vela/status', async (req, res) => {
    if (!isLocalSameOrigin(req, getResolvedPort())) {
      return res.status(403).json({ error: 'cross-origin request rejected' });
    }
    try {
      const configuredEnv = await readConfiguredAmrEnv();
      res.json(readVelaLoginStatus(process.env, configuredEnv));
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  app.post('/api/integrations/vela/login', async (req, res) => {
    if (!isLocalSameOrigin(req, getResolvedPort())) {
      return res.status(403).json({ error: 'cross-origin request rejected' });
    }
    try {
      const configuredEnv = await readConfiguredAmrEnv();
      const result = await spawnVelaLogin({
        baseEnv: process.env,
        configuredEnv,
      });
      amrModelLoadingCache.reset();
      res.status(202).json(result);
    } catch (err) {
      const message = errorMessage(err);
      const status = /already running/i.test(message) ? 409 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/integrations/vela/login/cancel', async (req, res) => {
    if (!isLocalSameOrigin(req, getResolvedPort())) {
      return res.status(403).json({ error: 'cross-origin request rejected' });
    }
    res.json(cancelVelaLogin());
  });

  app.post('/api/integrations/vela/logout', async (req, res) => {
    if (!isLocalSameOrigin(req, getResolvedPort())) {
      return res.status(403).json({ error: 'cross-origin request rejected' });
    }
    try {
      const appConfig = await readAppConfig(RUNTIME_DATA_DIR);
      const configuredEnv = agentCliEnvForAgent(appConfig.agentCliEnv, 'amr');
      const mergedEnv = mergeVelaEnv(process.env, configuredEnv);
      forgetVelaLogin(mergedEnv);
      for (const key of AMR_AUTH_ENV_KEYS) {
        delete process.env[key];
      }
      await writeAppConfig(RUNTIME_DATA_DIR, stripSettingsAmrAuthEnv(appConfig));
      amrModelLoadingCache.reset();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });
}
