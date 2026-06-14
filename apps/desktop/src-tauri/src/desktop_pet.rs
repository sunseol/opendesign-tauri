use tauri::{webview::Color, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

pub(crate) const DESKTOP_PET_WINDOW_LABEL: &str = "desktop-pet";

const DESKTOP_PET_WINDOW_WIDTH: f64 = 360.0;
const DESKTOP_PET_WINDOW_HEIGHT: f64 = 300.0;
const DESKTOP_PET_WINDOW_MARGIN: f64 = 24.0;

pub(crate) fn install_desktop_pet_window(app_handle: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app_handle.get_webview_window(DESKTOP_PET_WINDOW_LABEL) {
        return Ok(window);
    }
    let (x, y) = desktop_pet_position(app_handle);
    WebviewWindowBuilder::new(
        app_handle,
        DESKTOP_PET_WINDOW_LABEL,
        WebviewUrl::App("pending.html".into()),
    )
    .title("Open Design Pet")
    .inner_size(DESKTOP_PET_WINDOW_WIDTH, DESKTOP_PET_WINDOW_HEIGHT)
    .position(x, y)
    .visible(false)
    .decorations(false)
    .transparent(true)
    .background_color(Color(0, 0, 0, 0))
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .visible_on_all_workspaces(true)
    .focusable(false)
    .shadow(false)
    .build()
    .map_err(|error| error.to_string())
}

fn desktop_pet_position(app_handle: &AppHandle) -> (f64, f64) {
    let Ok(Some(monitor)) = app_handle.primary_monitor() else {
        return (DESKTOP_PET_WINDOW_MARGIN, DESKTOP_PET_WINDOW_MARGIN);
    };
    let position = monitor.position();
    let size = monitor.size();
    (
        f64::from(position.x) + f64::from(size.width)
            - DESKTOP_PET_WINDOW_WIDTH
            - DESKTOP_PET_WINDOW_MARGIN,
        f64::from(position.y) + f64::from(size.height)
            - DESKTOP_PET_WINDOW_HEIGHT
            - DESKTOP_PET_WINDOW_MARGIN,
    )
}

fn desktop_pet_url(base_url: &str) -> Result<Url, String> {
    let mut url = Url::parse(base_url)
        .map_err(|error| format!("desktop pet base URL was invalid: {error}"))?;
    url.set_path("/desktop-pet");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

pub(crate) fn navigate_desktop_pet_window(
    window: &WebviewWindow,
    base_url: &str,
) -> Result<Option<String>, String> {
    let url = desktop_pet_url(base_url)?;
    let loaded_url = url.to_string();
    if window.url().ok().as_ref().map(Url::as_str) == Some(loaded_url.as_str()) {
        return Ok(None);
    }
    window.navigate(url).map_err(|error| error.to_string())?;
    Ok(Some(loaded_url))
}

pub(crate) fn set_desktop_pet_visible(window: &WebviewWindow, visible: bool) -> Result<(), String> {
    if visible {
        window.show().map_err(|error| error.to_string())
    } else {
        window.hide().map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::desktop_pet_url;

    #[test]
    fn desktop_pet_url_replaces_path_when_base_url_has_state() -> Result<(), String> {
        let url = desktop_pet_url("http://127.0.0.1:5173/projects/abc?tab=chat#run")?;

        assert_eq!(url.as_str(), "http://127.0.0.1:5173/desktop-pet");
        Ok(())
    }
}
