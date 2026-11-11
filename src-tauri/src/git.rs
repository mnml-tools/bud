use base64::Engine;
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Repository {
    path: String,
    name: String,
    current_branch: String,
    dirty: bool,
    changes: Vec<ChangedFile>,
    branches: Vec<Branch>,
    tags: Vec<Tag>,
    remotes: Vec<String>,
    outgoing_commits: std::collections::HashMap<String, usize>,
    github_repo: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChangedFile {
    path: String,
    status: String,
    original_path: Option<String>,
}

fn parse_changes(output: &str) -> Vec<ChangedFile> {
    let mut entries = output.split('\0').filter(|entry| !entry.is_empty());
    let mut changes = Vec::new();
    while let Some(entry) = entries.next() {
        let Some(path) = entry.get(3..) else { continue };
        let status = &entry[..2];
        let original_path = if status.contains('R') || status.contains('C') {
            entries.next().map(String::from)
        } else {
            None
        };
        changes.push(ChangedFile {
            path: path.into(),
            status: status.into(),
            original_path,
        });
    }
    changes
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Branch {
    name: String,
    hash: String,
    remote: bool,
    current: bool,
    incoming_commits: usize,
    upstream_gone: bool,
}

#[derive(Serialize)]
struct Tag {
    name: String,
    hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    hash: String,
    parents: Vec<String>,
    author: String,
    author_email: String,
    date: String,
    subject: String,
    refs: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct History {
    commits: Vec<Commit>,
    has_more: bool,
}

fn command(directory: Option<&Path>, key: Option<&str>) -> Result<Command, String> {
    let mut cmd = Command::new("git");
    cmd.args(["--no-pager", "-c", "color.ui=false"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null());
    if let Some(path) = directory {
        cmd.current_dir(path);
    }
    if let Some(key) = key.filter(|key| !key.is_empty()) {
        let path = std::fs::canonicalize(key)
            .map_err(|_| "The selected SSH key is missing or inaccessible.")?;
        if !path.is_file() {
            return Err("Choose a private key file.".into());
        }
        // Git runs GIT_SSH_COMMAND through its POSIX shell, including on Windows.
        let quoted = path
            .to_string_lossy()
            .replace('\\', "/")
            .replace('\'', "'\\''");
        cmd.env(
            "GIT_SSH_COMMAND",
            format!(
                "ssh -i '{quoted}' -o IdentitiesOnly=yes -o BatchMode=no -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o StrictHostKeyChecking=yes -o ConnectTimeout=15"
            ),
        );
        cmd.env(
            "SSH_ASKPASS",
            std::env::current_exe().map_err(|error| error.to_string())?,
        )
        .env("SSH_ASKPASS_REQUIRE", "force")
        .env(crate::ssh_credentials::ASKPASS_KEY, &path)
        .env("LC_ALL", "C");
    } else {
        // Preserve normal ssh config and agent identities while preventing invisible prompts.
        cmd.env(
            "GIT_SSH_COMMAND",
            "ssh -o BatchMode=yes -o ConnectTimeout=15",
        );
    }
    Ok(cmd)
}

fn execute_bytes(cmd: Command) -> Result<Vec<u8>, String> {
    execute_bytes_with_input(cmd, None)
}

fn execute_bytes_with_input(mut cmd: Command, input: Option<Vec<u8>>) -> Result<Vec<u8>, String> {
    if input.is_some() {
        cmd.stdin(Stdio::piped());
    }
    // Drain both pipes concurrently so large histories cannot block the child.
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| {
        format!("Unable to run Git. Install Git and make it available on PATH. {e}")
    })?;
    let writer = input.map(|input| {
        let mut stdin = child.stdin.take().unwrap();
        std::thread::spawn(move || std::io::Write::write_all(&mut stdin, &input))
    });
    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let out = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        std::io::Read::read_to_end(&mut stdout, &mut bytes).map(|_| bytes)
    });
    let err = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        std::io::Read::read_to_end(&mut stderr, &mut bytes).map(|_| bytes)
    });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if started.elapsed() > Duration::from_secs(120) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(
                "Git timed out after two minutes. Check your network and SSH agent, then retry."
                    .into(),
            );
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    let output = out
        .join()
        .map_err(|_| "Unable to read Git output")?
        .map_err(|e| e.to_string())?;
    let error = err
        .join()
        .map_err(|_| "Unable to read Git errors")?
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(String::from_utf8_lossy(&error).trim().to_owned());
    }
    if let Some(writer) = writer {
        writer
            .join()
            .map_err(|_| "Unable to send patch to Git")?
            .map_err(|error| error.to_string())?;
    }
    Ok(output)
}

fn execute(cmd: Command) -> Result<String, String> {
    execute_bytes(cmd).map(|output| String::from_utf8_lossy(&output).into_owned())
}

pub(crate) fn git(path: &Path, args: &[&str]) -> Result<String, String> {
    let mut cmd = command(Some(path), None)?;
    cmd.args(args);
    execute(cmd)
}

pub(crate) fn root(path: &str) -> Result<PathBuf, String> {
    let directory = std::fs::canonicalize(path)
        .map_err(|_| "Repository folder does not exist or is inaccessible.")?;
    let output = git(&directory, &["rev-parse", "--show-toplevel"])?;
    Ok(PathBuf::from(output.trim_end_matches(['\r', '\n'])))
}

fn github_repository(remote: &str) -> Option<String> {
    let remote = remote.trim();
    let path = remote
        .strip_prefix("git@github.com:")
        .or_else(|| remote.strip_prefix("https://github.com/"))
        .or_else(|| remote.strip_prefix("ssh://git@github.com/"))?;
    let path = path
        .trim_end_matches('/')
        .strip_suffix(".git")
        .unwrap_or(path.trim_end_matches('/'));
    let parts: Vec<_> = path.split('/').collect();
    if parts.len() != 2
        || parts.iter().any(|part| {
            part.is_empty()
                || *part == "."
                || *part == ".."
                || !part
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        })
    {
        return None;
    }
    Some(path.to_owned())
}

fn inspect(path: &str) -> Result<Repository, String> {
    let directory = root(path)?;
    let branch = git(&directory, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .unwrap_or_else(|_| "Detached HEAD".into());
    let refs = git(
        &directory,
        &[
            "for-each-ref",
            "--sort=refname",
            "--sort=-creatordate",
            "--format=%(refname)%09%(objectname)%09%(HEAD)%09%(symref)%09%(upstream)%09%(objecttype)%09%(*objecttype)%09%(*objectname)",
            "refs/heads",
            "refs/remotes",
            "refs/tags",
        ],
    )?;
    let ref_names: std::collections::HashSet<&str> = refs
        .lines()
        .filter_map(|line| line.split('\t').next())
        .collect();
    let branches = refs
        .lines()
        .filter_map(|line| {
            let fields: Vec<_> = line.split('\t').collect();
            if fields.len() < 4 || !fields[3].is_empty() || fields[0].starts_with("refs/tags/") {
                return None;
            }
            let remote = fields[0].starts_with("refs/remotes/");
            Some(Branch {
                name: fields[0]
                    .trim_start_matches(if remote {
                        "refs/remotes/"
                    } else {
                        "refs/heads/"
                    })
                    .into(),
                hash: fields[1].into(),
                remote,
                current: fields[2] == "*",
                upstream_gone: !remote
                    && fields.get(4).is_some_and(|upstream| {
                        !upstream.is_empty() && !ref_names.contains(upstream)
                    }),
                incoming_commits: if remote {
                    0
                } else {
                    let name = fields[0].trim_start_matches("refs/heads/");
                    git(
                        &directory,
                        &[
                            "rev-list",
                            "--count",
                            &format!("refs/heads/{name}..refs/remotes/origin/{name}"),
                            "--",
                        ],
                    )
                    .ok()
                    .and_then(|value| value.trim().parse().ok())
                    .unwrap_or(0)
                },
            })
        })
        .collect();
    let tags = refs
        .lines()
        .filter_map(|line| {
            let fields: Vec<_> = line.split('\t').collect();
            if !fields[0].starts_with("refs/tags/") {
                return None;
            }
            let hash = if fields.get(5) == Some(&"commit") {
                fields[1]
            } else if fields.get(6) == Some(&"commit") {
                fields[7]
            } else {
                return None;
            };
            Some(Tag {
                name: fields[0].trim_start_matches("refs/tags/").into(),
                hash: hash.into(),
            })
        })
        .collect();
    let remotes: Vec<String> = git(&directory, &["remote"])?
        .lines()
        .map(String::from)
        .collect();
    let outgoing_commits = remotes
        .iter()
        .map(|remote| {
            (
                remote.clone(),
                outgoing_count(&directory, remote, branch.trim()),
            )
        })
        .collect();
    let github_repo = remotes
        .iter()
        .filter(|name| name.as_str() == "origin")
        .chain(remotes.iter().filter(|name| name.as_str() != "origin"))
        .filter_map(|name| git(&directory, &["remote", "get-url", name]).ok())
        .find_map(|url| github_repository(&url));
    let changes = parse_changes(&git(
        &directory,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?);
    Ok(Repository {
        name: directory
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        path: directory.to_string_lossy().into_owned(),
        current_branch: branch.trim().into(),
        dirty: !changes.is_empty(),
        changes,
        branches,
        tags,
        remotes,
        outgoing_commits,
        github_repo,
    })
}

fn outgoing_count(directory: &Path, remote: &str, branch: &str) -> usize {
    if branch == "Detached HEAD" {
        return 0;
    }

    // Push publishes the current branch to the same branch name on this remote.
    let target = format!("refs/remotes/{remote}/{branch}");
    let output = if git(directory, &["rev-parse", "--verify", &target]).is_ok() {
        git(
            directory,
            &["rev-list", "--count", &format!("{target}..HEAD"), "--"],
        )
    } else {
        // A new branch may share its entire history with other branches on the remote.
        git(
            directory,
            &[
                "rev-list",
                "--count",
                "HEAD",
                "--not",
                &format!("--remotes={remote}/*"),
                "--",
            ],
        )
    };
    output
        .ok()
        .and_then(|value| value.trim().parse().ok())
        .unwrap_or(0)
}

fn selected_changes(directory: &Path, paths: &[String]) -> Result<Vec<ChangedFile>, String> {
    if paths.is_empty() {
        return Err("Select at least one file.".into());
    }
    let changes = parse_changes(&git(
        directory,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?);
    paths
        .iter()
        .map(|path| {
            changes
                .iter()
                .find(|file| &file.path == path)
                .map(|file| ChangedFile {
                    path: file.path.clone(),
                    status: file.status.clone(),
                    original_path: file.original_path.clone(),
                })
                .ok_or_else(|| format!("File is no longer changed: {path}. Refresh and try again."))
        })
        .collect()
}

fn file_command(directory: &Path, args: &[&str], files: &[ChangedFile]) -> Result<(), String> {
    let mut cmd = command(Some(directory), None)?;
    cmd.arg("--literal-pathspecs").args(args).arg("--");
    for file in files {
        cmd.arg(&file.path);
        if let Some(original) = &file.original_path {
            cmd.arg(original);
        }
    }
    execute(cmd).map(|_| ())
}

#[tauri::command]
pub async fn git_file_action(
    path: String,
    paths: Vec<String>,
    action: String,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        let files = selected_changes(&directory, &paths)?;
        let has_head = git(&directory, &["rev-parse", "--verify", "HEAD"]).is_ok();
        match action.as_str() {
            "stage" => file_command(&directory, &["add", "-A"], &files)?,
            "unstage" => {
                if has_head {
                    file_command(&directory, &["restore", "--staged"], &files)?;
                } else {
                    file_command(&directory, &["rm", "--cached", "-f"], &files)?;
                }
            }
            "discard" => {
                // The UI confirms discarding both index and working-tree changes.
                // Only exact paths from Git status are accepted, never arbitrary paths.
                let (untracked, tracked): (Vec<_>, Vec<_>) =
                    files.into_iter().partition(|file| file.status == "??");
                if !tracked.is_empty() {
                    if has_head {
                        file_command(
                            &directory,
                            &["restore", "--source=HEAD", "--staged", "--worktree"],
                            &tracked,
                        )?;
                    } else {
                        file_command(&directory, &["rm", "-f"], &tracked)?;
                    }
                }
                for file in untracked {
                    let target = directory.join(&file.path);
                    let parent = target
                        .parent()
                        .ok_or("Invalid file path.")?
                        .canonicalize()
                        .map_err(|e| e.to_string())?;
                    if !parent.starts_with(&directory) {
                        return Err("File is outside the repository.".into());
                    }
                    std::fs::remove_file(target).map_err(|e| e.to_string())?;
                }
            }
            _ => return Err("Unsupported file action.".into()),
        }
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_commit(
    path: String,
    message: String,
    description: String,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        if message.trim().is_empty() {
            return Err("Enter a commit message.".into());
        }
        if git(&directory, &["diff", "--cached", "--name-only", "-z"])?.is_empty() {
            return Err("Stage changes before committing.".into());
        }
        let mut cmd = command(Some(&directory), None)?;
        cmd.args(["commit", "-m", message.trim()]);
        if !description.trim().is_empty() {
            cmd.args(["-m", description.trim()]);
        }
        execute(cmd)?;
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct ImageDiff {
    before: Option<String>,
    after: Option<String>,
}

fn image_data(
    directory: &Path,
    revision: Option<&str>,
    path: &str,
    mime: &str,
) -> Result<String, String> {
    const MAX_IMAGE: u64 = 20 * 1024 * 1024;
    let bytes = if let Some(revision) = revision {
        let object = format!("{revision}:{path}");
        let size = git(directory, &["cat-file", "-s", &object])?
            .trim()
            .parse::<u64>()
            .map_err(|e| e.to_string())?;
        if size > MAX_IMAGE {
            return Err("Image is too large to preview (20 MB limit).".into());
        }
        let mut cmd = command(Some(directory), None)?;
        cmd.args(["cat-file", "blob", &object]);
        execute_bytes(cmd)?
    } else {
        let target = directory.join(path);
        let metadata = std::fs::symlink_metadata(&target).map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            return Err("Image preview requires a regular file.".into());
        }
        let canonical = target.canonicalize().map_err(|e| e.to_string())?;
        if !canonical.starts_with(directory) {
            return Err("Image is outside the repository.".into());
        }
        if metadata.len() > MAX_IMAGE {
            return Err("Image is too large to preview (20 MB limit).".into());
        }
        std::fs::read(target).map_err(|e| e.to_string())?
    };
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub async fn git_image_diff(path: String, file: String, staged: bool) -> Result<ImageDiff, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        let files = selected_changes(&directory, &[file])?;
        let file = &files[0];
        let extension = Path::new(&file.path)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime = match extension.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "bmp" => "image/bmp",
            "avif" => "image/avif",
            _ => return Err("Unsupported image format.".into()),
        };
        let status = if file.status == "??" {
            'A'
        } else {
            file.status.as_bytes()[if staged { 0 } else { 1 }] as char
        };
        let original = file.original_path.as_deref().unwrap_or(&file.path);
        let before = if status == 'A' || file.status == "??" {
            None
        } else {
            Some(image_data(
                &directory,
                Some(if staged { "HEAD" } else { "" }),
                if staged || status == 'R' {
                    original
                } else {
                    &file.path
                },
                mime,
            )?)
        };
        let after = if status == 'D' {
            None
        } else {
            Some(image_data(
                &directory,
                if staged { Some("") } else { None },
                &file.path,
                mime,
            )?)
        };
        Ok(ImageDiff { before, after })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_commit_diff(path: String, hash: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        if hash.len() != 40 && hash.len() != 64
            || !hash.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err("Invalid commit hash.".into());
        }
        git(
            &directory,
            &[
                "show",
                "--format=",
                "--root",
                "--diff-merges=first-parent",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                "--find-renames",
                &hash,
                "--",
            ],
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

fn file_diff(path: &str, file: String, staged: bool) -> Result<String, String> {
    let directory = root(&path)?;
    let files = selected_changes(&directory, &[file])?;
    let file = &files[0];
    if file.status == "??" {
        if staged {
            return Ok(String::new());
        }
        let target = directory.join(&file.path);
        let metadata = std::fs::symlink_metadata(&target).map_err(|e| e.to_string())?;
        if metadata.len() > 2_000_000 {
            return Ok("File is too large to preview.".into());
        }
        let bytes = if metadata.file_type().is_symlink() {
            std::fs::read_link(&target)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .as_bytes()
                .to_vec()
        } else {
            std::fs::read(&target).map_err(|e| e.to_string())?
        };
        let Ok(content) = String::from_utf8(bytes) else {
            return Ok("Binary file added.".into());
        };
        return Ok(format!(
            "--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n{}",
            file.path,
            content.lines().count(),
            content
                .lines()
                .map(|line| format!("+{line}\n"))
                .collect::<String>()
        ));
    }
    let mut cmd = command(Some(&directory), None)?;
    cmd.arg("--literal-pathspecs")
        .args(["diff", "--no-ext-diff", "--no-textconv", "--no-color"]);
    if staged {
        cmd.arg("--cached");
    }
    cmd.arg("--").arg(&file.path);
    if let Some(original) = &file.original_path {
        cmd.arg(original);
    }
    execute(cmd)
}

#[tauri::command]
pub async fn git_file_diff(path: String, file: String, staged: bool) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || file_diff(&path, file, staged))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_hunk_action(
    path: String,
    file: String,
    staged: bool,
    hunk: usize,
    expected_diff: String,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        let changes = selected_changes(&directory, &[file.clone()])?;
        let change = &changes[0];
        let status = change.status.as_bytes();
        if status.len() != 2 || status[if staged { 0 } else { 1 }] != b'M' || status.contains(&b'U') || change.original_path.is_some() {
            return Err("Partial staging is available for modified text files. Use the file action for additions, deletions, renames, or conflicts.".into());
        }
        if expected_diff.len() > 2_000_000 { return Err("Diff is too large for partial staging.".into()); }
        let current = file_diff(&path, file, staged)?;
        if current != expected_diff { return Err("This file changed since the diff was loaded. Review the refreshed diff and retry.".into()); }
        let lines: Vec<_> = current.split_inclusive('\n').collect();
        let starts: Vec<_> = lines.iter().enumerate().filter_map(|(index, line)| line.starts_with("@@ ").then_some(index)).collect();
        let start = *starts.get(hunk).ok_or("This change is no longer available. Refresh the diff.")?;
        let header = lines[..starts[0]].concat();
        if header.lines().any(|line| line.starts_with("old mode ") || line.starts_with("new mode ") || line.starts_with("new file mode ") || line.starts_with("deleted file mode ") || line.starts_with("rename ")) {
            return Err("Use the file action for mode changes, additions, deletions, or renames.".into());
        }
        let end = starts.get(hunk + 1).copied().unwrap_or(lines.len());
        let patch = header + &lines[start..end].concat();
        let mut cmd = command(Some(&directory), None)?;
        cmd.args(["apply", "--cached", "--whitespace=nowarn"]);
        if staged { cmd.arg("--reverse"); }
        cmd.arg("-");
        execute_bytes_with_input(cmd, Some(patch.into_bytes()))?;
        inspect(&path)
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn git_open(path: String) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || inspect(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn history(path: &str, limit: usize) -> Result<History, String> {
    let directory = root(path)?;
    let limit = limit.max(1);
    let has_head = git(&directory, &["rev-parse", "--verify", "HEAD"]).is_ok();
    if !has_head && git(&directory, &["rev-list", "--all", "--count"])?.trim() == "0" {
        return Ok(History {
            commits: vec![],
            has_more: false,
        });
    }
    let count = format!("--max-count={}", limit.saturating_add(1));
    let mut args = vec![
        "log",
        "--all",
        "--topo-order",
        "--no-show-signature",
        "--no-notes",
        "--encoding=UTF-8",
        "--decorate=short",
        &count,
        "--format=%H%x00%P%x00%an%x00%ae%x00%aI%x00%s%x00%D%x00",
    ];
    if has_head {
        args.push("HEAD");
    }
    args.push("--");
    let output = git(&directory, &args)?;
    let fields: Vec<_> = output.split('\0').collect();
    let mut commits: Vec<_> = fields
        .chunks_exact(7)
        .map(|f| Commit {
            hash: f[0].trim_start_matches(['\r', '\n']).into(),
            parents: f[1].split_whitespace().map(String::from).collect(),
            author: f[2].into(),
            author_email: f[3].into(),
            date: f[4].into(),
            subject: f[5].into(),
            refs: f[6].into(),
        })
        .collect();
    let has_more = commits.len() > limit;
    commits.truncate(limit);
    Ok(History { commits, has_more })
}

#[tauri::command]
pub async fn git_history(path: String, limit: usize) -> Result<History, String> {
    tauri::async_runtime::spawn_blocking(move || history(&path, limit))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_validate_key(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Read;
        let path = std::fs::canonicalize(path)
            .map_err(|_| "The key file does not exist or is inaccessible.")?;
        let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        let mut header = [0; 128];
        let count = file.read(&mut header).map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&header[..count]);
        if !text.starts_with("-----BEGIN ")
            || !text
                .lines()
                .next()
                .unwrap_or_default()
                .contains("PRIVATE KEY-----")
        {
            return Err("Choose an OpenSSH or PEM private key, not a public (.pub) key.".into());
        }
        Ok(path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_init(parent: String, name: String) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if name.trim().is_empty() || name == "." || name == ".." || name.contains(['/', '\\', '\0'])
        {
            return Err("Enter a repository name without path separators.".into());
        }
        let parent = std::fs::canonicalize(parent).map_err(|error| error.to_string())?;
        let destination = parent.join(name);
        if destination.exists() {
            return Err("The destination already exists. Open it or choose a new name.".into());
        }
        let mut cmd = command(Some(&parent), None)?;
        cmd.args(["init", "--initial-branch=main", "--"])
            .arg(&destination);
        execute(cmd)?;
        inspect(&destination.to_string_lossy())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn git_clone(
    url: String,
    parent: String,
    name: String,
    key: Option<String>,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if url.trim().is_empty() || url.starts_with('-') {
            return Err("Enter a repository URL.".into());
        }
        if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', '\0']) {
            return Err("Enter a folder name without path separators.".into());
        }
        let parent = std::fs::canonicalize(parent).map_err(|e| e.to_string())?;
        let destination = parent.join(name);
        if destination.exists() {
            return Err("The destination already exists. Choose a new folder name.".into());
        }
        let mut cmd = command(Some(&parent), key.as_deref())?;
        cmd.args(["clone", "--", url.trim()]).arg(&destination);
        execute(cmd)?;
        inspect(&destination.to_string_lossy())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_remote(
    path: String,
    action: String,
    remote: String,
    key: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        if !git(&directory, &["remote"])?
            .lines()
            .any(|name| name == remote)
            || remote.starts_with('-')
        {
            return Err("Choose a configured remote.".into());
        }
        let mut cmd = command(Some(&directory), key.as_deref())?;
        match action.as_str() {
            "fetch" => {
                cmd.args(["fetch", "--prune", "--", &remote]);
            }
            "pull" => {
                let branch = git(&directory, &["symbolic-ref", "--quiet", "--short", "HEAD"])?;
                cmd.args(["pull", "--ff-only", "--", &remote, branch.trim()]);
            }
            "push" => {
                let branch = git(&directory, &["symbolic-ref", "--quiet", "--short", "HEAD"])?;
                cmd.args([
                    "push",
                    "--set-upstream",
                    "--",
                    &remote,
                    &format!("HEAD:refs/heads/{}", branch.trim()),
                ]);
            }
            _ => return Err("Unsupported Git action.".into()),
        }
        execute(cmd)?;
        Ok(match action.as_str() {
            "fetch" => "Remote branches updated.",
            "pull" => "Branch pulled successfully.",
            _ => "Branch pushed successfully.",
        }
        .into())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_branch_action(
    path: String,
    branch: String,
    action: String,
    name: Option<String>,
    delete_origin: Option<bool>,
    key: Option<String>,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        let repo = inspect(&path)?;
        let target = repo
            .branches
            .iter()
            .find(|item| !item.remote && item.name == branch)
            .ok_or("Choose a local branch.")?;
        let reference = format!("refs/heads/{branch}");
        match action.as_str() {
            "new" => {
                let name = name.ok_or("Enter a branch name.")?;
                if name.starts_with('-') || name.trim() != name || name.is_empty() {
                    return Err("Enter a valid branch name.".into());
                }
                git(&directory, &["check-ref-format", "--branch", &name])?;
                git(&directory, &["switch", "-c", &name, &reference])?;
            }
            "delete" => {
                if target.current {
                    return Err("Switch to another branch before deleting this branch.".into());
                }
                let delete_origin = delete_origin.unwrap_or(false);
                if delete_origin && !repo.remotes.iter().any(|remote| remote == "origin") {
                    return Err("This repository has no origin remote.".into());
                }
                git(&directory, &["branch", "-d", "--", &branch])?;
                if delete_origin {
                    let result = (|| {
                        let mut cmd = command(Some(&directory), key.as_deref())?;
                        cmd.args(["push", "--delete", "--", "origin", &reference]);
                        execute(cmd)
                    })();
                    if let Err(error) = result {
                        return Err(format!("Local branch '{branch}' was deleted, but deleting origin/{branch} failed: {error}"));
                    }
                }
            }
            "merge" => {
                if target.current || repo.current_branch == "Detached HEAD" {
                    return Err("Choose a different branch to merge into the active branch.".into());
                }
                git(&directory, &["merge", "--no-edit", "--", &reference])?;
            }
            _ => return Err("Unsupported branch action.".into()),
        }
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_create_tag(
    path: String,
    hash: String,
    name: String,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        if name.starts_with('-')
            || git(
                &directory,
                &["check-ref-format", &format!("refs/tags/{name}")],
            )
            .is_err()
        {
            return Err("Enter a valid tag name.".into());
        }
        if !matches!(hash.len(), 40 | 64) || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Choose a valid commit.".into());
        }
        let commit = git(
            &directory,
            &["rev-parse", "--verify", &format!("{hash}^{{commit}}")],
        )?;
        git(
            &directory,
            &[
                "-c",
                "tag.gpgsign=false",
                "tag",
                "--no-sign",
                "--",
                &name,
                commit.trim(),
            ],
        )?;
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_push_tag(path: String, name: String, key: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        let reference = format!("refs/tags/{name}");
        if name.starts_with('-') || git(&directory, &["check-ref-format", &reference]).is_err() {
            return Err("Choose a valid tag.".into());
        }
        git(&directory, &["show-ref", "--verify", "--quiet", &reference])?;
        if !git(&directory, &["remote"])?
            .lines()
            .any(|remote| remote == "origin")
        {
            return Err("This repository has no origin remote.".into());
        }
        let mut cmd = command(Some(&directory), key.as_deref())?;
        cmd.args(["push", "--", "origin", &format!("{reference}:{reference}")]);
        execute(cmd)?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_delete_tag(
    path: String,
    name: String,
    delete_origin: bool,
    key: Option<String>,
) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        let reference = format!("refs/tags/{name}");
        if name.starts_with('-') || git(&directory, &["check-ref-format", &reference]).is_err() {
            return Err("Choose a valid tag.".into());
        }
        git(&directory, &["show-ref", "--verify", "--quiet", &reference])?;
        if delete_origin
            && !git(&directory, &["remote"])?
                .lines()
                .any(|remote| remote == "origin")
        {
            return Err("This repository has no origin remote.".into());
        }
        git(&directory, &["tag", "-d", "--", &name])?;
        if delete_origin {
            let result = (|| {
                let mut cmd = command(Some(&directory), key.as_deref())?;
                cmd.args(["push", "--delete", "--", "origin", &reference]);
                execute(cmd)
            })();
            if let Err(error) = result {
                return Err(format!(
                    "Local tag '{name}' was deleted, but deleting the origin tag failed: {error}"
                ));
            }
        }
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_checkout(path: String, branch: String) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        if branch.starts_with('-')
            || git(
                &directory,
                &[
                    "show-ref",
                    "--verify",
                    "--quiet",
                    &format!("refs/heads/{branch}"),
                ],
            )
            .is_err()
        {
            return Err("Choose an existing local branch.".into());
        }
        git(&directory, &["switch", "--", &branch])?;
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_checkout_commit(path: String, hash: String) -> Result<Repository, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory = root(&path)?;
        if !matches!(hash.len(), 40 | 64) || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Choose a valid commit.".into());
        }
        let commit = git(
            &directory,
            &["rev-parse", "--verify", &format!("{hash}^{{commit}}")],
        )?;
        git(&directory, &["switch", "--detach", commit.trim()])?;
        inspect(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_pick_path(window: tauri::Window, file: bool) -> Result<Option<String>, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let picker = window.dialog().file().set_parent(&window);
    if file {
        picker
            .set_title("Choose a private SSH key")
            .pick_file(move |path| {
                let _ = send.send(path);
            });
    } else {
        picker
            .set_title("Choose a repository folder")
            .pick_folder(move |path| {
                let _ = send.send(path);
            });
    }
    receive
        .await
        .map_err(|e| e.to_string())?
        .map(|path| {
            path.into_path()
                .map(|p| p.to_string_lossy().into_owned())
                .map_err(|e| e.to_string())
        })
        .transpose()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stages_and_unstages_hunks_without_changing_worktree() {
        let temp = std::env::temp_dir().join(format!("bud-hunks-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        let original: String = (0..30).map(|line| format!("line {line}\n")).collect();
        let target = temp.join("file with spaces.txt");
        std::fs::write(&target, &original).unwrap();
        git(&temp, &["add", "."]).unwrap();
        git(&temp, &["commit", "-m", "Initial"]).unwrap();
        let edited = original
            .replace("line 1\n", "first edit\n")
            .replace("line 25\n", "second edit\n");
        std::fs::write(&target, &edited).unwrap();
        let path = temp.to_string_lossy().into_owned();
        let file = "file with spaces.txt".to_string();
        let diff = file_diff(&path, file.clone(), false).unwrap();
        assert_eq!(
            diff.lines().filter(|line| line.starts_with("@@ ")).count(),
            2
        );
        assert!(
            git_hunk_action(path.clone(), file.clone(), false, 9, diff.clone())
                .await
                .is_err()
        );
        git_hunk_action(path.clone(), file.clone(), false, 1, diff.clone())
            .await
            .unwrap();
        let index = git(&temp, &["show", ":file with spaces.txt"]).unwrap();
        assert!(index.contains("second edit"));
        assert!(!index.contains("first edit"));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), edited);
        assert!(git_hunk_action(path.clone(), file.clone(), false, 0, diff)
            .await
            .is_err());
        let staged = file_diff(&path, file.clone(), true).unwrap();
        git_hunk_action(path.clone(), file.clone(), true, 0, staged)
            .await
            .unwrap();
        assert_eq!(
            git(&temp, &["show", ":file with spaces.txt"]).unwrap(),
            original
        );
        assert_eq!(std::fs::read_to_string(&target).unwrap(), edited);
        let refreshed = file_diff(&path, file.clone(), false).unwrap();
        git_hunk_action(path.clone(), file, false, 0, refreshed)
            .await
            .unwrap();
        git_commit(path.clone(), "First change only".into(), "".into())
            .await
            .unwrap();
        let committed = git(&temp, &["show", "HEAD:file with spaces.txt"]).unwrap();
        assert!(committed.contains("first edit"));
        assert!(!committed.contains("second edit"));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), edited);
        assert!(file_diff(&path, "file with spaces.txt".into(), false)
            .unwrap()
            .contains("+second edit"));
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn counts_outgoing_commits_for_new_and_existing_remote_branches() {
        let temp = std::env::temp_dir().join(format!("bud-outgoing-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        assert_eq!(outgoing_count(&temp, "origin", "main"), 0);
        git(&temp, &["commit", "--allow-empty", "-m", "First"]).unwrap();
        assert_eq!(outgoing_count(&temp, "origin", "main"), 1);
        git(&temp, &["update-ref", "refs/remotes/origin/main", "HEAD"]).unwrap();
        assert_eq!(outgoing_count(&temp, "origin", "main"), 0);
        assert_eq!(outgoing_count(&temp, "origin", "new-feature"), 0);
        git(&temp, &["commit", "--allow-empty", "-m", "Second"]).unwrap();
        assert_eq!(outgoing_count(&temp, "origin", "main"), 1);
        assert_eq!(outgoing_count(&temp, "origin", "new-feature"), 1);
        assert_eq!(outgoing_count(&temp, "other", "main"), 2);
        assert_eq!(outgoing_count(&temp, "origin", "Detached HEAD"), 0);
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn ai_diff_contains_only_staged_content_and_rejects_oversized_input() {
        let temp = std::env::temp_dir().join(format!("bud-ai-diff-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        assert!(staged_diff(&path).is_err());
        std::fs::write(temp.join("file.txt"), "staged content\n").unwrap();
        git(&temp, &["add", "file.txt"]).unwrap();
        std::fs::write(temp.join("file.txt"), "private unstaged content\n").unwrap();
        std::fs::write(temp.join("untracked.txt"), "private untracked content\n").unwrap();
        let diff = staged_diff(&path).unwrap();
        assert!(diff.contains("+staged content"));
        assert!(!diff.contains("private"));
        std::fs::write(temp.join("file.txt"), "x".repeat(120_001)).unwrap();
        git(&temp, &["add", "file.txt"]).unwrap();
        assert!(staged_diff(&path).is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn reads_changed_paths_and_renames_without_splitting_filenames() {
        let changes = parse_changes(" M file with spaces\0A  staged.txt\0?? new\nfile.txt\0R  renamed.txt\0old.txt\0 D deleted.txt\0UU conflict.txt\0");
        assert_eq!(changes.len(), 6);
        assert_eq!(changes[0].status, " M");
        assert_eq!(changes[0].path, "file with spaces");
        assert_eq!(changes[1].status, "A ");
        assert_eq!(changes[2].path, "new\nfile.txt");
        assert_eq!(changes[3].path, "renamed.txt");
        assert_eq!(changes[3].original_path.as_deref(), Some("old.txt"));
        assert_eq!(changes[4].status, " D");
        assert_eq!(changes[5].status, "UU");
    }

    #[tokio::test]
    async fn image_previews_read_head_index_and_worktree_bytes() {
        let temp = std::env::temp_dir().join(format!("bud-images-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        let original = [137, 80, 78, 71, 255, 0];
        std::fs::write(temp.join("image.png"), original).unwrap();
        let expected = format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(original)
        );
        let preview = git_image_diff(path.clone(), "image.png".into(), false)
            .await
            .unwrap();
        assert!(preview.before.is_none());
        assert_eq!(preview.after.as_deref(), Some(expected.as_str()));
        git(&temp, &["add", "."]).unwrap();
        let preview = git_image_diff(path.clone(), "image.png".into(), true)
            .await
            .unwrap();
        assert!(preview.before.is_none());
        assert_eq!(preview.after.as_deref(), Some(expected.as_str()));
        git(&temp, &["commit", "-m", "Image"]).unwrap();
        std::fs::write(temp.join("image.png"), b"index").unwrap();
        git(&temp, &["add", "."]).unwrap();
        std::fs::write(temp.join("image.png"), b"working").unwrap();
        let staged = git_image_diff(path.clone(), "image.png".into(), true)
            .await
            .unwrap();
        let unstaged = git_image_diff(path.clone(), "image.png".into(), false)
            .await
            .unwrap();
        assert_eq!(staged.before.as_deref(), Some(expected.as_str()));
        assert_eq!(staged.after, unstaged.before);
        assert_ne!(unstaged.before, unstaged.after);
        std::fs::remove_file(temp.join("image.png")).unwrap();
        let preview = git_image_diff(path.clone(), "image.png".into(), false)
            .await
            .unwrap();
        assert!(preview.before.is_some());
        assert!(preview.after.is_none());
        assert!(git_image_diff(path.clone(), "../outside.png".into(), false)
            .await
            .is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[tokio::test]
    async fn checkout_older_commit_preserves_branches_and_local_changes() {
        let temp =
            std::env::temp_dir().join(format!("bud-checkout-commit-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        std::fs::write(temp.join("file.txt"), "old").unwrap();
        git(&temp, &["add", "."]).unwrap();
        git(&temp, &["commit", "-m", "Old"]).unwrap();
        let older = git(&temp, &["rev-parse", "HEAD"])
            .unwrap()
            .trim()
            .to_string();
        std::fs::write(temp.join("file.txt"), "new").unwrap();
        git(&temp, &["commit", "-am", "New"]).unwrap();
        let tip = git(&temp, &["rev-parse", "HEAD"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        std::fs::write(temp.join("file.txt"), "local edits").unwrap();
        assert!(git_checkout_commit(path.clone(), older.clone())
            .await
            .is_err());
        assert_eq!(
            std::fs::read_to_string(temp.join("file.txt")).unwrap(),
            "local edits"
        );
        assert_eq!(git(&temp, &["rev-parse", "HEAD"]).unwrap(), tip);
        git(&temp, &["restore", "file.txt"]).unwrap();
        for invalid in [
            "--detach",
            "HEAD",
            "0000000000000000000000000000000000000000",
        ] {
            assert!(git_checkout_commit(path.clone(), invalid.into())
                .await
                .is_err());
        }
        let repo = git_checkout_commit(path.clone(), older.clone())
            .await
            .unwrap();
        assert_eq!(repo.current_branch, "Detached HEAD");
        assert_eq!(git(&temp, &["rev-parse", "HEAD"]).unwrap().trim(), older);
        assert_eq!(git(&temp, &["rev-parse", "main"]).unwrap(), tip);
        git_checkout(path, "main".into()).await.unwrap();
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[tokio::test]
    async fn branch_delete_option_removes_origin_only_when_requested() {
        let temp = std::env::temp_dir().join(format!("bud-delete-origin-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(
            &temp,
            &[
                "-c",
                "commit.gpgsign=false",
                "commit",
                "--allow-empty",
                "-m",
                "Initial",
            ],
        )
        .unwrap();
        git(&temp, &["init", "--bare", "origin.git"]).unwrap();
        git(&temp, &["remote", "add", "origin", "./origin.git"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        for delete_origin in [false, true] {
            git(&temp, &["branch", "feature"]).unwrap();
            git(&temp, &["push", "origin", "feature"]).unwrap();
            git_branch_action(
                path.clone(),
                "feature".into(),
                "delete".into(),
                None,
                Some(delete_origin),
                None,
            )
            .await
            .unwrap();
            assert!(git(&temp, &["show-ref", "--verify", "refs/heads/feature"]).is_err());
            let remote = git(
                &temp,
                &["ls-remote", "--heads", "origin", "refs/heads/feature"],
            )
            .unwrap();
            assert_eq!(remote.trim().is_empty(), delete_origin);
        }
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[tokio::test]
    async fn tags_sort_newest_first_and_delete_origin_only_when_requested() {
        let temp = std::env::temp_dir().join(format!("bud-delete-tag-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(
            &temp,
            &[
                "-c",
                "commit.gpgsign=false",
                "commit",
                "--allow-empty",
                "-m",
                "Initial",
            ],
        )
        .unwrap();
        git(&temp, &["init", "--bare", "origin.git"]).unwrap();
        git(&temp, &["remote", "add", "origin", "./origin.git"]).unwrap();
        for (name, date) in [
            ("a-old", "2025-01-01T12:00:00Z"),
            ("z-new", "2026-01-01T12:00:00Z"),
        ] {
            let mut cmd = command(Some(&temp), None).unwrap();
            cmd.env("GIT_COMMITTER_DATE", date).args([
                "-c",
                "tag.gpgsign=false",
                "tag",
                "-a",
                name,
                "-m",
                name,
            ]);
            execute(cmd).unwrap();
        }
        let path = temp.to_string_lossy().into_owned();
        assert_eq!(
            inspect(&path)
                .unwrap()
                .tags
                .iter()
                .map(|tag| tag.name.as_str())
                .collect::<Vec<_>>(),
            vec!["z-new", "a-old"]
        );
        let original = git(&temp, &["rev-parse", "HEAD"])
            .unwrap()
            .trim()
            .to_string();
        git(
            &temp,
            &[
                "-c",
                "commit.gpgsign=false",
                "commit",
                "--allow-empty",
                "-m",
                "Later",
            ],
        )
        .unwrap();
        git_create_tag(path.clone(), original.clone(), "from-commit".into())
            .await
            .unwrap();
        assert_eq!(
            git(&temp, &["rev-parse", "refs/tags/from-commit"])
                .unwrap()
                .trim(),
            original
        );
        assert!(
            git_create_tag(path.clone(), original.clone(), "from-commit".into())
                .await
                .is_err()
        );
        assert!(
            git_create_tag(path.clone(), original.clone(), "bad name".into())
                .await
                .is_err()
        );
        assert!(git_create_tag(path.clone(), "--bad".into(), "safe".into())
            .await
            .is_err());
        git(&temp, &["tag", "unrelated"]).unwrap();
        git_push_tag(path.clone(), "z-new".into(), None)
            .await
            .unwrap();
        git_push_tag(path.clone(), "a-old".into(), None)
            .await
            .unwrap();
        assert!(git(
            &temp,
            &["ls-remote", "--tags", "origin", "refs/tags/unrelated"]
        )
        .unwrap()
        .trim()
        .is_empty());
        assert!(git_push_tag(path.clone(), "--bad".into(), None)
            .await
            .is_err());
        for (name, delete_origin) in [("z-new", false), ("a-old", true)] {
            let repo = git_delete_tag(path.clone(), name.into(), delete_origin, None)
                .await
                .unwrap();
            assert!(!repo.tags.iter().any(|tag| tag.name == name));
            let remote = git(
                &temp,
                &[
                    "ls-remote",
                    "--tags",
                    "origin",
                    &format!("refs/tags/{name}"),
                ],
            )
            .unwrap();
            assert_eq!(remote.trim().is_empty(), delete_origin);
        }
        assert!(git_delete_tag(path.clone(), "--bad".into(), false, None)
            .await
            .is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn warns_only_when_a_configured_upstream_is_missing() {
        let temp = std::env::temp_dir().join(format!("bud-upstream-gone-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(
            &temp,
            &[
                "-c",
                "commit.gpgsign=false",
                "commit",
                "--allow-empty",
                "-m",
                "Initial",
            ],
        )
        .unwrap();
        git(&temp, &["remote", "add", "origin", "./unused.git"]).unwrap();
        git(&temp, &["branch", "local-only"]).unwrap();
        git(&temp, &["update-ref", "refs/remotes/origin/main", "HEAD"]).unwrap();
        git(&temp, &["branch", "--set-upstream-to=origin/main", "main"]).unwrap();
        git(&temp, &["tag", "lightweight"]).unwrap();
        git(
            &temp,
            &[
                "-c",
                "tag.gpgsign=false",
                "tag",
                "-a",
                "annotated",
                "-m",
                "Release",
            ],
        )
        .unwrap();
        let path = temp.to_string_lossy().into_owned();
        let repo = inspect(&path).unwrap();
        let head = git(&temp, &["rev-parse", "HEAD"]).unwrap();
        assert_eq!(repo.tags.len(), 2);
        assert!(repo.tags.iter().all(|tag| tag.hash == head.trim()));
        assert!(!repo
            .branches
            .iter()
            .any(|branch| branch.name == "annotated" || branch.name == "lightweight"));
        assert!(inspect(&path)
            .unwrap()
            .branches
            .iter()
            .all(|branch| !branch.upstream_gone));
        git(&temp, &["update-ref", "-d", "refs/remotes/origin/main"]).unwrap();
        let repo = inspect(&path).unwrap();
        assert!(
            repo.branches
                .iter()
                .find(|branch| branch.name == "main")
                .unwrap()
                .upstream_gone
        );
        assert!(
            !repo
                .branches
                .iter()
                .find(|branch| branch.name == "local-only")
                .unwrap()
                .upstream_gone
        );
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[tokio::test]
    async fn branch_actions_and_origin_incoming_counts() {
        let temp = std::env::temp_dir().join(format!("bud-branches-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(&temp, &["commit", "--allow-empty", "-m", "Initial"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        let repo = git_branch_action(
            path.clone(),
            "main".into(),
            "new".into(),
            Some("feature".into()),
            None,
            None,
        )
        .await
        .unwrap();
        assert_eq!(repo.current_branch, "feature");
        assert!(git_branch_action(
            path.clone(),
            "feature".into(),
            "delete".into(),
            None,
            None,
            None
        )
        .await
        .is_err());
        git(&temp, &["commit", "--allow-empty", "-m", "First feature"]).unwrap();
        git(&temp, &["commit", "--allow-empty", "-m", "Second feature"]).unwrap();
        git(&temp, &["update-ref", "refs/remotes/origin/main", "HEAD"]).unwrap();
        let repo = inspect(&path).unwrap();
        assert_eq!(
            repo.branches
                .iter()
                .find(|branch| branch.name == "main")
                .unwrap()
                .incoming_commits,
            2
        );
        assert_eq!(
            repo.branches
                .iter()
                .find(|branch| branch.name == "feature")
                .unwrap()
                .incoming_commits,
            0
        );
        git_checkout(path.clone(), "main".into()).await.unwrap();
        assert!(git_branch_action(
            path.clone(),
            "feature".into(),
            "delete".into(),
            None,
            None,
            None
        )
        .await
        .is_err());
        let repo = git_branch_action(
            path.clone(),
            "feature".into(),
            "merge".into(),
            None,
            None,
            None,
        )
        .await
        .unwrap();
        assert_eq!(repo.current_branch, "main");
        assert_eq!(
            repo.branches
                .iter()
                .find(|branch| branch.name == "main")
                .unwrap()
                .incoming_commits,
            0
        );
        let repo = git_branch_action(
            path.clone(),
            "feature".into(),
            "delete".into(),
            None,
            None,
            None,
        )
        .await
        .unwrap();
        assert!(!repo.branches.iter().any(|branch| branch.name == "feature"));
        assert!(git_branch_action(
            path.clone(),
            "origin/main".into(),
            "new".into(),
            Some("bad".into()),
            None,
            None
        )
        .await
        .is_err());
        assert!(git_branch_action(
            path.clone(),
            "main".into(),
            "new".into(),
            Some("--bad".into()),
            None,
            None
        )
        .await
        .is_err());
        assert!(git_branch_action(
            path.clone(),
            "main".into(),
            "merge".into(),
            None,
            None,
            None
        )
        .await
        .is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[tokio::test]
    async fn commits_only_staged_changes_with_message_and_description() {
        let temp = std::env::temp_dir().join(format!("bud-commit-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        assert!(git_commit(path.clone(), "Empty index".into(), "".into())
            .await
            .is_err());
        std::fs::write(temp.join("file.txt"), "staged\n").unwrap();
        git(&temp, &["add", "file.txt"]).unwrap();
        assert!(git_commit(path.clone(), "   ".into(), "Details".into())
            .await
            .is_err());
        std::fs::write(temp.join("file.txt"), "unstaged\n").unwrap();
        std::fs::write(temp.join("untracked.txt"), "keep\n").unwrap();
        let repo = git_commit(
            path.clone(),
            "Initial commit".into(),
            "Description with details.".into(),
        )
        .await
        .unwrap();
        assert!(repo.dirty);
        assert!(repo
            .branches
            .iter()
            .any(|branch| branch.name == "main" && branch.current));
        assert_eq!(git(&temp, &["show", "HEAD:file.txt"]).unwrap(), "staged\n");
        let hash = git(&temp, &["rev-parse", "HEAD"])
            .unwrap()
            .trim()
            .to_string();
        let diff = git_commit_diff(path.clone(), hash).await.unwrap();
        assert!(diff.contains("diff --git a/file.txt b/file.txt"));
        assert!(diff.contains("+staged"));
        assert!(!diff.contains("unstaged"));
        assert!(!diff.contains("untracked.txt"));
        assert!(git_commit_diff(path.clone(), "--all".into()).await.is_err());
        assert_eq!(
            std::fs::read_to_string(temp.join("file.txt")).unwrap(),
            "unstaged\n"
        );
        assert_eq!(
            git(&temp, &["log", "-1", "--format=%B"]).unwrap().trim(),
            "Initial commit\n\nDescription with details."
        );
        assert!(git_commit(path.clone(), "Nothing staged".into(), "".into())
            .await
            .is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[tokio::test]
    async fn stages_unstages_diffs_and_discards_selected_files() {
        let temp = std::env::temp_dir().join(format!("bud-files-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        let path = temp.to_string_lossy().into_owned();
        std::fs::write(temp.join("first.txt"), "initial\n").unwrap();
        git_file_action(path.clone(), vec!["first.txt".into()], "stage".into())
            .await
            .unwrap();
        assert!(git_file_diff(path.clone(), "first.txt".into(), true)
            .await
            .unwrap()
            .contains("+initial"));
        // Unstage also works before the first commit.
        let repo = git_file_action(path.clone(), vec!["first.txt".into()], "unstage".into())
            .await
            .unwrap();
        assert_eq!(repo.changes[0].status, "??");
        git(&temp, &["add", "."]).unwrap();
        git(&temp, &["commit", "-m", "Initial"]).unwrap();
        std::fs::write(temp.join("first.txt"), "staged\n").unwrap();
        git_file_action(path.clone(), vec!["first.txt".into()], "stage".into())
            .await
            .unwrap();
        std::fs::write(temp.join("first.txt"), "unstaged\n").unwrap();
        assert!(git_file_diff(path.clone(), "first.txt".into(), true)
            .await
            .unwrap()
            .contains("+staged"));
        assert!(git_file_diff(path.clone(), "first.txt".into(), false)
            .await
            .unwrap()
            .contains("+unstaged"));
        git_file_action(path.clone(), vec!["first.txt".into()], "unstage".into())
            .await
            .unwrap();
        assert_eq!(
            std::fs::read_to_string(temp.join("first.txt")).unwrap(),
            "unstaged\n"
        );
        std::fs::write(temp.join("[new].txt"), "added\n").unwrap();
        std::fs::write(temp.join("other.txt"), "keep\n").unwrap();
        assert!(git_file_diff(path.clone(), "[new].txt".into(), false)
            .await
            .unwrap()
            .contains("+added"));
        git_file_action(
            path.clone(),
            vec!["first.txt".into(), "[new].txt".into()],
            "stage".into(),
        )
        .await
        .unwrap();
        git_file_action(
            path.clone(),
            vec!["first.txt".into(), "[new].txt".into()],
            "discard".into(),
        )
        .await
        .unwrap();
        assert_eq!(
            std::fs::read_to_string(temp.join("first.txt")).unwrap(),
            "initial\n"
        );
        assert!(!temp.join("[new].txt").exists());
        assert!(temp.join("other.txt").exists());
        assert!(git_file_action(
            path.clone(),
            vec!["../outside.txt".into()],
            "discard".into()
        )
        .await
        .is_err());
        git_file_action(path.clone(), vec!["other.txt".into()], "discard".into())
            .await
            .unwrap();
        assert!(!inspect(&path).unwrap().dirty);
        git(&temp, &["mv", "first.txt", "renamed.txt"]).unwrap();
        git_file_action(path.clone(), vec!["renamed.txt".into()], "unstage".into())
            .await
            .unwrap();
        assert!(temp.join("renamed.txt").exists());
        assert!(git_file_action(
            path.clone(),
            vec!["first.txt".into(), "renamed.txt".into()],
            "discard".into()
        )
        .await
        .is_ok());
        assert!(temp.join("first.txt").exists());
        assert!(!temp.join("renamed.txt").exists());
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn reads_empty_and_merged_repositories_and_clones() {
        let temp = std::env::temp_dir().join(format!("bud-git-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        git(&temp, &["init", "-b", "main"]).unwrap();
        assert!(inspect(temp.to_str().unwrap()).unwrap().branches.is_empty());
        assert!(history(temp.to_str().unwrap(), 300)
            .unwrap()
            .commits
            .is_empty());
        git(&temp, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "tag.gpgsign", "false"]).unwrap();
        git(&temp, &["config", "user.name", "Bud Test"]).unwrap();
        git(&temp, &["config", "user.email", "bud@example.test"]).unwrap();
        git(&temp, &["commit", "--allow-empty", "-m", "First commit"]).unwrap();
        git(&temp, &["switch", "-c", "feature"]).unwrap();
        git(&temp, &["commit", "--allow-empty", "-m", "Feature"]).unwrap();
        git(&temp, &["switch", "main"]).unwrap();
        git(
            &temp,
            &["merge", "--no-ff", "feature", "-m", "Merge feature"],
        )
        .unwrap();
        let repo = inspect(temp.to_str().unwrap()).unwrap();
        assert_eq!(repo.branches.len(), 2);
        assert_eq!(repo.current_branch, "main");
        assert!(!repo.dirty);
        let page = history(temp.to_str().unwrap(), 1).unwrap();
        assert!(page.has_more);
        assert_eq!(page.commits.len(), 1);
        assert_eq!(page.commits[0].subject, "Merge feature");
        assert_eq!(page.commits[0].author_email, "bud@example.test");
        assert_eq!(page.commits[0].parents.len(), 2);
        let full = history(temp.to_str().unwrap(), 300).unwrap();
        assert_eq!(full.commits.len(), 3);
        assert!(!full.has_more);
        assert_eq!(full.commits[1].subject, "Feature");
        assert_eq!(full.commits[2].subject, "First commit");
        git(&temp, &["switch", "--detach"]).unwrap();
        git(&temp, &["commit", "--allow-empty", "-m", "Detached commit"]).unwrap();
        let detached = history(temp.to_str().unwrap(), 300).unwrap();
        assert_eq!(detached.commits[0].subject, "Detached commit");
        git(&temp, &["switch", "main"]).unwrap();
        std::fs::write(temp.join("untracked.txt"), "hello").unwrap();
        assert!(inspect(temp.to_str().unwrap()).unwrap().dirty);
        let clone = temp.join("clone");
        let mut cmd = command(None, None).unwrap();
        cmd.arg("clone").arg(&temp).arg(&clone);
        execute(cmd).unwrap();
        assert!(inspect(clone.to_str().unwrap())
            .unwrap()
            .branches
            .iter()
            .any(|b| b.remote && b.name == "origin/main"));
        std::fs::remove_dir_all(temp).unwrap();
    }
    #[tokio::test]
    async fn clone_fetch_push_checkout_and_key_selection() {
        let temp = std::env::temp_dir().join(format!("bud-remote-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        let bare = temp.join("origin.git");
        let mut init = command(None, None).unwrap();
        init.args(["init", "--bare", "--initial-branch=main"])
            .arg(&bare);
        execute(init).unwrap();
        let repo = git_clone(
            bare.to_string_lossy().into(),
            temp.to_string_lossy().into(),
            "working".into(),
            None,
        )
        .await
        .unwrap();
        let directory = Path::new(&repo.path);
        git(directory, &["config", "commit.gpgsign", "false"]).unwrap();
        git(directory, &["config", "user.name", "Bud Test"]).unwrap();
        git(directory, &["config", "user.email", "bud@example.test"]).unwrap();
        git(directory, &["commit", "--allow-empty", "-m", "Initial"]).unwrap();
        git_remote(repo.path.clone(), "push".into(), "origin".into(), None)
            .await
            .unwrap();
        git_remote(repo.path.clone(), "fetch".into(), "origin".into(), None)
            .await
            .unwrap();
        assert!(inspect(&repo.path)
            .unwrap()
            .branches
            .iter()
            .any(|branch| branch.remote && branch.name == "origin/main"));
        let upstream = git_clone(
            bare.to_string_lossy().into(),
            temp.to_string_lossy().into(),
            "upstream".into(),
            None,
        )
        .await
        .unwrap();
        let upstream_directory = Path::new(&upstream.path);
        git(upstream_directory, &["config", "commit.gpgsign", "false"]).unwrap();
        git(upstream_directory, &["config", "user.name", "Bud Test"]).unwrap();
        git(
            upstream_directory,
            &["config", "user.email", "bud@example.test"],
        )
        .unwrap();
        git(
            upstream_directory,
            &["commit", "--allow-empty", "-m", "Remote update"],
        )
        .unwrap();
        git(upstream_directory, &["push", "origin", "main"]).unwrap();
        let head_before_fetch = git(directory, &["rev-parse", "HEAD"]).unwrap();
        git_remote(repo.path.clone(), "fetch".into(), "origin".into(), None)
            .await
            .unwrap();
        assert_eq!(
            git(directory, &["rev-parse", "HEAD"]).unwrap(),
            head_before_fetch
        );
        let fetched = inspect(&repo.path).unwrap();
        assert_eq!(
            fetched
                .branches
                .iter()
                .find(|branch| branch.current)
                .unwrap()
                .incoming_commits,
            1
        );
        git_remote(repo.path.clone(), "pull".into(), "origin".into(), None)
            .await
            .unwrap();
        assert_eq!(
            git(directory, &["rev-parse", "HEAD"]).unwrap(),
            git(upstream_directory, &["rev-parse", "HEAD"]).unwrap()
        );
        git(
            directory,
            &["commit", "--allow-empty", "-m", "Local update"],
        )
        .unwrap();
        let local_head = git(directory, &["rev-parse", "HEAD"]).unwrap();
        git(
            upstream_directory,
            &["commit", "--allow-empty", "-m", "Diverging update"],
        )
        .unwrap();
        git(upstream_directory, &["push", "origin", "main"]).unwrap();
        assert!(
            git_remote(repo.path.clone(), "pull".into(), "origin".into(), None)
                .await
                .is_err()
        );
        assert_eq!(git(directory, &["rev-parse", "HEAD"]).unwrap(), local_head);
        git(directory, &["branch", "feature"]).unwrap();
        let switched = git_checkout(repo.path.clone(), "feature".into())
            .await
            .unwrap();
        assert_eq!(switched.current_branch, "feature");
        assert!(git_checkout(repo.path.clone(), "--detach".into())
            .await
            .is_err());
        assert!(
            git_remote(repo.path.clone(), "delete".into(), "origin".into(), None)
                .await
                .is_err()
        );
        let key = temp.join("personal key's identity");
        std::fs::write(&key, "-----BEGIN OPENSSH PRIVATE KEY-----\nfixture-only").unwrap();
        let validated = git_validate_key(key.to_string_lossy().into())
            .await
            .unwrap();
        let cmd = command(None, Some(&validated)).unwrap();
        let ssh = cmd
            .get_envs()
            .find(|(name, _)| *name == "GIT_SSH_COMMAND")
            .unwrap()
            .1
            .unwrap()
            .to_string_lossy();
        assert!(ssh.contains("IdentitiesOnly=yes"));
        assert!(ssh.contains("BatchMode=no"));
        assert!(ssh.contains("StrictHostKeyChecking=yes"));
        assert!(cmd
            .get_envs()
            .any(|(name, value)| name == "SSH_ASKPASS_REQUIRE"
                && value == Some(std::ffi::OsStr::new("force"))));
        assert!(cmd
            .get_envs()
            .any(|(name, _)| name == crate::ssh_credentials::ASKPASS_KEY));
        assert!(ssh.contains("personal key'\\''s identity"));
        std::fs::write(&key, "ssh-ed25519 public-key").unwrap();
        assert!(git_validate_key(key.to_string_lossy().into())
            .await
            .is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }
    #[tokio::test]
    async fn initializes_new_repositories_without_overwriting_folders() {
        let temp = std::env::temp_dir().join(format!("bud-init-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).unwrap();
        let repository = git_init(temp.to_string_lossy().into(), "new-project".into())
            .await
            .unwrap();
        assert_eq!(repository.name, "new-project");
        assert_eq!(repository.current_branch, "main");
        assert!(history(&repository.path, 300).unwrap().commits.is_empty());
        assert!(
            git_init(temp.to_string_lossy().into(), "new-project".into())
                .await
                .is_err()
        );
        assert!(git_init(temp.to_string_lossy().into(), "../escape".into())
            .await
            .is_err());
        std::fs::remove_dir_all(temp).unwrap();
    }
    #[test]
    fn recognizes_github_repository_remotes_without_exposing_credentials() {
        for url in [
            "git@github.com:owner/project.git",
            "https://github.com/owner/project.git",
            "ssh://git@github.com/owner/project.git",
            "https://github.com/owner/project/",
        ] {
            assert_eq!(github_repository(url).as_deref(), Some("owner/project"));
        }
        for url in [
            "https://github.com.evil.test/owner/repo",
            "git@gitlab.com:owner/project.git",
            "https://github.com/../repo",
            "https://github.com/owner/repo/extra",
            "https://token@github.com/owner/repo",
        ] {
            assert_eq!(github_repository(url), None);
        }
    }
}

pub fn staged_diff(path: &str) -> Result<String, String> {
    let directory = root(path)?;
    let diff = git(
        &directory,
        &[
            "diff",
            "--cached",
            "--no-ext-diff",
            "--no-textconv",
            "--unified=3",
        ],
    )?;
    if diff.trim().is_empty() {
        return Err("Stage text changes before generating a message.".into());
    }
    if diff.len() > 120_000 {
        return Err(
            "Staged changes are too large for AI generation. Stage a smaller commit.".into(),
        );
    }
    Ok(diff)
}
