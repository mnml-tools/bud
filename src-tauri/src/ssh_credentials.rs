use keyring::{Entry, Error};
use std::io::Write;

const SERVICE: &str = "eu.rafms.bud.ssh-passphrases";
pub const ASKPASS_KEY: &str = "BUD_SSH_ASKPASS_KEY";

fn entry(path: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, path)
        .map_err(|error| format!("Unable to access the system credential store: {error}"))
}

fn read(entry: &Entry) -> Result<Option<String>, String> {
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read the saved key password: {error}")),
    }
}

fn save(entry: &Entry, password: &str) -> Result<(), String> {
    if password.contains(['\n', '\r', '\0']) {
        return Err("The key password cannot contain a newline or NUL character.".into());
    }
    if password.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Unable to remove the saved key password: {error}")),
        }
    } else {
        entry.set_password(password).map_err(|error| {
            format!("Unable to save the key password in the system credential store: {error}")
        })
    }
}

// This helper is launched by OpenSSH, before any Tauri/UI initialization.
// Only answer a private-key passphrase prompt for the selected identity.
fn allowed_prompt(prompt: &str, path: &str) -> bool {
    let prompt = prompt.replace('\\', "/");
    let path = path.replace('\\', "/");
    prompt.starts_with("Enter passphrase for key ") && prompt.contains(&format!("'{path}'"))
}

pub fn handle_askpass() {
    let Some(path) = std::env::var_os(ASKPASS_KEY) else {
        return;
    };
    let path = path.to_string_lossy();
    let prompt = std::env::args().nth(1).unwrap_or_default();
    if !allowed_prompt(&prompt, &path) {
        std::process::exit(1);
    }
    let password = entry(&path).and_then(|entry| read(&entry));
    match password {
        Ok(Some(password)) => {
            let result = writeln!(std::io::stdout().lock(), "{password}");
            std::process::exit(if result.is_ok() { 0 } else { 1 });
        }
        _ => std::process::exit(1),
    }
}

#[tauri::command]
pub async fn git_save_key_password(path: String, password: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || save(&entry(&path)?, &password))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn git_key_password_status(path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || read(&entry(&path)?).map(|value| value.is_some()))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use keyring::credential::CredentialBuilderApi;

    #[test]
    fn saves_replaces_and_deletes_without_plaintext_preferences() {
        let credential = keyring::mock::MockCredentialBuilder {}
            .build(None, "bud-test", "identity")
            .unwrap();
        let entry = Entry::new_with_credential(credential);
        assert_eq!(read(&entry).unwrap(), None);
        save(&entry, "encrypted key password").unwrap();
        assert_eq!(
            read(&entry).unwrap().as_deref(),
            Some("encrypted key password")
        );
        save(&entry, "replacement").unwrap();
        assert_eq!(read(&entry).unwrap().as_deref(), Some("replacement"));
        assert!(save(&entry, "invalid\npassword").is_err());
        save(&entry, "").unwrap();
        assert_eq!(read(&entry).unwrap(), None);
        save(&entry, "").unwrap();
        let mock: &keyring::mock::MockCredential = entry.get_credential().downcast_ref().unwrap();
        mock.set_error(Error::Invalid("credential store".into(), "locked".into()));
        assert!(read(&entry).unwrap_err().contains("locked"));
        mock.set_error(Error::Invalid("credential store".into(), "locked".into()));
        assert!(save(&entry, "must-not-be-in-error")
            .unwrap_err()
            .contains("locked"));
    }

    #[test]
    fn never_answers_server_passwords_host_confirmation_or_another_key() {
        assert!(allowed_prompt(
            "Enter passphrase for key '/tmp/personal key': ",
            "/tmp/personal key"
        ));
        assert!(!allowed_prompt(
            "git@example.com's password: ",
            "/tmp/personal key"
        ));
        assert!(!allowed_prompt(
            "Are you sure you want to continue connecting?",
            "/tmp/personal key"
        ));
        assert!(!allowed_prompt(
            "Enter passphrase for key '/tmp/work': ",
            "/tmp/personal key"
        ));
    }
}
