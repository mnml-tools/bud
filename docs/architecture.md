# Bud architecture

Bud uses React with atomic UI components and a Tauri backend that invokes the installed Git executable. Shared CSS retains the original inputs, borders, radii, typography, light/dark themes, and accent selection. The default accent is green.

## UI layers

- `src/components/atoms`: controls such as Button and StatusDot.
- `src/components/molecules`: shared dialogs, appearance controls, branding, window controls, and resize handles.
- `src/components/organisms`: repository listing, clone and SSH dialogs, branch sidebar, and commit history.
- `src/components/templates/AppShell.tsx`: shared header, footer, and window layout.
- `src/pages/GitWorkspacePage.tsx`: composes the repository toolbar, sidebar, graph, and remote actions.
- `src/app/App.tsx`: switches between the home screen and open repository; coordinates global dialogs and shortcuts.

Each React component lives in its own file. Components receive data and callbacks; `useGitWorkspace` owns repository state, native requests, busy/error handling, and saved repository/identity preferences. Repository and key labels/paths persist in local preferences; private key contents are never returned to the frontend.

## Native boundary

`src/services/git.ts` provides the injectable native request adapter. `src-tauri/src/git.rs` validates repository roots and runs Git using argument arrays. Blocking work runs off the UI thread; process output is drained concurrently, terminal prompts are disabled, and operations time out after two minutes.

The backend exposes explicit commands for open, history, clone, checkout, fetch/push, private-key validation, and native path pickers. History includes all refs plus a valid HEAD and uses topological order. NUL-delimited metadata preserves subjects containing tabs. Unborn repositories have an empty history. Opening a repository never fetches automatically.

SSH identity overrides are scoped to the Git child process through `GIT_SSH_COMMAND`, with shell-quoted paths, `IdentitiesOnly=yes`, strict host verification, and an isolated askpass helper for selected keys. Passphrases are saved through keyring in the system credential store. A native askpass mode, entered before Tauri initializes, retrieves a password only for the selected key’s passphrase prompt. Secrets never enter Git arguments, environment variables, local preferences, or temporary files. Server-password and host-confirmation prompts are rejected. Keys without a saved passphrase can use the SSH agent. HTTPS authentication remains with Git credential helpers.

## Graph and interactions

`src/lib/commitGraph.ts` assigns lanes to pending parent hashes, splits merge edges into different colours, and converges shared ancestors. Loading additional history recomputes the same graph prefix. `CommitHistory` virtualizes rows to avoid mounting the complete history at once. Search highlights matching rows while retaining the graph topology; branch clicks jump to their loaded tip commit.

The shared shortcut dispatcher handles platform modifiers, double Shift, input exclusions, and dialog exclusions. Native HTML dialogs provide focus trapping, Escape handling, backdrop dismissal, and focus restoration. Sidebar resizing, native window geometry, appearance persistence, unsaved-close protection, and updater safety logic are retained.

Modified text files support partial staging through **Stage hunk** / **Unstage hunk** controls in All changes. The frontend sends the displayed diff and hunk index; `git_hunk_action` regenerates and checks the diff before constructing a patch from that single hunk. Git applies it to the index through stdin with `git apply --cached` (reversed for unstaging), leaving the working file untouched. Additions, deletions, renames, mode changes, conflicts, and binary files continue to use file-level actions. The commit form commits the resulting index as usual.

## Validation

`npm test` covers graph topology, shared shortcuts, and updater safety. `cargo test --manifest-path src-tauri/Cargo.toml --locked` creates disposable repositories to test empty and merged histories, detached HEAD, cloning, fetching, pushing, switching branches, and SSH identity validation/quoting. `npm run build` checks TypeScript and the production bundle.

`/tests/git.html` is an isolated UI fixture with simulated repositories, history, and native commands for browser verification. Real repository access requires the desktop app.

## Optional AI commit drafts

The commit form's sparkle action generates an editable conventional commit subject and description; it never stages files, commits, or pushes. AI is disabled by default. The settings control configures an OpenAI-compatible API base URL and model ID, with an optional API key stored in the OS credential store under a separate service and endpoint account. Only endpoint, model, and enabled state are saved in the app configuration directory. Local model servers can use HTTP on loopback; remote endpoints require HTTPS.

`commit_ai.rs` reads the index through `git diff --cached --no-ext-diff --no-textconv`, rejects empty or oversized diffs (120 KB), and sends the diff only after an explicit generate action. Requests time out after 60 seconds and do not follow redirects. Provider errors omit response bodies to avoid echoing credentials or source content. Generated JSON is validated before reaching the form; existing drafts require an explicit replacement action. No Python or gac installation is required.
