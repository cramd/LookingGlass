# Looking Glass

ProxMox Olly

A self-hosted observability dashboard for [Proxmox VE](https://www.proxmox.com/) clusters, built on top of the [ShiftMon](https://gitlab.com/shiftsystems/shiftmon) stack.

Looking Glass gives you a clean, real-time view of your homelab or small-business infrastructure — node CPU/memory, VM and LXC guest health, live system logs, alert management, and storage usage — without the noise of raw Grafana dashboards.

---

## What it does

| Feature | Details |
|---------|---------|
| **Cluster overview** | CPU, memory, and uptime charts per PVE node with selectable time ranges |
| **Guest list** | All VMs and LXCs with current CPU/memory and disk I/O drilldown |
| **App logs** | Live-streaming syslog from Telegraf/VictoriaLogs with keyword search and level filtering |
| **Alerts** | Active and pending vmalert rules; one-click Alertmanager silencing |
| **Usage & storage** | Live active time series count, metrics disk, and logs disk from VictoriaMetrics/VictoriaLogs |
| **Environments** | Logical node groups (Production / Staging / Lab) that filter every view |
| **Platform links** | Deep links into Grafana dashboards, VMUI, and VictoriaLogs UI |

---

## Architecture

```
Proxmox VE hosts
  │
  ├── InfluxDB push (port 8089) ──► VictoriaMetrics :8428
  └── Telegraf syslog  ──────────► VictoriaLogs    :9428

ShiftMon LXC (192.168.0.x)
  ├── VictoriaMetrics :8428
  ├── VictoriaLogs    :9428
  ├── vmalert         :8880
  ├── Alertmanager    :9093
  └── Grafana         :3001

Looking Glass (your Mac or Docker host)
  ├── backend  :5000  (Node.js / Express — proxies all VM/VL calls)
  └── frontend :3000  (Next.js 15 / React / Tailwind)
```

---

## Prerequisites

- A running [ShiftMon](https://gitlab.com/shiftsystems/shiftmon) stack with VictoriaMetrics, VictoriaLogs, vmalert, Alertmanager, and Grafana (see `DEPLOYMENT.md` for the full ShiftMon setup guide)
- Proxmox VE configured to push metrics via **Datacenter → Metric Server → InfluxDB** (port `8089`)
- Docker + Docker Compose, **or** Node.js ≥ 18 for local dev

---

## Quick start

### 1. Clone and configure

```bash
git clone <this-repo>
cd LookingGlass
cp .env.example .env
```

Edit `.env` with your actual values:

```env
VM_CLOUD_URL=http://192.168.0.100:8428   # VictoriaMetrics (or vmauth :8427)
VM_DIRECT_URL=http://192.168.0.100:8428  # VM admin endpoint for tsdb/metrics
VM_CLOUD_TOKEN=                          # Bearer token (leave blank if no vmauth)

VICTORIALOGS_URL=http://192.168.0.100:9428
VMALERT_URL=http://192.168.0.100:8880
ALERTMANAGER_URL=http://192.168.0.100:9093

GRAFANA_URL=http://192.168.0.100:3001
SAAS_USER_TIER=free                      # free | pro | enterprise
PORT=5000
```

### 2. Run (Docker — recommended)

```bash
# Development mode (hot reload)
docker compose up -d

# Production build
docker compose -f docker-compose.prod.yml up -d --build
```

Open **http://localhost:3000**.

### 3. Run (local dev, no Docker)

```bash
# Backend
cd backend
npm install
npm run dev        # listens on :5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # listens on :3000
```

---

## Environment variables

### Backend (`.env` in project root)

| Variable | Default | Description |
|----------|---------|-------------|
| `VM_CLOUD_URL` | — | VictoriaMetrics / vmauth query endpoint |
| `VM_DIRECT_URL` | ← `VM_CLOUD_URL` | Admin endpoint for `/api/v1/status/tsdb` and `/metrics` |
| `VM_CLOUD_TOKEN` | *(blank)* | Bearer token for vmauth |
| `VICTORIALOGS_URL` | `http://192.168.0.100:9428` | VictoriaLogs query endpoint |
| `VMALERT_URL` | `http://192.168.0.100:8880` | vmalert alerts endpoint |
| `ALERTMANAGER_URL` | `http://192.168.0.100:9093` | Alertmanager silence API |
| `GRAFANA_URL` | `http://192.168.0.100:3001` | Grafana base URL (used by Platform links) |
| `SAAS_USER_TIER` | `free` | Tier limits: `free` / `pro` / `enterprise` |
| `PORT` | `5000` | Backend listen port |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Backend URL (must be reachable from the browser) |
| `NEXT_PUBLIC_GRAFANA_URL` | `http://192.168.0.100:3001` | Grafana deep-link base |
| `NEXT_PUBLIC_VM_DIRECT_URL` | `http://192.168.0.100:8428` | VMUI deep-link base |
| `NEXT_PUBLIC_VICTORIALOGS_URL` | `http://192.168.0.100:9428` | VictoriaLogs UI deep-link base |

---

## Tier limits

| Tier | Max series | Max nodes | Retention |
|------|-----------|-----------|-----------|
| `free` | 10,000 | 2 | 7 days |
| `pro` | 100,000 | 10 | 30 days |
| `enterprise` | unlimited | unlimited | 90 days |

Change the active tier with `SAAS_USER_TIER` in `.env`. The UpsellHook widget shows a live warning when you approach the series cap.

---

## Environments

Environments are logical node groups you define in the UI (Sidebar → **Environments**). Create a group, assign PVE node hostnames, and select it from the sidebar footer. Every view — Dashboard, Logs, and Alerts — will filter to only that group's nodes. Environments are stored in `localStorage` and persist across browser sessions.

---

## Project layout

```
LookingGlass/
├── backend/
│   └── src/
│       ├── index.ts          # Express API — metrics, logs, alerts, usage endpoints
│       └── tierConfig.ts     # Tier limits config
├── frontend/
│   └── src/
│       ├── app/page.tsx      # Root page + global EnvContext
│       ├── components/
│       │   ├── Dashboard.tsx         # Cluster overview
│       │   ├── LogsPage.tsx          # Live log stream
│       │   ├── AlertsPage.tsx        # Active alerts + silencing
│       │   ├── EnvironmentsPage.tsx  # Environment CRUD
│       │   ├── UpsellHook.tsx        # Live usage / storage widget
│       │   ├── PlatformLinks.tsx     # Grafana / VMUI deep links
│       │   ├── GuestList.tsx         # VM / LXC guest list
│       │   ├── MetricsChart.tsx      # CPU / memory chart
│       │   ├── AlertBanner.tsx       # Collapsible top alert bar
│       │   └── Sidebar.tsx           # Navigation + env selector
│       └── lib/
│           └── environments.ts       # localStorage helpers
├── victoriametrics-lxc/
│   ├── docker-compose.yml    # ShiftMon stack (VM, VL, vmalert, AM, Grafana)
│   ├── alerts.yml            # vmalert rules
│   └── alertmanager.yml      # Alertmanager routing
├── shiftmon-config/
│   ├── TELEGRAF-PVE.md       # Telegraf + rsyslog setup guide for PVE hosts
│   ├── fix-rsyslog.yml       # Ansible playbook to fix rsyslog omfwd errors
│   └── files/50-shiftmon.conf
├── DEPLOYMENT.md             # Full ShiftMon + Looking Glass setup walkthrough
├── .env.example
└── docker-compose.yml        # Dev compose (hot reload)
```

---

## Troubleshooting

**"Using simulated dummy metrics"** — `VM_CLOUD_URL` is not set or unreachable. Check that VictoriaMetrics is running and the URL in `.env` is correct.

**Series count shows 0** — `VM_DIRECT_URL` can't reach `/api/v1/status/tsdb`. Confirm the VM endpoint is accessible from the backend container/process.

**No logs showing** — Telegraf must be deployed on each PVE host and rsyslog must be forwarding to it. See `shiftmon-config/TELEGRAF-PVE.md`.

**Alerts page empty** — vmalert and Alertmanager must be running. Verify `VMALERT_URL` and `ALERTMANAGER_URL` are reachable.

**Environments not saving** — Environments are stored in browser `localStorage`. They won't persist across different browsers or private/incognito sessions.

---

## Related projects

- [ShiftMon](https://gitlab.com/shiftsystems/shiftmon) — Ansible-based monitoring stack (VictoriaMetrics + Grafana + Telegraf)
- [VictoriaMetrics](https://victoriametrics.com/) — Time-series database
- [VictoriaLogs](https://docs.victoriametrics.com/victorialogs/) — Log storage and querying
