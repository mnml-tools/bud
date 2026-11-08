# Bud

Bud 0.1.0 is a local Git manager built with React and Tauri. Open or clone repositories, explore local and remote branches, and follow a colourful commit graph across all refs.

- Browse saved repositories in a searchable grid (default) or list, with the view remembered across launches. Choose an avatar colour when opening, creating, or cloning a repository; change it later from the repository card.
- Save local repositories and reopen them from the home screen. Removing a saved repository only removes the shortcut; files stay on disk.
- View all local branches and remote-tracking branches, switch local branches, and jump to branch tips in the graph.
- Browse history in batches of 300 with virtualized rows, including merge connections, authors, dates, refs, and commit hashes. Fetch updates remote-tracking refs; Git network operations run only when requested. Author photos load from GitHub using the repository commit’s author profile (or a GitHub noreply identity), or Gravatar using a SHA-256 hash of the commit email; unavailable photos use local initials. Author avatars are circular; repository avatars remain square.
- Register existing SSH private keys, set a default for new repositories, and select an identity for each repository. Clone, fetch, and push use the selected identity for SSH URLs.
- Keep light/dark modes and five accent colours. New installations default to green; saved appearance choices are respected.

The original license and attribution are preserved in LICENSE.

## Development

Install Git and make it available on PATH, alongside Node.js and the Rust/Tauri prerequisites.

```sh
npm ci
npm run tauri dev
```

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

During `npm run dev`, visit `/tests/git.html` for an isolated UI fixture. It simulates native commands and never accesses real repositories or SSH keys.

## SSH identities

Use **SSH identities** to register a private key file with a friendly name. Bud stores the label and canonical file path in preferences. Optional key passwords are stored separately in the system credential store (Keychain on macOS, Credential Manager on Windows, or Secret Service on Linux). The identity selector above commit history applies to the opened repository; clone has its own selector.

Enter a key password when adding an identity, or use Set/Change password on an existing identity. Bud uses the saved password automatically for clone, fetch, and push. Encrypted keys without a saved password can still use your SSH agent. You can replace or remove a saved password; removing the identity also removes its stored password. The default **SSH config / agent** option uses your OpenSSH configuration and agent. Selected keys use `IdentitiesOnly=yes`. Unknown hosts must first be verified through SSH in a terminal; Bud keeps host verification enabled and does not show terminal password prompts. HTTPS remotes use existing Git credential helpers instead of SSH keys.

This version registers existing keys; it does not generate keys or upload public keys. Fetch and push act on the selected remote. Push asks for confirmation and pushes only the current branch, without force.

## Shortcuts

Use Command on macOS and Ctrl on other platforms:

| Shortcut                       | Action                                    |
| ------------------------------ | ----------------------------------------- |
| Command/Ctrl+P                 | Switch saved repositories from the header |
| Command/Ctrl+O                 | Open a local repository                   |
| Command/Ctrl+N                 | Clone a repository                        |
| Command/Ctrl+Shift+K           | Manage SSH identities                     |
| Command/Ctrl+R                 | Refresh the opened repository             |
| Command/Ctrl+F or double Shift | Focus commit search                       |
| Escape                         | Dismiss a popup when idle                 |

The shared shortcut dispatcher ignores background commands while a dialog is open. Dialogs retain focus trapping, Escape handling, and backdrop dismissal. Closing or installing an update waits for active Git operations.

## App icons

Edit `src-tauri/icons/AppIcon.icon` in Icon Composer, then run `npm run icons` on macOS with Xcode selected. This exports `src/assets/AppIcon.png`, regenerates desktop and mobile icon assets, and compiles the native macOS icon catalog. Other platforms use a flattened version of the default macOS appearance.

Run `npm run icons:mac` to compile only the native macOS icon catalog, or `npm run icons:png` to regenerate standard assets from the checked-in PNG on any platform.

Release and updater URLs target `mnml-tools/bud`. Configure that repository and its signing secrets before publishing a release.

For a live author-avatar check against a public GitHub sample, visit `/tests/git.html?github=1` during development. GitHub profile lookup uses the public API without credentials; private repositories or API limits fall back to Gravatar/initials.
