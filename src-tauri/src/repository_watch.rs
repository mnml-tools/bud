use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{collections::HashMap, path::Path, sync::Mutex};
use tauri::{ipc::Channel, State};

#[derive(Default)]
pub struct RepositoryWatchers(Mutex<HashMap<String, RecommendedWatcher>>);

fn relevant(event: &Event) -> bool {
    if event.need_rescan() {
        return true;
    }
    if matches!(event.kind, EventKind::Access(_)) {
        return false;
    }
    event.paths.iter().any(|path| {
        let parts: Vec<_> = path.components().collect();
        let Some(index) = parts.iter().position(|part| part.as_os_str() == ".git") else {
            return true;
        };
        let relative: std::path::PathBuf = parts[index + 1..].iter().collect();
        relative == Path::new("index")
            || relative == Path::new("HEAD")
            || relative == Path::new("config")
            || relative == Path::new("packed-refs")
            || relative.starts_with("refs")
            || (relative.starts_with("worktrees")
                && matches!(
                    relative.file_name().and_then(|name| name.to_str()),
                    Some("index" | "HEAD" | "config.worktree")
                ))
    })
}

#[tauri::command]
pub async fn git_watch_repository(
    path: String,
    id: String,
    on_change: Channel<()>,
    state: State<'_, RepositoryWatchers>,
) -> Result<(), String> {
    let watcher = tauri::async_runtime::spawn_blocking(move || {
        let root = crate::git::root(&path)?;
        let git_dir = crate::git::git(&root, &["rev-parse", "--absolute-git-dir"])?;
        let common_dir = crate::git::git(
            &root,
            &["rev-parse", "--path-format=absolute", "--git-common-dir"],
        )?;
        let mut watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
            // On dropped events or watcher errors, re-read Git state as well.
            if event.as_ref().map(relevant).unwrap_or(true) {
                let _ = on_change.send(());
            }
        })
        .map_err(|error| error.to_string())?;
        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|error| error.to_string())?;
        // Linked worktrees keep their index/HEAD and shared refs outside the working tree.
        for directory in [git_dir.trim(), common_dir.trim()] {
            let directory = Path::new(directory);
            if !directory.starts_with(&root) {
                watcher
                    .watch(directory, RecursiveMode::Recursive)
                    .map_err(|error| error.to_string())?;
            }
        }
        Ok::<_, String>(watcher)
    })
    .await
    .map_err(|error| error.to_string())??;
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .insert(id, watcher);
    Ok(())
}

#[tauri::command]
pub fn git_unwatch_repository(
    id: String,
    state: State<'_, RepositoryWatchers>,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::ModifyKind;

    #[test]
    fn receives_real_file_changes() {
        let directory = std::env::temp_dir().join(format!("bud-watch-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let directory = std::fs::canonicalize(directory).unwrap();
        let file = directory.join("edited.txt");
        let (sender, receiver) = std::sync::mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
            if let Ok(event) = event {
                if relevant(&event) {
                    let _ = sender.send(event);
                }
            }
        })
        .unwrap();
        watcher.watch(&directory, RecursiveMode::Recursive).unwrap();
        std::fs::write(&file, "external edit").unwrap();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            let event = receiver
                .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
                .expect("filesystem change notification");
            if event.paths.iter().any(|path| path == &file) {
                break;
            }
        }
        drop(watcher);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn watches_source_and_git_state_without_read_or_lock_feedback() {
        let change =
            |path: &str| Event::new(EventKind::Modify(ModifyKind::Any)).add_path(path.into());
        assert!(relevant(&change("/repo/src/app.ts")));
        assert!(relevant(&change("/repo/.git/index")));
        assert!(relevant(&change("/repo/.git/HEAD")));
        assert!(relevant(&change("/repo/.git/refs/heads/main")));
        assert!(relevant(&change("/repo/.git/worktrees/feature/index")));
        assert!(!relevant(&change("/repo/.git/index.lock")));
        assert!(!relevant(&change("/repo/.git/objects/ab/123")));
        assert!(!relevant(
            &Event::new(EventKind::Access(notify::event::AccessKind::Any))
                .add_path("/repo/app.ts".into())
        ));
    }
}
