//! Process detection commands

use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use anyhow::Context;

#[cfg(windows)]
use std::collections::HashSet;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static PROCESS_CACHE: Mutex<Option<(Instant, CodexProcessInfo)>> = Mutex::new(None);
const PROCESS_CACHE_TTL: Duration = Duration::from_secs(3);

#[cfg(windows)]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "PascalCase")]
struct WindowsCodexProcess {
    name: String,
    process_id: u32,
    parent_process_id: u32,
    #[serde(default)]
    command_line: String,
    #[serde(default)]
    main_window_title: String,
}

/// Information about running Codex processes
#[derive(Debug, Clone, serde::Serialize)]
pub struct CodexProcessInfo {
    /// Number of active Codex processes, including CLI sessions.
    pub count: usize,
    /// Number of ignored background/stale Codex-related processes
    pub background_count: usize,
    /// Number of active Codex processes that should block switching.
    pub blocking_count: usize,
    /// Whether switching is allowed (no blocking Codex processes)
    pub can_switch: bool,
    /// Process IDs of active Codex processes
    pub pids: Vec<u32>,
}

#[derive(Debug, Default)]
struct DetectedCodexProcesses {
    active_pids: Vec<u32>,
    blocking_pids: Vec<u32>,
    background_count: usize,
}

/// Check for running Codex processes
#[tauri::command]
pub async fn check_codex_processes() -> Result<CodexProcessInfo, String> {
    {
        if let Ok(cache) = PROCESS_CACHE.lock() {
            if let Some((ts, info)) = cache.as_ref() {
                if ts.elapsed() < PROCESS_CACHE_TTL {
                    return Ok(info.clone());
                }
            }
        }
    }

    let detected = find_codex_processes().map_err(|e| e.to_string())?;
    let count = detected.active_pids.len();
    let blocking_count = detected.blocking_pids.len();

    let info = CodexProcessInfo {
        count,
        background_count: detected.background_count,
        blocking_count,
        can_switch: blocking_count == 0,
        pids: detected.active_pids,
    };

    if let Ok(mut cache) = PROCESS_CACHE.lock() {
        *cache = Some((Instant::now(), info.clone()));
    }

    Ok(info)
}

/// Find all running codex processes.
fn find_codex_processes() -> anyhow::Result<DetectedCodexProcesses> {
    #[cfg(unix)]
    {
        let mut pids = Vec::new();
        let mut bg_count = 0;

        // Use ps with custom format to get the pid and full command line
        let output = Command::new("ps").args(["-eo", "pid,command"]).output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                // Skip header
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                // The first part is PID, the rest is the command string
                if let Some((pid_str, command)) = line.split_once(' ') {
                    let command = command.trim();

                    // Get the executable path/name (first word of the command string before args)
                    let executable = command.split_whitespace().next().unwrap_or("");

                    // Check if the executable is exactly "codex" or ends with "/codex"
                    let is_codex = executable == "codex" || executable.ends_with("/codex");

                    // Exclude if it's running from an extension or IDE integration (like Antigravity)
                    // These are expected background processes we shouldn't block on
                    let is_ide_plugin = is_ide_plugin_process(command);

                    // Skip our own app
                    let is_switcher = command.contains("codex-switcher")
                        || command.contains("codex account switcher")
                        || command.contains("codex-account-switcher")
                        || command.contains("Codex Switcher")
                        || command.contains("Codex Account Switcher");

                    if is_codex && !is_switcher {
                        if let Ok(pid) = pid_str.trim().parse::<u32>() {
                            if pid != std::process::id() && !pids.contains(&pid) {
                                if is_ide_plugin {
                                    bg_count += 1;
                                } else {
                                    pids.push(pid);
                                }
                            }
                        }
                    }
                }
            }
        }

        return Ok(DetectedCodexProcesses {
            blocking_pids: pids.clone(),
            active_pids: pids,
            background_count: bg_count,
        });
    }

    #[cfg(windows)]
    {
        return find_windows_codex_processes();
    }

    #[allow(unreachable_code)]
    Ok(DetectedCodexProcesses::default())
}

#[cfg(windows)]
fn find_windows_codex_processes() -> anyhow::Result<DetectedCodexProcesses> {
    // tasklist counts every Electron helper (`--type=gpu-process`, crashpad, renderer, etc.),
    // which inflates the badge and incorrectly blocks switching. Use PowerShell so we can inspect
    // the command line and only count live top-level app instances plus CLI sessions.
    const POWERSHELL_SCRIPT: &str = r#"
$windowTitles = @{}
Get-Process -Name Codex -ErrorAction SilentlyContinue | ForEach-Object {
  $windowTitles[[uint32]$_.Id] = $_.MainWindowTitle
}

Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -ieq 'Codex.exe' -or
    $_.Name -ieq 'codex.exe' -or
    $_.Name -ieq 'node.exe' -or
    $_.Name -ieq 'bun.exe'
  } |
  ForEach-Object {
    [PSCustomObject]@{
      Name = $_.Name
      ProcessId = [uint32]$_.ProcessId
      ParentProcessId = [uint32]$_.ParentProcessId
      CommandLine = if ($_.CommandLine) { $_.CommandLine } else { '' }
      MainWindowTitle = if ($windowTitles.ContainsKey([uint32]$_.ProcessId)) {
        [string]$windowTitles[[uint32]$_.ProcessId]
      } else {
        ''
      }
    }
  } |
  ConvertTo-Json -Compress
"#;

    let output = Command::new("powershell.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            POWERSHELL_SCRIPT,
        ])
        .output()
        .context("failed to query Windows process list")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("PowerShell process query failed: {}", stderr.trim());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let processes = parse_windows_codex_processes(&stdout)?;

    Ok(classify_windows_codex_processes(&processes))
}

#[cfg(windows)]
fn parse_windows_codex_processes(stdout: &str) -> anyhow::Result<Vec<WindowsCodexProcess>> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let value: serde_json::Value =
        serde_json::from_str(trimmed).context("failed to parse Windows process JSON")?;

    match value {
        serde_json::Value::Array(values) => values
            .into_iter()
            .map(|value| {
                serde_json::from_value(value)
                    .context("failed to deserialize Windows Codex process entry")
            })
            .collect(),
        value => Ok(vec![serde_json::from_value(value)
            .context("failed to deserialize Windows Codex process entry")?]),
    }
}

#[cfg(windows)]
fn is_windows_codex_root_process(process: &WindowsCodexProcess) -> bool {
    let name = process.name.to_ascii_lowercase();
    let command = process.command_line.to_ascii_lowercase();

    name == "codex.exe"
        && !command.contains("codex-switcher")
        && !command.contains("codex-account-switcher")
        && !command.contains("--type=")
        && !command.contains("resources\\codex.exe")
}

#[cfg(windows)]
fn is_windows_codex_cli_process(process: &WindowsCodexProcess) -> bool {
    let name = process.name.to_ascii_lowercase();
    if name != "node.exe" && name != "bun.exe" {
        return false;
    }

    let command = process.command_line.to_ascii_lowercase();
    command.contains("@openai\\codex\\bin\\codex") || command.contains("@openai/codex/bin/codex")
}

#[cfg(any(unix, windows))]
fn is_ide_plugin_process(command: &str) -> bool {
    command.contains(".antigravity")
        || command.contains("openai.chatgpt")
        || command.contains(".vscode")
}

#[cfg(windows)]
fn classify_windows_codex_processes(processes: &[WindowsCodexProcess]) -> DetectedCodexProcesses {
    let mut active_pids = Vec::new();
    let mut blocking_pids = Vec::new();
    let mut ignored_count = 0;

    for process in processes {
        let command = process.command_line.to_ascii_lowercase();
        if is_ide_plugin_process(&command) {
            ignored_count += 1;
            continue;
        }

        if is_windows_codex_root_process(process) {
            let has_window = !process.main_window_title.trim().is_empty();
            let has_renderer =
                windows_has_descendant_matching(process.process_id, processes, |child| {
                    child
                        .command_line
                        .to_ascii_lowercase()
                        .contains("--type=renderer")
                });
            let has_app_server =
                windows_has_descendant_matching(process.process_id, processes, |child| {
                    let command = child.command_line.to_ascii_lowercase();
                    command.contains("resources\\codex.exe") && command.contains("app-server")
                });

            if has_window || has_renderer || has_app_server {
                active_pids.push(process.process_id);
                blocking_pids.push(process.process_id);
            } else {
                // Ignore stale helper trees left behind after the window has already closed.
                ignored_count += 1;
            }
            continue;
        }

        if is_windows_codex_cli_process(process) {
            active_pids.push(process.process_id);
        }
    }

    active_pids.sort_unstable();
    active_pids.dedup();
    blocking_pids.sort_unstable();
    blocking_pids.dedup();

    DetectedCodexProcesses {
        active_pids,
        blocking_pids,
        background_count: ignored_count,
    }
}

#[cfg(windows)]
fn windows_has_descendant_matching<F>(
    root_pid: u32,
    processes: &[WindowsCodexProcess],
    mut predicate: F,
) -> bool
where
    F: FnMut(&WindowsCodexProcess) -> bool,
{
    let mut queue = vec![root_pid];
    let mut visited = HashSet::new();

    while let Some(parent_pid) = queue.pop() {
        for process in processes
            .iter()
            .filter(|process| process.parent_process_id == parent_pid)
        {
            if !visited.insert(process.process_id) {
                continue;
            }

            if predicate(process) {
                return true;
            }

            queue.push(process.process_id);
        }
    }

    false
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    fn process(
        name: &str,
        process_id: u32,
        parent_process_id: u32,
        command_line: &str,
        main_window_title: &str,
    ) -> WindowsCodexProcess {
        WindowsCodexProcess {
            name: name.to_string(),
            process_id,
            parent_process_id,
            command_line: command_line.to_string(),
            main_window_title: main_window_title.to_string(),
        }
    }

    #[test]
    fn node_based_codex_cli_counts_as_active_without_blocking_switch() {
        let processes = vec![process(
            "node.exe",
            18208,
            7836,
            "\"D:\\Nodes\\25.7.0\\node.exe\" \"D:\\Nodes\\25.7.0\\node_modules\\@openai\\codex\\bin\\codex.js\"",
            "",
        )];

        let detected = classify_windows_codex_processes(&processes);

        assert_eq!(detected.active_pids, vec![18208]);
        assert!(detected.blocking_pids.is_empty());
        assert_eq!(detected.background_count, 0);
    }

    #[test]
    fn desktop_codex_window_counts_as_blocking() {
        let processes = vec![
            process(
                "Codex.exe",
                4200,
                100,
                "\"C:\\Program Files\\Codex\\Codex.exe\"",
                "Codex",
            ),
            process(
                "Codex.exe",
                4201,
                4200,
                "\"C:\\Program Files\\Codex\\resources\\codex.exe\" --type=renderer",
                "",
            ),
        ];

        let detected = classify_windows_codex_processes(&processes);

        assert_eq!(detected.active_pids, vec![4200]);
        assert_eq!(detected.blocking_pids, vec![4200]);
        assert_eq!(detected.background_count, 0);
    }
}
