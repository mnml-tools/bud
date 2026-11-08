const LATEST_RELEASE_URL: &str = "https://github.com/mnml-tools/bud/releases/latest";

#[tauri::command]
pub async fn open_latest_release() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(target_os = "macos")]
        let status = std::process::Command::new("open")
            .arg(LATEST_RELEASE_URL)
            .status();

        #[cfg(target_os = "windows")]
        let status = {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("cmd")
                .args(["/C", "start", "", LATEST_RELEASE_URL])
                .creation_flags(0x08000000)
                .status()
        };

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let status = std::process::Command::new("xdg-open")
            .arg(LATEST_RELEASE_URL)
            .status();

        match status {
            Ok(status) if status.success() => Ok(()),
            _ => Err("Unable to open the release page in your browser.".to_owned()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}
