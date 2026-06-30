# Deploy Telegraf on PVE Nodes

This deploys Telegraf to both PVE hosts so they ship logs to VictoriaLogs.

## Fix rsyslog "could not get addrinfo" errors

If you see `omfwd: could not get addrinfo for hostname '192.168.0.100:9428':'6666'`, the
`50-shiftmon.conf` on the PVE node has a broken duplicate forward. Apply the fix:

```bash
cd "/Users/marc/Desktop/Looking Glass/LookingGlass/shiftmon-config"
ansible-playbook -i inventory/pve-hosts.yml fix-rsyslog.yml
```

Or manually copy `files/50-shiftmon.conf` to `/etc/rsyslog.d/50-shiftmon.conf` on each PVE
host and `systemctl restart rsyslog`.

## Prerequisites

- ShiftMon repo cloned at `~/Desktop/shiftmon`
- SSH access to both PVE hosts (test: `ssh root@192.168.0.55 echo ok`)
- VictoriaLogs running on the LXC (`curl http://192.168.0.100:9428/health`)

## Steps

```bash
cd ~/Desktop/shiftmon

# Copy the PVE inventory
cp "/Users/marc/Desktop/Looking Glass/LookingGlass/shiftmon-config/inventory/pve-hosts.yml" ./inventory/
cp "/Users/marc/Desktop/Looking Glass/LookingGlass/shiftmon-config/inventory/group_vars/pve_nodes.yml" ./inventory/group_vars/

# Test connectivity to both PVE hosts
ansible -i inventory/pve-hosts.yml all -m ping

# Install Python deps on PVE hosts (Debian requirement)
ansible -i inventory/pve-hosts.yml all -m raw \
  -a "apt-get install -y python3 python3-apt gpg"

# Deploy Telegraf only (not the full ShiftMon stack)
ansible-playbook -i inventory/pve-hosts.yml ~/Desktop/shiftmon/telegraf.yml
```

## Verify logs are flowing

After ~60 seconds:

```bash
# Query VictoriaLogs for any PVE syslog entries
curl -s "http://192.168.0.100:9428/select/logsql/query?query=*&limit=5" | python3 -m json.tool
```
