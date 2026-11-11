#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod cli;
mod commit_ai;
mod git;
mod releases;
mod repository_watch;
mod ssh_credentials;
mod window_size;

fn main() {
    ssh_credentials::handle_askpass();
    tauri::Builder::default()
        .manage(cli::CliRequests::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            cli::open_requested(app, &args, std::path::Path::new(&cwd));
        }))
        .manage(repository_watch::RepositoryWatchers::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let args: Vec<_> = std::env::args().collect();
            cli::open_requested(
                app.handle(),
                &args,
                &std::env::current_dir().unwrap_or_default(),
            );
            if let Some(window) = app.get_webview_window("main") {
                window_size::restore_and_track(window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cli::cli_status,
            cli::cli_install,
            cli::cli_subscribe,
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
            git::git_checkout_commit,
            git::git_branch_action,
            git::git_delete_tag,
            git::git_push_tag,
            git::git_create_tag,
            git::git_pick_path,
            git::git_validate_key,
            ssh_credentials::git_save_key_password,
            ssh_credentials::git_key_password_status,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Bud");
}
