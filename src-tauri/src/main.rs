#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod commit_ai;
mod git;
mod releases;
mod repository_watch;
mod ssh_credentials;
mod window_size;

fn main() {
    ssh_credentials::handle_askpass();
    tauri::Builder::default()
        .manage(repository_watch::RepositoryWatchers::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window_size::restore_and_track(window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            releases::open_latest_release,
            commit_ai::ai_settings,
            commit_ai::ai_save_settings,
            commit_ai::ai_generate_commit,
            git::git_open,
            repository_watch::git_watch_repository,
            repository_watch::git_unwatch_repository,
            git::git_file_action,
            git::git_commit,
            git::git_file_diff,
            git::git_hunk_action,
            git::git_commit_diff,
            git::git_image_diff,
            git::git_history,
            git::git_clone,
            git::git_init,
            git::git_remote,
            git::git_checkout,
            git::git_branch_action,
            git::git_pick_path,
            git::git_validate_key,
            ssh_credentials::git_save_key_password,
            ssh_credentials::git_key_password_status,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Bud");
}
