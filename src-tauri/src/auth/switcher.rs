//! Account switching logic - writes credentials to ~/.codex/auth.json

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use base64::Engine;
use chrono::Utc;
use sha2::{Digest, Sha256};

use crate::types::{
    AuthData, AuthDotJson, AuthMode, StoredAccount, TokenData, WorkspaceAuthState,
    WorkspaceAuthStatus,
};

#[derive(Debug, Clone)]
pub struct AuthFileBackup {
    auth_path: PathBuf,
    original_bytes: Option<Vec<u8>>,
    pub backup_path: Option<PathBuf>,
}

/// Get the official Codex home directory
pub fn get_codex_home() -> Result<PathBuf> {
    if let Ok(codex_home) = std::env::var("CODEX_HOME") {
        return Ok(PathBuf::from(codex_home));
    }

    let home = dirs::home_dir().context("Could not find home directory")?;
    Ok(home.join(".codex"))
}

/// Get the path to the official auth.json file
pub fn get_codex_auth_file() -> Result<PathBuf> {
    Ok(get_codex_home()?.join("auth.json"))
}

fn get_switcher_backup_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Could not find home directory")?;
    Ok(home.join(".codex-switcher").join("backups"))
}

/// Switch to a specific account by writing its credentials to ~/.codex/auth.json
pub fn switch_to_account(account: &StoredAccount) -> Result<()> {
    let auth_json = create_auth_json(account)?;
    let auth_path = get_codex_auth_file()?;
    write_auth_json_to_path(&auth_path, &auth_json)
}

/// Create a backup of the current auth.json so failed switch attempts can roll back safely.
pub fn create_auth_backup() -> Result<AuthFileBackup> {
    let auth_path = get_codex_auth_file()?;
    let original_bytes = if auth_path.exists() {
        Some(
            fs::read(&auth_path)
                .with_context(|| format!("Failed to read auth.json: {}", auth_path.display()))?,
        )
    } else {
        None
    };

    let backup_path = if let Some(bytes) = original_bytes.as_ref() {
        let backup_dir = get_switcher_backup_dir()?;
        fs::create_dir_all(&backup_dir)
            .with_context(|| format!("Failed to create backup dir: {}", backup_dir.display()))?;

        let backup_path = backup_dir.join(format!(
            "auth-{}.json.bak",
            Utc::now().format("%Y%m%d%H%M%S%3f")
        ));
        fs::write(&backup_path, bytes)
            .with_context(|| format!("Failed to write backup file: {}", backup_path.display()))?;
        set_file_permissions(&backup_path)?;
        Some(backup_path)
    } else {
        None
    };

    Ok(AuthFileBackup {
        auth_path,
        original_bytes,
        backup_path,
    })
}

/// Restore auth.json from a previously captured backup snapshot.
pub fn restore_auth_backup(backup: &AuthFileBackup) -> Result<()> {
    if let Some(bytes) = backup.original_bytes.as_ref() {
        if let Some(parent) = backup.auth_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to recreate codex home: {}", parent.display()))?;
        }
        fs::write(&backup.auth_path, bytes).with_context(|| {
            format!(
                "Failed to restore auth.json: {}",
                backup.auth_path.display()
            )
        })?;
        set_file_permissions(&backup.auth_path)?;
        return Ok(());
    }

    if backup.auth_path.exists() {
        fs::remove_file(&backup.auth_path).with_context(|| {
            format!(
                "Failed to remove auth.json during rollback: {}",
                backup.auth_path.display()
            )
        })?;
    }

    Ok(())
}

/// Verify that the current auth.json now matches the target account.
pub fn verify_current_auth_matches_account(account: &StoredAccount) -> Result<()> {
    let current = read_current_auth()?
        .context("Switch verification failed because auth.json is missing after write")?;
    let expected = account_fingerprint(account)
        .context("Switch verification failed because target account has no usable credentials")?;
    let actual = auth_fingerprint(&current)
        .context("Switch verification failed because auth.json has no usable credentials")?;

    if expected != actual {
        anyhow::bail!("Switch verification failed because the written auth.json does not match the selected account");
    }

    Ok(())
}

/// Build the current workspace auth state by matching the live auth.json against stored accounts.
pub fn inspect_workspace_auth(
    accounts: &[StoredAccount],
    active_account_id: Option<&str>,
) -> WorkspaceAuthState {
    let active_account = active_account_id.and_then(|active_id| {
        accounts
            .iter()
            .find(|account| account.id == active_id)
            .map(|account| (account.id.clone(), account.name.clone()))
    });

    let auth_path = match get_codex_auth_file() {
        Ok(path) => path,
        Err(error) => {
            return WorkspaceAuthState {
                path: String::new(),
                exists: false,
                status: WorkspaceAuthStatus::Invalid,
                auth_mode: None,
                matched_account_id: None,
                matched_account_name: None,
                active_account_id: active_account.as_ref().map(|(id, _)| id.clone()),
                active_account_name: active_account.as_ref().map(|(_, name)| name.clone()),
                active_matches_live: false,
                email: None,
                plan_type: None,
                error: Some(error.to_string()),
            };
        }
    };

    if !auth_path.exists() {
        return WorkspaceAuthState {
            path: auth_path.display().to_string(),
            exists: false,
            status: WorkspaceAuthStatus::Missing,
            auth_mode: None,
            matched_account_id: None,
            matched_account_name: None,
            active_account_id: active_account.as_ref().map(|(id, _)| id.clone()),
            active_account_name: active_account.as_ref().map(|(_, name)| name.clone()),
            active_matches_live: false,
            email: None,
            plan_type: None,
            error: None,
        };
    }

    let content = match fs::read_to_string(&auth_path) {
        Ok(content) => content,
        Err(error) => {
            return WorkspaceAuthState {
                path: auth_path.display().to_string(),
                exists: true,
                status: WorkspaceAuthStatus::Invalid,
                auth_mode: None,
                matched_account_id: None,
                matched_account_name: None,
                active_account_id: active_account.as_ref().map(|(id, _)| id.clone()),
                active_account_name: active_account.as_ref().map(|(_, name)| name.clone()),
                active_matches_live: false,
                email: None,
                plan_type: None,
                error: Some(error.to_string()),
            };
        }
    };

    let auth: AuthDotJson = match serde_json::from_str(&content) {
        Ok(auth) => auth,
        Err(error) => {
            return WorkspaceAuthState {
                path: auth_path.display().to_string(),
                exists: true,
                status: WorkspaceAuthStatus::Invalid,
                auth_mode: None,
                matched_account_id: None,
                matched_account_name: None,
                active_account_id: active_account.as_ref().map(|(id, _)| id.clone()),
                active_account_name: active_account.as_ref().map(|(_, name)| name.clone()),
                active_matches_live: false,
                email: None,
                plan_type: None,
                error: Some(error.to_string()),
            };
        }
    };

    build_workspace_auth_state(auth_path, &auth, accounts, active_account)
}

/// Import an account from an existing auth.json file
pub fn import_from_auth_json(path: &str, account_name: String) -> Result<StoredAccount> {
    let content =
        fs::read_to_string(path).with_context(|| format!("Failed to read auth.json: {path}"))?;

    import_from_auth_json_contents(&content, account_name)
        .with_context(|| format!("Failed to parse auth.json: {path}"))
}

/// Import an account from auth.json file contents.
pub fn import_from_auth_json_contents(
    content: &str,
    account_name: String,
) -> Result<StoredAccount> {
    let auth: AuthDotJson =
        serde_json::from_str(content).context("Failed to parse auth.json contents")?;

    if let Some(api_key) = auth.openai_api_key {
        Ok(StoredAccount::new_api_key(account_name, api_key))
    } else if let Some(tokens) = auth.tokens {
        let (email, plan_type, account_id) = parse_id_token_claims(&tokens.id_token);

        Ok(StoredAccount::new_chatgpt(
            account_name,
            email,
            plan_type,
            tokens.id_token,
            tokens.access_token,
            tokens.refresh_token,
            account_id.or(tokens.account_id),
        ))
    } else {
        anyhow::bail!("auth.json contains neither API key nor tokens");
    }
}

/// Read the current auth.json file if it exists
pub fn read_current_auth() -> Result<Option<AuthDotJson>> {
    let path = get_codex_auth_file()?;

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read auth.json: {}", path.display()))?;

    let auth: AuthDotJson = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse auth.json: {}", path.display()))?;

    Ok(Some(auth))
}

/// Check if there is an active Codex login
pub fn has_active_login() -> Result<bool> {
    match read_current_auth()? {
        Some(auth) => Ok(auth.openai_api_key.is_some() || auth.tokens.is_some()),
        None => Ok(false),
    }
}

fn write_auth_json_to_path(path: &Path, auth_json: &AuthDotJson) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create codex home: {}", parent.display()))?;
    }

    let content =
        serde_json::to_string(auth_json).context("Failed to serialize auth.json")?;

    fs::write(path, content)
        .with_context(|| format!("Failed to write auth.json: {}", path.display()))?;
    set_file_permissions(path)?;
    Ok(())
}

fn set_file_permissions(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, perms)?;
    }

    #[cfg(not(unix))]
    {
        let _ = path;
    }

    Ok(())
}

/// Create an AuthDotJson structure from a StoredAccount
fn create_auth_json(account: &StoredAccount) -> Result<AuthDotJson> {
    match &account.auth_data {
        AuthData::ApiKey { key } => Ok(AuthDotJson {
            openai_api_key: Some(key.clone()),
            tokens: None,
            last_refresh: None,
        }),
        AuthData::ChatGPT {
            id_token,
            access_token,
            refresh_token,
            account_id,
        } => Ok(AuthDotJson {
            openai_api_key: None,
            tokens: Some(TokenData {
                id_token: id_token.clone(),
                access_token: access_token.clone(),
                refresh_token: refresh_token.clone(),
                account_id: account_id.clone(),
            }),
            last_refresh: Some(Utc::now()),
        }),
    }
}

fn build_workspace_auth_state(
    auth_path: PathBuf,
    auth: &AuthDotJson,
    accounts: &[StoredAccount],
    active_account: Option<(String, String)>,
) -> WorkspaceAuthState {
    let (auth_mode, email, plan_type) = auth_summary(auth);
    let Some(fingerprint) = auth_fingerprint(auth) else {
        return WorkspaceAuthState {
            path: auth_path.display().to_string(),
            exists: true,
            status: WorkspaceAuthStatus::Invalid,
            auth_mode,
            matched_account_id: None,
            matched_account_name: None,
            active_account_id: active_account.as_ref().map(|(id, _)| id.clone()),
            active_account_name: active_account.as_ref().map(|(_, name)| name.clone()),
            active_matches_live: false,
            email,
            plan_type,
            error: Some("auth.json contains neither API key nor tokens".to_string()),
        };
    };

    let matched = accounts.iter().find(|account| {
        account_fingerprint(account)
            .as_ref()
            .is_some_and(|candidate| candidate == &fingerprint)
    });

    let matched_account_id = matched.map(|account| account.id.clone());
    let matched_account_name = matched.map(|account| account.name.clone());
    let active_account_id = active_account.as_ref().map(|(id, _)| id.clone());
    let active_account_name = active_account.as_ref().map(|(_, name)| name.clone());

    WorkspaceAuthState {
        path: auth_path.display().to_string(),
        exists: true,
        status: if matched_account_id.is_some() {
            WorkspaceAuthStatus::Matched
        } else {
            WorkspaceAuthStatus::Unmatched
        },
        auth_mode,
        matched_account_id: matched_account_id.clone(),
        matched_account_name,
        active_account_id: active_account_id.clone(),
        active_account_name,
        active_matches_live: matched_account_id == active_account_id,
        email,
        plan_type,
        error: None,
    }
}

fn auth_summary(auth: &AuthDotJson) -> (Option<AuthMode>, Option<String>, Option<String>) {
    if auth.openai_api_key.is_some() {
        return (Some(AuthMode::ApiKey), None, None);
    }

    let Some(tokens) = auth.tokens.as_ref() else {
        return (None, None, None);
    };

    let (email, plan_type, _) = parse_id_token_claims(&tokens.id_token);
    (Some(AuthMode::ChatGPT), email, plan_type)
}

fn parse_id_token_claims(id_token: &str) -> (Option<String>, Option<String>, Option<String>) {
    let parts: Vec<&str> = id_token.split('.').collect();
    if parts.len() != 3 {
        return (None, None, None);
    }

    let payload = match base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(parts[1]) {
        Ok(bytes) => bytes,
        Err(_) => return (None, None, None),
    };

    let json: serde_json::Value = match serde_json::from_slice(&payload) {
        Ok(v) => v,
        Err(_) => return (None, None, None),
    };

    let email = json.get("email").and_then(|v| v.as_str()).map(String::from);
    let auth_claims = json.get("https://api.openai.com/auth");
    let plan_type = auth_claims
        .and_then(|auth| auth.get("chatgpt_plan_type"))
        .and_then(|v| v.as_str())
        .map(String::from);
    let account_id = auth_claims
        .and_then(|auth| auth.get("chatgpt_account_id"))
        .and_then(|v| v.as_str())
        .map(String::from);

    (email, plan_type, account_id)
}

fn auth_fingerprint(auth: &AuthDotJson) -> Option<String> {
    if let Some(api_key) = auth.openai_api_key.as_ref().filter(|key| !key.is_empty()) {
        return Some(secret_fingerprint("api_key", api_key));
    }

    let tokens = auth.tokens.as_ref()?;
    token_fingerprint(
        &tokens.refresh_token,
        &tokens.access_token,
        &tokens.id_token,
        tokens.account_id.as_deref(),
    )
}

pub fn account_fingerprint(account: &StoredAccount) -> Option<String> {
    match &account.auth_data {
        AuthData::ApiKey { key } if !key.is_empty() => Some(secret_fingerprint("api_key", key)),
        AuthData::ApiKey { .. } => None,
        AuthData::ChatGPT {
            refresh_token,
            access_token,
            id_token,
            account_id,
        } => token_fingerprint(refresh_token, access_token, id_token, account_id.as_deref()),
    }
}

fn token_fingerprint(
    refresh_token: &str,
    access_token: &str,
    id_token: &str,
    account_id: Option<&str>,
) -> Option<String> {
    if !refresh_token.is_empty() {
        return Some(secret_fingerprint("chatgpt_refresh", refresh_token));
    }

    if !access_token.is_empty() {
        return Some(secret_fingerprint("chatgpt_access", access_token));
    }

    if !id_token.is_empty() {
        let decorated = match account_id {
            Some(account_id) if !account_id.is_empty() => format!("{id_token}:{account_id}"),
            _ => id_token.to_string(),
        };
        return Some(secret_fingerprint("chatgpt_id", &decorated));
    }

    None
}

fn secret_fingerprint(kind: &str, value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(kind.as_bytes());
    hasher.update(b":");
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn sample_chatgpt_account() -> StoredAccount {
        StoredAccount::new_chatgpt(
            "Work".to_string(),
            Some("work@example.com".to_string()),
            Some("pro".to_string()),
            "header.eyJlbWFpbCI6IndvcmtAZXhhbXBsZS5jb20iLCJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9wbGFuX3R5cGUiOiJwcm8iLCJjaGF0Z3B0X2FjY291bnRfaWQiOiJhY2NfMTIzIn19.signature".to_string(),
            "access-123".to_string(),
            "refresh-123".to_string(),
            Some("acc_123".to_string()),
        )
    }

    #[test]
    fn fingerprints_match_between_account_and_auth_json() {
        let account = sample_chatgpt_account();
        let auth_json = create_auth_json(&account).expect("create auth json");
        let account_fp = account_fingerprint(&account).expect("account fingerprint");
        let auth_fp = auth_fingerprint(&auth_json).expect("auth fingerprint");
        assert_eq!(account_fp, auth_fp);
    }

    #[test]
    fn inspect_workspace_auth_reports_missing_file() {
        let _guard = env_lock().lock().expect("lock env");
        let base = std::env::temp_dir().join(format!(
            "codex-switcher-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        std::env::set_var("CODEX_HOME", &base);

        let state = inspect_workspace_auth(&[], None);
        assert_eq!(state.status, WorkspaceAuthStatus::Missing);
        assert!(!state.exists);

        std::env::remove_var("CODEX_HOME");
    }
}
