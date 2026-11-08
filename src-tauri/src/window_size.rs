use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{LogicalSize, Manager, PhysicalPosition, WebviewWindow, WindowEvent};

#[derive(Clone, Copy, Serialize, Deserialize)]
struct WindowState {
    width: f64,
    height: f64,
    #[serde(default)]
    position: Option<PhysicalPosition<i32>>,
    #[serde(default)]
    maximized: bool,
}

pub fn restore_and_track(window: WebviewWindow) {
    let Ok(directory) = window.app_handle().path().app_data_dir() else {
        return;
    };
    let path = directory.join("window-size.json");
    let restored = std::fs::read(&path)
        .ok()
        .and_then(|data| serde_json::from_slice::<WindowState>(&data).ok())
        .filter(|size| {
            size.width.is_finite()
                && size.height.is_finite()
                && size.width > 0.0
                && size.height > 0.0
        });

    if let Some(state) = restored {
        let _ = window.set_size(LogicalSize::new(state.width, state.height));
        if let Some(position) = state.position {
            // A disconnected display must not leave the window out of reach.
            if let Ok(monitors) = window.available_monitors() {
                if monitors.iter().any(|monitor| {
                    let origin = monitor.position();
                    let size = monitor.size();
                    let x = i64::from(position.x);
                    let y = i64::from(position.y);
                    x >= i64::from(origin.x)
                        && y >= i64::from(origin.y)
                        && x + 80 <= i64::from(origin.x) + i64::from(size.width)
                        && y + 40 <= i64::from(origin.y) + i64::from(size.height)
                }) {
                    let _ = window.set_position(position);
                }
            }
        }
        if state.maximized {
            let _ = window.maximize();
        }
    }

    let initial = restored.or_else(|| {
        let size = window.inner_size().ok()?;
        let logical = size.to_logical::<f64>(window.scale_factor().ok()?);
        Some(WindowState {
            width: logical.width,
            height: logical.height,
            position: window.outer_position().ok(),
            maximized: window.is_maximized().unwrap_or(false),
        })
    });
    let pending = Arc::new(Mutex::new((0_u64, initial)));
    let observed = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
            let Ok(mut state) = pending.lock() else {
                return;
            };
            if let Some(saved) = state.1.as_mut() {
                update_mode(&observed, saved);
                if normal_bounds(&observed, saved) {
                    match event {
                        WindowEvent::Moved(position) => saved.position = Some(*position),
                        WindowEvent::Resized(size) if size.width > 0 && size.height > 0 => {
                            if let Ok(scale) = observed.scale_factor() {
                                let logical = size.to_logical::<f64>(scale);
                                saved.width = logical.width;
                                saved.height = logical.height;
                            }
                        }
                        _ => {}
                    }
                }
            }
            state.0 += 1;
            let revision = state.0;
            let pending = Arc::clone(&pending);
            let path = path.clone();

            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(350)).await;
                if let Ok(state) = pending.lock() {
                    if state.0 == revision {
                        save(&path, state.1);
                    }
                }
            });
        }
        WindowEvent::CloseRequested { .. } => {
            if let Ok(mut state) = pending.lock() {
                if let Some(saved) = state.1.as_mut() {
                    update(&observed, saved);
                }
                save(&path, state.1);
            }
        }
        _ => {}
    });
}

fn update_mode(window: &WebviewWindow, state: &mut WindowState) {
    if let Ok(maximized) = window.is_maximized() {
        state.maximized = maximized;
    }
}

fn normal_bounds(window: &WebviewWindow, state: &WindowState) -> bool {
    !state.maximized
        && matches!(window.is_fullscreen(), Ok(false))
        && matches!(window.is_minimized(), Ok(false))
}

fn update(window: &WebviewWindow, state: &mut WindowState) {
    update_mode(window, state);

    // Keep the normal bounds so unmaximizing restores the previous size and position.
    if !normal_bounds(window, state) {
        return;
    }
    if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
        if size.width > 0 && size.height > 0 {
            let logical = size.to_logical::<f64>(scale);
            state.width = logical.width;
            state.height = logical.height;
        }
    }
    if let Ok(position) = window.outer_position() {
        state.position = Some(position);
    }
}

fn save(path: &Path, size: Option<WindowState>) {
    let Some(parent) = path.parent() else { return };
    let Some(size) = size else { return };
    let Ok(data) = serde_json::to_vec(&size) else {
        return;
    };
    let temporary = path.with_extension("tmp");
    if std::fs::create_dir_all(parent).is_ok() && std::fs::write(&temporary, data).is_ok() {
        let _ = std::fs::rename(temporary, path);
    }
}
