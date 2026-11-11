use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{ipc::Channel, Manager};

#[derive(Default)]
pub struct CliRequests(Mutex<(Vec<String>, Option<Channel<String>>)>);

pub fn open_requested(app: &tauri::AppHandle, args: &[String], cwd: &Path) {
    let Some(index) = args.iter().position(|arg| arg == "--open") else {
        return;
    };
    let Some(path) = args.get(index + 1) else {
        return;
    };
    let path = Path::new(path);
    let path = if path.is_absolute() {
        path.to_owned()
    } else {
        cwd.join(path)
    };
    let path = path.to_string_lossy().into_owned();
    let state = app.state::<CliRequests>();
    let mut requests = state.0.lock().unwrap();
    if requests
        .1
        .as_ref()
        .is_none_or(|channel| channel.send(path.clone()).is_err())
    {
        requests.0.push(path);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn cli_subscribe(app: tauri::AppHandle, on_open: Channel<String>) {
    let state = app.state::<CliRequests>();
    let mut requests = state.0.lock().unwrap();
    requests
        .0
        .retain(|path| on_open.send(path.clone()).is_err());
    requests.1 = Some(on_open);
}

fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn launcher(executable: &Path) -> String {
    let launch = if cfg!(target_os = "macos") {
        // LaunchServices starts a short-lived second instance; the single-instance plugin forwards its arguments.
        let app = executable
            .ancestors()
            .find(|path| path.extension().is_some_and(|ext| ext == "app"));
        match app {
            Some(app) => format!(
                "exec /usr/bin/open -n -a {} --args --open \"$repo\"",
                quote(&app.to_string_lossy())
            ),
            None => format!(
                "{} --open \"$repo\" >/dev/null 2>&1 &",
                quote(&executable.to_string_lossy())
            ),
        }
    } else {
        format!(
            "nohup {} --open \"$repo\" >/dev/null 2>&1 &",
            quote(&executable.to_string_lossy())
        )
    };
    format!(
        r#"#!/bin/sh
# Bud terminal launcher — managed by Bud
if [ "$#" -gt 1 ]; then echo 'Usage: bud [repository-path]' >&2; exit 2; fi
case "${{1-}}" in
  -h|--help) echo 'Usage: bud [repository-path]'; echo 'Open the current repository or a specified path in Bud.'; exit 0 ;;
  -*) echo 'Usage: bud [repository-path]' >&2; exit 2 ;;
esac
repo=$(git -C "${{1:-.}}" rev-parse --show-toplevel) || exit 1
{launch}
"#
    )
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliStatus {
    supported: bool,
    installed: bool,
    path: String,
    profile: String,
}

fn locations(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let shell = std::env::var("SHELL").unwrap_or_default();
    let profile = if shell.ends_with("bash") {
        if cfg!(target_os = "macos") {
            ".bash_profile"
        } else {
            ".bashrc"
        }
    } else if shell.ends_with("zsh") || shell.is_empty() {
        if cfg!(target_os = "macos") || shell.ends_with("zsh") {
            ".zshrc"
        } else {
            ".bashrc"
        }
    } else {
        return Err("Automatic PATH setup supports Bash and Zsh. Switch to Bash or Zsh to install the terminal command.".into());
    };
    Ok((home.join(".local/bin/bud"), home.join(profile)))
}

#[tauri::command]
pub fn cli_status(app: tauri::AppHandle) -> Result<CliStatus, String> {
    let (path, profile) = locations(&app)?;
    let installed = std::fs::read_to_string(&path)
        .is_ok_and(|text| text.contains("# Bud terminal launcher — managed by Bud"));
    Ok(CliStatus {
        supported: cfg!(unix),
        installed,
        path: path.to_string_lossy().into_owned(),
        profile: profile.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn cli_install(app: tauri::AppHandle) -> Result<CliStatus, String> {
    #[cfg(unix)]
    {
        use std::{io::Write, os::unix::fs::PermissionsExt};
        let (path, profile) = locations(&app)?;
        if path.exists()
            && !std::fs::read_to_string(&path)
                .is_ok_and(|text| text.contains("# Bud terminal launcher — managed by Bud"))
        {
            return Err(format!(
                "{} already exists and is not a Bud launcher.",
                path.display()
            ));
        }
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        std::fs::write(&path, launcher(&executable)).map_err(|e| e.to_string())?;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
        let existing = match std::fs::read_to_string(&profile) {
            Ok(text) => text,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(error) => return Err(error.to_string()),
        };
        if !existing.contains("# Bud CLI PATH") {
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&profile)
                .map_err(|e| e.to_string())?;
            file.write_all(b"\n# Bud CLI PATH\nexport PATH=\"$HOME/.local/bin:$PATH\"\n")
                .map_err(|e| e.to_string())?;
        }
        cli_status(app)
    }
    #[cfg(not(unix))]
    {
        Err("CLI installation is currently available on macOS and Linux.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quotes_launcher_paths_and_handles_arguments_without_shell_evaluation() {
        let script = launcher(Path::new(
            "/Applications/Bud's $(test).app/Contents/MacOS/bud",
        ));
        assert!(script.contains("'\\''"));
        assert!(script.contains("--open \"$repo\""));
        assert!(script.contains("git -C \"${1:-.}\""));
        assert!(script.contains("--help"));
    }
    #[cfg(unix)]
    #[test]
    fn launcher_opens_current_repository_and_handles_help_and_invalid_paths() {
        use std::os::unix::fs::PermissionsExt;
        use std::process::Command;
        let temp = std::env::temp_dir().join(format!("bud-cli-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        let repo = temp.join("repo's space $value");
        std::fs::create_dir_all(repo.join("nested")).unwrap();
        assert!(Command::new("git")
            .args(["init", "-q"])
            .arg(&repo)
            .status()
            .unwrap()
            .success());
        let output = temp.join("args.txt");
        let executable = temp.join("fake bud");
        std::fs::write(
            &executable,
            format!(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > {}\n",
                quote(&output.to_string_lossy())
            ),
        )
        .unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
        let script = temp.join("bud");
        std::fs::write(&script, launcher(&executable)).unwrap();
        assert!(Command::new("sh")
            .arg("-n")
            .arg(&script)
            .status()
            .unwrap()
            .success());
        assert!(Command::new("sh")
            .arg(&script)
            .current_dir(repo.join("nested"))
            .status()
            .unwrap()
            .success());
        for _ in 0..100 {
            if output.exists() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let received = std::fs::read_to_string(&output).unwrap();
        assert_eq!(received.lines().next(), Some("--open"));
        assert_eq!(
            Path::new(received.lines().nth(1).unwrap())
                .canonicalize()
                .unwrap(),
            repo.canonicalize().unwrap()
        );
        assert!(Command::new("sh")
            .arg(&script)
            .arg("--help")
            .output()
            .unwrap()
            .status
            .success());
        assert!(!Command::new("sh")
            .arg(&script)
            .arg(temp.join("missing"))
            .output()
            .unwrap()
            .status
            .success());
        std::fs::remove_dir_all(temp).unwrap();
    }
}
