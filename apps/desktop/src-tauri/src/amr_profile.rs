use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};
use url::Url;

use crate::{discover_web_url, request_json_ipc, AppState, SIDECAR_MESSAGE_STATUS};

pub(crate) const APP_CONFIG_CHANGED_IPC_CHANNEL: &str = "od:app-config-changed";

const AMR_PROFILE_AGENT_ID: &str = "amr";
const AMR_PROFILE_ENV_KEY: &str = "OPEN_DESIGN_AMR_PROFILE";
const MENU_AMR_PROFILE_PROD_ID: &str = "amr-profile-prod";
const MENU_AMR_PROFILE_TEST_ID: &str = "amr-profile-test";
const MENU_AMR_PROFILE_LOCAL_ID: &str = "amr-profile-local";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum AmrEnvironmentProfile {
    Prod,
    Test,
    Local,
}

impl AmrEnvironmentProfile {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Prod => "prod",
            Self::Test => "test",
            Self::Local => "local",
        }
    }

    pub(crate) const fn menu_id(self) -> &'static str {
        match self {
            Self::Prod => MENU_AMR_PROFILE_PROD_ID,
            Self::Test => MENU_AMR_PROFILE_TEST_ID,
            Self::Local => MENU_AMR_PROFILE_LOCAL_ID,
        }
    }

    pub(crate) fn from_menu_id(menu_id: &str) -> Option<Self> {
        match menu_id {
            MENU_AMR_PROFILE_PROD_ID => Some(Self::Prod),
            MENU_AMR_PROFILE_TEST_ID => Some(Self::Test),
            MENU_AMR_PROFILE_LOCAL_ID => Some(Self::Local),
            _ => None,
        }
    }

    fn normalize(profile: Option<&str>) -> Self {
        match profile.map(str::trim) {
            Some("test") => Self::Test,
            Some("local") => Self::Local,
            Some("prod") | Some("") | None => Self::Prod,
            Some(_) => Self::Prod,
        }
    }
}

pub(crate) async fn read_current_amr_profile(
    app_handle: &AppHandle,
) -> Result<AmrEnvironmentProfile, String> {
    let config = read_app_config(app_handle).await?;
    Ok(AmrEnvironmentProfile::normalize(
        config
            .pointer("/agentCliEnv/amr/OPEN_DESIGN_AMR_PROFILE")
            .and_then(Value::as_str),
    ))
}

pub(crate) async fn write_current_amr_profile(
    app_handle: &AppHandle,
    profile: AmrEnvironmentProfile,
) -> Result<AmrEnvironmentProfile, String> {
    let config = read_app_config(app_handle).await?;
    let next_config = merge_amr_environment_profile_config(&config, profile);
    let written_config = write_app_config(app_handle, next_config).await?;
    Ok(AmrEnvironmentProfile::normalize(
        written_config
            .pointer("/agentCliEnv/amr/OPEN_DESIGN_AMR_PROFILE")
            .and_then(Value::as_str),
    ))
}

async fn read_app_config(app_handle: &AppHandle) -> Result<Value, String> {
    let state = app_handle.state::<AppState>();
    let url = app_config_url(&discover_daemon_url(&state).await?)?;
    let response = state
        .http
        .get(url)
        .send()
        .await
        .map_err(|error| format!("GET /api/app-config failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "GET /api/app-config failed with HTTP {}",
            response.status()
        ));
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("GET /api/app-config returned invalid JSON: {error}"))?;
    payload
        .get("config")
        .filter(|config| config.is_object())
        .cloned()
        .ok_or_else(|| "GET /api/app-config returned an invalid config payload".to_string())
}

async fn write_app_config(app_handle: &AppHandle, config: Value) -> Result<Value, String> {
    let state = app_handle.state::<AppState>();
    let url = app_config_url(&discover_daemon_url(&state).await?)?;
    let response = state
        .http
        .put(url)
        .json(&config)
        .send()
        .await
        .map_err(|error| format!("PUT /api/app-config failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "PUT /api/app-config failed with HTTP {}",
            response.status()
        ));
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("PUT /api/app-config returned invalid JSON: {error}"))?;
    payload
        .get("config")
        .filter(|config| config.is_object())
        .cloned()
        .ok_or_else(|| "PUT /api/app-config returned an invalid config payload".to_string())
}

async fn discover_daemon_url(state: &AppState) -> Result<String, String> {
    let status = request_json_ipc(
        &state.daemon_ipc,
        json!({ "type": SIDECAR_MESSAGE_STATUS }),
        800,
    )
    .await?;
    if let Some(url) = status
        .get("url")
        .and_then(Value::as_str)
        .filter(|url| !url.is_empty())
        .map(str::to_string)
    {
        return Ok(url);
    }
    discover_web_url(&state.web_ipc)
        .await
        .ok_or_else(|| "daemon URL is unavailable".to_string())
}

fn app_config_url(base_url: &str) -> Result<Url, String> {
    let mut url = Url::parse(base_url).map_err(|error| format!("invalid daemon URL: {error}"))?;
    url.set_path("/api/app-config");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

fn merge_amr_environment_profile_config(config: &Value, profile: AmrEnvironmentProfile) -> Value {
    let mut next = object_or_empty(config);
    let current_profile = AmrEnvironmentProfile::normalize(
        next.get("agentCliEnv")
            .and_then(Value::as_object)
            .and_then(|agent_cli_env| agent_cli_env.get(AMR_PROFILE_AGENT_ID))
            .and_then(Value::as_object)
            .and_then(|amr_env| amr_env.get(AMR_PROFILE_ENV_KEY))
            .and_then(Value::as_str),
    );
    if current_profile != profile {
        clear_amr_model(&mut next);
    }

    let mut agent_cli_env = next
        .get("agentCliEnv")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut amr_env = agent_cli_env
        .get(AMR_PROFILE_AGENT_ID)
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    amr_env.insert(
        AMR_PROFILE_ENV_KEY.to_string(),
        Value::String(profile.as_str().to_string()),
    );
    agent_cli_env.insert(AMR_PROFILE_AGENT_ID.to_string(), Value::Object(amr_env));
    next.insert("agentCliEnv".to_string(), Value::Object(agent_cli_env));
    Value::Object(next)
}

fn object_or_empty(value: &Value) -> Map<String, Value> {
    value.as_object().cloned().unwrap_or_default()
}

fn clear_amr_model(config: &mut Map<String, Value>) {
    let Some(agent_models) = config.get("agentModels").and_then(Value::as_object) else {
        return;
    };
    let mut next_agent_models = agent_models.clone();
    let had_amr_model = next_agent_models.remove(AMR_PROFILE_AGENT_ID).is_some();
    if had_amr_model {
        config.insert("agentModels".to_string(), Value::Object(next_agent_models));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_profile_config_clears_amr_model_when_profile_changes() {
        let config = json!({
            "agentModels": {
                "amr": { "model": "old-amr-model" },
                "codex": { "model": "gpt-5" }
            },
            "agentCliEnv": {
                "amr": {
                    "OPEN_DESIGN_AMR_PROFILE": "prod",
                    "VELA_BIN": "/usr/local/bin/vela"
                }
            }
        });

        let merged = merge_amr_environment_profile_config(&config, AmrEnvironmentProfile::Local);

        assert_eq!(
            merged.pointer("/agentCliEnv/amr/OPEN_DESIGN_AMR_PROFILE"),
            Some(&Value::String("local".to_string())),
        );
        assert_eq!(
            merged.pointer("/agentCliEnv/amr/VELA_BIN"),
            Some(&Value::String("/usr/local/bin/vela".to_string())),
        );
        assert_eq!(merged.pointer("/agentModels/amr"), None);
        assert_eq!(
            merged.pointer("/agentModels/codex/model"),
            Some(&Value::String("gpt-5".to_string())),
        );
    }

    #[test]
    fn merge_profile_config_keeps_amr_model_when_profile_stays_the_same() {
        let config = json!({
            "agentModels": {
                "amr": { "model": "current-amr-model" }
            },
            "agentCliEnv": {
                "amr": { "OPEN_DESIGN_AMR_PROFILE": "test" }
            }
        });

        let merged = merge_amr_environment_profile_config(&config, AmrEnvironmentProfile::Test);

        assert_eq!(
            merged.pointer("/agentModels/amr/model"),
            Some(&Value::String("current-amr-model".to_string())),
        );
        assert_eq!(
            merged.pointer("/agentCliEnv/amr/OPEN_DESIGN_AMR_PROFILE"),
            Some(&Value::String("test".to_string())),
        );
    }
}
