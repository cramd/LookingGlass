#!/usr/bin/env bash
# Diagnostic: verify rsyslog forwarding config on PVE nodes. Writes NDJSON to debug log.
set -euo pipefail

LOG_PATH="/Users/marc/Desktop/Looking Glass/.cursor/debug-9ae772.log"
RUN_ID="${1:-pre-fix}"

python3 - "$LOG_PATH" "$RUN_ID" <<'PY'
import json, subprocess, time

LOG_PATH, RUN_ID = __import__("sys").argv[1:3]
SESSION_ID = "9ae772"
HOSTS = ["192.168.0.55", "192.168.0.90"]

def ssh(host, cmd):
    try:
        r = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no", f"root@{host}", cmd],
            capture_output=True, text=True, timeout=15,
        )
        return r.stdout.strip() if r.returncode == 0 else f"SSH_ERROR:{r.stderr.strip()}"
    except Exception as e:
        return f"SSH_ERROR:{e}"

def log(hypothesis_id, location, message, data):
    entry = {
        "sessionId": SESSION_ID,
        "runId": RUN_ID,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

for host in HOSTS:
    shiftmon = ssh(host, "cat /etc/rsyslog.d/50-shiftmon.conf 2>/dev/null || echo MISSING")
    telegraf = ssh(host, "cat /etc/rsyslog.d/50-telegraf.conf 2>/dev/null || echo MISSING")
    errors = ssh(host, 'journalctl -u rsyslog --since "2 min ago" --no-pager 2>/dev/null | grep -c "could not get addrinfo" || true')

    # #region agent log
    log("A", "verify-rsyslog.py:shiftmon", "50-shiftmon.conf checked", {
        "host": host,
        "hasBadTarget": "192.168.0.100:9428" in shiftmon,
        "hasOmFwd": "omfwd" in shiftmon,
        "confSnippet": shiftmon[:300],
    })
    log("B", "verify-rsyslog.py:telegraf", "50-telegraf.conf checked", {
        "host": host,
        "hasLocalTelegraf": "127.0.0.1:6667" in telegraf,
    })
    log("A", "verify-rsyslog.py:errors", "omfwd addrinfo errors last 2min", {
        "host": host,
        "errorCount": int(errors) if errors.isdigit() else -1,
    })
    # #endregion

print(f"Diagnostics written to {LOG_PATH} (runId={RUN_ID})")
PY
