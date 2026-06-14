use std::sync::{Arc, Mutex};

use serde_json::json;
use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, SubmenuBuilder},
    App, AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::{
    amr_profile::{
        read_current_amr_profile, write_current_amr_profile, AmrEnvironmentProfile,
        APP_CONFIG_CHANGED_IPC_CHANNEL,
    },
    stop_packaged_sidecars, AppState,
};

const MENU_APP_SHOW_ID: &str = "app-show";
const MENU_APP_QUIT_ID: &str = "app-quit";
const MENU_HELP_DOCUMENTATION_ID: &str = "help-documentation";
const MENU_HELP_CONTACT_ID: &str = "help-contact";
const MENU_HELP_REPORT_ISSUE_ID: &str = "help-report-issue";
const MENU_HELP_DISCORD_ID: &str = "help-discord";
const HELP_DOCUMENTATION_URL: &str = "https://github.com/sunseol/opendesign-tauri#readme";
const HELP_CONTACT_URL: &str = "https://x.com/nexudotio";
const HELP_REPORT_ISSUE_URL: &str = "https://github.com/sunseol/opendesign-tauri/issues/new";
const HELP_DISCORD_URL: &str = "https://discord.gg/mHAjSMV6gz";

#[derive(Debug)]
struct DesktopMenuState {
    develop_menu_visible: bool,
    last_known_amr_profile: AmrEnvironmentProfile,
}

impl Default for DesktopMenuState {
    fn default() -> Self {
        Self {
            develop_menu_visible: false,
            last_known_amr_profile: AmrEnvironmentProfile::Prod,
        }
    }
}

type SharedDesktopMenuState = Arc<Mutex<DesktopMenuState>>;

pub fn install_desktop_menu(app: &App) -> Result<(), String> {
    let menu_state = Arc::new(Mutex::new(DesktopMenuState::default()));
    let app_handle = app.handle().clone();
    rebuild_desktop_menu(&app_handle, &menu_state)?;

    let event_state = Arc::clone(&menu_state);
    app.on_menu_event(move |app_handle, event| {
        let id = event.id().0.as_str();
        if let Some(profile) = AmrEnvironmentProfile::from_menu_id(id) {
            let app_handle = app_handle.clone();
            let menu_state = Arc::clone(&event_state);
            tauri::async_runtime::spawn(async move {
                if let Err(error) = select_amr_profile(app_handle, menu_state, profile).await {
                    eprintln!("[open-design tauri] AMR Profile switch failed: {error}");
                }
            });
            return;
        }

        match id {
            MENU_APP_SHOW_ID => show_main_window(app_handle),
            MENU_APP_QUIT_ID => quit_from_menu(app_handle),
            MENU_HELP_DOCUMENTATION_ID => open_menu_url("Documentation", HELP_DOCUMENTATION_URL),
            MENU_HELP_CONTACT_ID => open_menu_url("Contact Us", HELP_CONTACT_URL),
            MENU_HELP_REPORT_ISSUE_ID => open_menu_url("Report Issue", HELP_REPORT_ISSUE_URL),
            MENU_HELP_DISCORD_ID => open_menu_url("Join Discord", HELP_DISCORD_URL),
            _ => {}
        }
    });

    install_develop_menu_shortcut(app, menu_state)
}

fn show_main_window(app_handle: &AppHandle) {
    let Some(window) = app_handle.get_webview_window("main") else {
        return;
    };
    if let Err(error) = window.show() {
        eprintln!("[open-design tauri] menu show failed: {error}");
    }
    if let Err(error) = window.set_focus() {
        eprintln!("[open-design tauri] menu focus failed: {error}");
    }
}

fn quit_from_menu(app_handle: &AppHandle) {
    let state = app_handle.state::<AppState>();
    stop_packaged_sidecars(&state);
    app_handle.exit(0);
}

fn open_menu_url(label: &str, url: &str) {
    if let Err(error) = open::that(url) {
        eprintln!("[open-design tauri] Help menu item {label} failed to open {url}: {error}");
    }
}

fn rebuild_desktop_menu(
    app_handle: &AppHandle,
    menu_state: &SharedDesktopMenuState,
) -> Result<(), String> {
    let (develop_menu_visible, selected_profile) = {
        let state = menu_state
            .lock()
            .map_err(|_| "desktop menu state lock poisoned".to_string())?;
        (state.develop_menu_visible, state.last_known_amr_profile)
    };

    let app_menu = SubmenuBuilder::new(app_handle, "Open Design")
        .text(MENU_APP_SHOW_ID, "Show Open Design")
        .separator()
        .text(MENU_APP_QUIT_ID, "Quit Open Design")
        .build()
        .map_err(|error| error.to_string())?;
    let help_menu = SubmenuBuilder::new(app_handle, "Help")
        .text(MENU_HELP_DOCUMENTATION_ID, "Documentation")
        .separator()
        .text(MENU_HELP_CONTACT_ID, "Contact Us")
        .text(MENU_HELP_REPORT_ISSUE_ID, "Report Issue")
        .text(MENU_HELP_DISCORD_ID, "Join Discord")
        .build()
        .map_err(|error| error.to_string())?;

    if develop_menu_visible {
        let develop_menu = build_develop_menu(app_handle, selected_profile)?;
        let menu = MenuBuilder::new(app_handle)
            .items(&[&app_menu, &develop_menu, &help_menu])
            .build()
            .map_err(|error| error.to_string())?;
        app_handle
            .set_menu(menu)
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    let menu = MenuBuilder::new(app_handle)
        .items(&[&app_menu, &help_menu])
        .build()
        .map_err(|error| error.to_string())?;
    app_handle
        .set_menu(menu)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn build_develop_menu(
    app_handle: &AppHandle,
    selected_profile: AmrEnvironmentProfile,
) -> Result<tauri::menu::Submenu<tauri::Wry>, String> {
    let prod = build_amr_profile_item(app_handle, AmrEnvironmentProfile::Prod, selected_profile)?;
    let test = build_amr_profile_item(app_handle, AmrEnvironmentProfile::Test, selected_profile)?;
    let local = build_amr_profile_item(app_handle, AmrEnvironmentProfile::Local, selected_profile)?;
    let amr_profile_menu = SubmenuBuilder::new(app_handle, "AMR Profile")
        .items(&[&prod, &test, &local])
        .build()
        .map_err(|error| error.to_string())?;

    SubmenuBuilder::new(app_handle, "Develop")
        .items(&[&amr_profile_menu])
        .build()
        .map_err(|error| error.to_string())
}

fn build_amr_profile_item(
    app_handle: &AppHandle,
    profile: AmrEnvironmentProfile,
    selected_profile: AmrEnvironmentProfile,
) -> Result<tauri::menu::CheckMenuItem<tauri::Wry>, String> {
    CheckMenuItemBuilder::with_id(profile.menu_id(), profile.as_str())
        .checked(profile == selected_profile)
        .build(app_handle)
        .map_err(|error| error.to_string())
}

fn install_develop_menu_shortcut(
    app: &App,
    menu_state: SharedDesktopMenuState,
) -> Result<(), String> {
    let shortcut = develop_menu_shortcut();
    let handler_shortcut = shortcut;
    let shortcut_state = Arc::clone(&menu_state);
    app.handle()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app_handle, shortcut, event| {
                    if shortcut != &handler_shortcut || event.state != ShortcutState::Pressed {
                        return;
                    }
                    let app_handle = app_handle.clone();
                    let menu_state = Arc::clone(&shortcut_state);
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = toggle_develop_menu(app_handle, menu_state).await {
                            eprintln!("[open-design tauri] Develop menu unavailable: {error}");
                        }
                    });
                })
                .build(),
        )
        .map_err(|error| error.to_string())?;
    app.global_shortcut()
        .register(shortcut)
        .map_err(|error| error.to_string())
}

fn develop_menu_shortcut() -> Shortcut {
    Shortcut::new(Some(develop_menu_shortcut_modifiers()), Code::KeyD)
}

fn develop_menu_shortcut_modifiers() -> Modifiers {
    #[cfg(target_os = "macos")]
    {
        Modifiers::SUPER | Modifiers::ALT | Modifiers::SHIFT
    }

    #[cfg(not(target_os = "macos"))]
    {
        Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT
    }
}

async fn toggle_develop_menu(
    app_handle: AppHandle,
    menu_state: SharedDesktopMenuState,
) -> Result<(), String> {
    let should_hide = {
        let state = menu_state
            .lock()
            .map_err(|_| "desktop menu state lock poisoned".to_string())?;
        state.develop_menu_visible
    };
    if should_hide {
        {
            let mut state = menu_state
                .lock()
                .map_err(|_| "desktop menu state lock poisoned".to_string())?;
            state.develop_menu_visible = false;
        }
        return rebuild_desktop_menu(&app_handle, &menu_state);
    }

    let profile = read_current_amr_profile(&app_handle).await?;
    {
        let mut state = menu_state
            .lock()
            .map_err(|_| "desktop menu state lock poisoned".to_string())?;
        state.last_known_amr_profile = profile;
        state.develop_menu_visible = true;
    }
    rebuild_desktop_menu(&app_handle, &menu_state)
}

async fn select_amr_profile(
    app_handle: AppHandle,
    menu_state: SharedDesktopMenuState,
    profile: AmrEnvironmentProfile,
) -> Result<(), String> {
    let written_profile = write_current_amr_profile(&app_handle, profile).await?;
    {
        let mut state = menu_state
            .lock()
            .map_err(|_| "desktop menu state lock poisoned".to_string())?;
        state.last_known_amr_profile = written_profile;
    }
    app_handle
        .emit(APP_CONFIG_CHANGED_IPC_CHANNEL, json!({}))
        .map_err(|error| error.to_string())?;
    rebuild_desktop_menu(&app_handle, &menu_state)
}
