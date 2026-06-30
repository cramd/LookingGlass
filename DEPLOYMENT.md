# LookingGlass — Deployment Guide

This guide wires LookingGlass to a **local VictoriaMetrics** instance deployed on your Proxmox server via **ShiftMon**.

---

## Overview

```
┌─────────────────────────────────────────────────────────┐
│  Proxmox VE Server                                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ShiftMon stack (Docker)                        │   │
│  │                                                 │   │
│  │  VictoriaMetrics :8428 ◄── InfluxDB push        │   │
│  │  vmauth          :8427 ◄── LookingGlass API   │   │
│  │  Grafana         :3001                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Proxmox PVE ──► Metric Server (InfluxDB) ──► VM :8089  │
└─────────────────────────────────────────────────────────┘
          │
          │  HTTP (vmauth token)
          ▼
┌──────────────────────────────┐
│  LookingGlass (your Mac    │
│  or any Docker host)         │
│                              │
│  backend  :5001              │
│  frontend :3000              │
└──────────────────────────────┘
```

---

## Part 1 — Deploy ShiftMon on Proxmox

ShiftMon is an Ansible collection. You run it **from your Mac** and it configures the Proxmox server over SSH.

### 1.1 Prerequisites (on your Mac)

```bash
# Install Ansible
brew install ansible

# Install the ShiftMon collection from Ansible Galaxy
ansible-galaxy collection install shiftsystems.shift_mon

# Install the just task runner (optional but recommended)
brew install just
```

### 1.2 Clone the ShiftMon repo

```bash
git clone https://gitlab.com/shiftsystems/shiftmon.git
cd shiftmon
```

### 1.3 Create your inventory

Create `inventory/hosts.yml` pointing at your Proxmox server:

```yaml
all:
  children:
    shiftmon:
      hosts:
        monitoring:
          ansible_host: 192.168.1.50   # ← your Proxmox IP
          ansible_user: root
```

### 1.4 Create your variables file

Create `inventory/group_vars/all.yml`:

```yaml
# Where ShiftMon will store persistent data on the server
shiftmon_data_dir: /opt/shiftmon

# Set a strong password — this becomes your vmauth token
shiftmon_vmauth_password: "change_me_to_something_strong"

# Enable Proxmox instrumentation
shiftmon_proxmox_enabled: true
shiftmon_proxmox_hosts:
  - host: 192.168.1.50   # ← your Proxmox IP or hostname
    port: 8006

# Grafana admin credentials
shiftmon_grafana_admin_user: admin
shiftmon_grafana_admin_password: "change_me_too"
```

### 1.5 Run the playbook

```bash
# Full stack deploy (VictoriaMetrics + vmauth + Grafana + Telegraf)
ansible-playbook -i inventory/hosts.yml shiftmon.yml

# Or if using just:
INVENTORY=inventory/hosts.yml just shiftmon
```

This takes 5–10 minutes. When done, ShiftMon will have:
- VictoriaMetrics running on `http://PROXMOX_IP:8428` (internal)
- **vmauth** running on `http://PROXMOX_IP:8427` (your query endpoint)
- Grafana on `http://PROXMOX_IP:3001`

---

## Part 2 — Configure Proxmox to Push Metrics

Proxmox PVE has a built-in metrics push feature. No agent needed.

1. Log into Proxmox web UI as root
2. Go to **Datacenter → Metric Server → Add → InfluxDB**
3. Fill in:

| Field        | Value                                |
|-------------|--------------------------------------|
| Name         | `shiftmon`                           |
| Server       | `127.0.0.1` (or the ShiftMon host IP) |
| Port         | `8089`                               |
| Protocol     | `HTTP`                               |
| Organization | *(leave blank)*                      |
| Bucket       | *(leave blank)*                      |
| Token        | *(leave blank if no vmauth on write path)* |

4. Click **Create** and then **Enable**

> **Verify:** SSH into the Proxmox host and run:
> ```bash
> curl "http://localhost:8428/api/v1/query?query=system_uptime{object=\"nodes\"}"
> ```
> You should see one result per PVE node.

---

## Part 3 — Configure and Run LookingGlass

### 3.1 Get your vmauth token

After ShiftMon deploys, find the token on the Proxmox host:

```bash
grep password /opt/shiftmon/vmauth/vmauth.yml | head -5
```

Or use the password you set in `shiftmon_vmauth_password`.

### 3.2 Create your `.env` file

```bash
cd /path/to/LookingGlass
cp .env.example .env
```

Edit `.env`:

```env
VM_CLOUD_URL=http://192.168.0.100:8427
VM_CLOUD_TOKEN=your_shiftmon_vmauth_password
SAAS_USER_TIER=free
PORT=5000
```

### 3.3 Run in production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Then open `http://localhost:3000` — you should see live CPU/memory data from your Proxmox nodes.

### 3.4 Run in dev mode (with hot reload)

```bash
docker compose up -d
```

---

## Troubleshooting

### No data / "Using simulated dummy metrics"

- Check that the backend can reach vmauth: `curl -H "Authorization: Bearer YOUR_TOKEN" http://PROXMOX_IP:8427/api/v1/query?query=up`
- Verify Proxmox is pushing metrics: `curl "http://PROXMOX_IP:8428/api/v1/series?match[]=system_uptime"`
- Make sure the InfluxDB Metric Server is **enabled** in Proxmox

### Metrics show "unknown-host"

- Proxmox PVE tags metrics with `host=` equal to the node name
- Check `series.metric` labels: `curl "http://PROXMOX_IP:8428/api/v1/series?match[]=system_uptime{object=\"nodes\"}"` and look at what label contains the hostname

### vmauth 401 Unauthorized

- Token in `.env` must match `shiftmon_vmauth_password` exactly
- Re-check `/opt/shiftmon/vmauth/vmauth.yml` for the correct value

### Frontend can't reach backend

- In dev mode, `NEXT_PUBLIC_API_URL` defaults to `http://localhost:5001`
- In production on a remote server, set `NEXT_PUBLIC_API_URL=http://SERVER_IP:5001` in `.env` and rebuild

---

## Proxmox Metric Labels Reference

The backend queries use these MetricsQL expressions against PVE data:

| Metric                             | Meaning                          |
|------------------------------------|----------------------------------|
| `system_uptime{object="nodes"}`    | Node uptime in seconds           |
| `100 - cpustat_idle{object="nodes"}` | CPU usage %                    |
| `mem_used{object="nodes"} / mem_total{object="nodes"} * 100` | Memory usage % |

> Note: PBS (Proxmox Backup Server) uses `object="host"` instead of `object="nodes"`.
> To support PBS nodes, duplicate the queries with that label filter.
