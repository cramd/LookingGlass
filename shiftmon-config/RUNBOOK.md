# ShiftMon + LookingGlass — Home Lab Runbook

## Your setup
- 2 Proxmox VE hosts, clustered
- ShiftMon will run in an LXC on one of those hosts
- LookingGlass app runs on your Mac (or anywhere with Docker)

---

## STEP 0 — Fill in your IPs

Before anything else, replace the placeholder IPs in:
- `inventory/hosts.yml` → `ansible_host`
- `inventory/group_vars/all.yml` → `shiftmon_proxmox_hosts`

Also choose a **strong vmauth password** and **Grafana password** in `all.yml`.

---

## STEP 1 — Create the ShiftMon LXC on Proxmox

Run this on **PVE2** (SSH in or use the Proxmox Shell button in the UI):

### First — get your Mac's public key ready

On your Mac, print your public key so you can paste it in the next step:

```bash
cat ~/.ssh/id_ed25519.pub
# If that file doesn't exist, try:
cat ~/.ssh/id_rsa.pub
# If neither exists, generate one first:
ssh-keygen -t ed25519 -C "your@email.com"
cat ~/.ssh/id_ed25519.pub
```

Copy the entire output — it'll look like `ssh-ed25519 AAAA... your@email.com`.

### Then on PVE2 — create the LXC with your key baked in

```bash
# Download a Debian 12 template if you don't have one
pveam update
pveam download local debian-12-standard_12.7-1_amd64.tar.zst

# Save your public key to a temp file on the PVE host
# (paste your key from the step above between the quotes)
echo "ssh-ed25519 AAAA...your_public_key_here" > /tmp/shiftmon_key.pub

# Create the LXC — privileged required for Docker inside LXC
# Adjust storage pool if yours isn't "local-lvm" (check Proxmox UI → Storage)
pct create 200 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname shiftmon \
  --cores 2 \
  --memory 4096 \
  --swap 512 \
  --rootfs local-lvm:32 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.0.100/24,gw=192.168.0.1 \
  --nameserver 1.1.1.1 \
  --ssh-public-keys /tmp/shiftmon_key.pub \
  --unprivileged 0 \
  --features nesting=1 \
  --start 1

# Clean up the temp key file
rm /tmp/shiftmon_key.pub

# Verify it booted
pct status 200
```

> **Note:** `192.168.0.100` is your ShiftMon LXC IP — adjust if taken.
> Replace `192.168.0.1` with your actual gateway if different.
> Replace `local-lvm` with your storage pool name (check Proxmox UI → Storage).
> CT ID `200` can be any unused number.

The Debian template already has `openssh-server` installed and will automatically allow root login via the injected key — no extra config needed.

### Verify SSH from your Mac

```bash
ssh root@192.168.0.100 echo "SSH OK"
```

If that works, you're ready for Ansible.

---

## STEP 2 — Install Ansible on your Mac

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Ansible
brew install ansible

# Verify
ansible --version
```

---

## STEP 3 — Clone ShiftMon and drop in your config

```bash
cd ~/Desktop  # or wherever you want

git clone https://gitlab.com/shiftsystems/shiftmon.git
cd shiftmon

# Copy your pre-filled config from LookingGlass
cp -r "/Users/marc/Desktop/Looking Glass/LookingGlass/shiftmon-config/inventory" ./inventory

# Install the Ansible Galaxy collection
ansible-galaxy collection install shiftsystems.shift_mon

# Optional: install 'just' for the shortcut commands
brew install just
```

---

## STEP 4 — Run the ShiftMon playbook

```bash
cd ~/Desktop/shiftmon

# Test connectivity first
ansible -i inventory/hosts.yml all -m ping

# Deploy the full stack (takes ~5-10 min)
ansible-playbook -i inventory/hosts.yml shiftmon.yml

# Or with 'just':
INVENTORY=inventory/hosts.yml just shiftmon
```

When it finishes you'll have:
| Service          | URL                                    |
|-----------------|----------------------------------------|
| VictoriaMetrics  | `http://192.168.0.100:8428`   |
| vmauth (query)   | `http://192.168.0.100:8427`   |
| Grafana          | `http://192.168.0.100:3001`   |

---

## STEP 5 — Point both PVE nodes at VictoriaMetrics

Since your two PVE hosts are **clustered**, you only need to do this **once** in the shared Datacenter UI — it applies to all nodes.

1. Log in to Proxmox web UI
2. Click **Datacenter** (top of the left tree)
3. Go to **Metric Server** → **Add** → **InfluxDB**
4. Fill in:

| Field        | Value                               |
|-------------|-------------------------------------|
| Name         | `shiftmon`                          |
| Server       | `192.168.0.100`             |
| Port         | `8089`                              |
| Protocol     | `HTTP`                              |
| Organization | *(leave blank)*                     |
| Bucket       | *(leave blank)*                     |
| Token        | *(leave blank)*                     |

5. Click **Create** then make sure it shows **Enabled**

> Both PVE nodes will now start pushing CPU, memory, uptime, VM, and LXC metrics
> to VictoriaMetrics automatically every 60 seconds.

### Verify data is flowing (run from your Mac)

```bash
curl "http://192.168.0.100:8428/api/v1/query?query=system_uptime%7Bobject%3D%22nodes%22%7D"
```

You should see **2 results** — one per PVE node — with a `host` label for each.

---

## STEP 6 — Wire LookingGlass to ShiftMon

```bash
cd "/Users/marc/Desktop/Looking Glass/LookingGlass"

cp .env.example .env
```

Edit `.env`:

```env
VM_CLOUD_URL=http://192.168.0.100:8427
VM_CLOUD_TOKEN=CHANGE_ME_strong_password   # same value as shiftmon_vmauth_password in all.yml
SAAS_USER_TIER=free
PORT=5000
```

Then launch:

```bash
# Production build
docker compose -f docker-compose.prod.yml up -d --build

# Or dev mode with hot reload
docker compose up
```

Open **http://localhost:3000** — you should see both PVE nodes in the host dropdown with live metrics.

---

## STEP 7 — Verify each node is reporting

```bash
# List all hosts sending metrics
curl -s "http://192.168.0.100:8428/api/v1/series?match[]=system_uptime%7Bobject%3D%22nodes%22%7D" \
  | python3 -m json.tool | grep '"host"'
```

You should see an entry like `"host": "pve1"` and `"host": "pve2"` for each node.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ansible -m ping` fails | Check SSH key is copied, LXC is running, IP is correct in `hosts.yml` |
| Playbook fails on Docker install | Make sure LXC is **unprivileged=0** (privileged) with `nesting=1` |
| No metrics in curl verify | Check Metric Server is enabled in Proxmox UI; wait 60-90s after enabling |
| LookingGlass shows mock data | Check `.env` has correct `VM_CLOUD_URL`; test vmauth with `curl -H "Authorization: Bearer YOUR_TOKEN" http://IP:8427/api/v1/query?query=up` |
| Only 1 node shows in UI | Check cluster Metric Server is enabled at Datacenter level (not just one node) |
