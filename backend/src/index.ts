import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getTierLimits } from './tierConfig';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    tier: process.env.SAAS_USER_TIER || 'unknown',
    vmConfigured: !!process.env.VM_CLOUD_URL,
    logsConfigured: !!process.env.VICTORIALOGS_URL,
    alertsConfigured: !!process.env.VMALERT_URL,
  });
});

app.get('/api/v1/metrics/summary', async (req, res) => {
  try {
    const range = req.query.range || '1h';

    const vmUrl = process.env.VM_CLOUD_URL;
    const vmToken = process.env.VM_CLOUD_TOKEN;

    // Determine start/end times based on range
    const end = Math.floor(Date.now() / 1000);
    let start = end - 3600; // default 1h
    let step = '1m';
    if (range === '24h') {
      start = end - 86400;
      step = '1h';
    } else if (range === '7d') {
      start = end - 86400 * 7;
      step = '12h';
    }

    let hostMetrics: Record<string, { timestamp: string, cpu: number, memory: number, uptime: number }[]> = {};

    if (!vmUrl) {
      console.warn('VictoriaMetrics URL not configured. Using simulated dummy metrics.');
      
      // Fallback/Mock data for multiple Proxmox nodes
      const mockHosts = ['pve-node-1', 'pve-node-2', 'pve-node-3'];
      const now = Date.now();
      const points = range === '24h' ? 24 : range === '7d' ? 14 : 60;
      const stepMs = (end - start) * 1000 / points;
      
      mockHosts.forEach(host => {
        hostMetrics[host] = [];
        // Base CPU per host to simulate different loads
        const baseCpu = host === 'pve-node-1' ? 40 : host === 'pve-node-2' ? 20 : 70;
        for (let i = 0; i < points; i++) {
          hostMetrics[host].push({
            timestamp: new Date(now - (points - i) * stepMs).toISOString(),
            cpu: Math.max(0, Math.min(100, baseCpu + (Math.random() * 20 - 10))),
            memory: Math.random() * 30 + 40, // Mock 40-70% memory
            uptime: 1234567
          });
        }
      });
    } else {
      // Proxmox PVE node metrics — cpustat_cpu is a 0–1 fraction, memory in bytes
      const queries = {
        uptime:  'system_uptime{object="nodes"}',
        cpu:     'cpustat_cpu{object="nodes"} * 100',
        memory:  '(memory_memused{object="nodes"} / memory_memtotal{object="nodes"}) * 100'
      };

      const fetchMetric = async (query: string) => {
        const queryParams = new URLSearchParams({
          query: query,
          start: start.toString(),
          end: end.toString(),
          step: step
        });
        const headers: Record<string, string> = {};
        if (vmToken) headers['Authorization'] = `Bearer ${vmToken}`;
        const response = await fetch(`${vmUrl}/api/v1/query_range?${queryParams}`, { headers });
        if (!response.ok) {
          console.error(`VM query failed [${response.status}]: ${query}`);
          return null;
        }
        const data = await response.json();
        return data.data?.result || null;
      };

      const [uptimeResult, cpuResult, memoryResult] = await Promise.all([
        fetchMetric(queries.uptime),
        fetchMetric(queries.cpu),
        fetchMetric(queries.memory)
      ]);

      const mergeResults = (results: any[], key: string) => {
        if (!results) return;
        results.forEach((series: any) => {
          // PVE tags metrics with host= or nodename=; fall back to instance for scraped targets
          const host = series.metric.host || series.metric.nodename || series.metric.instance || 'unknown-host';
          if (!hostMetrics[host]) hostMetrics[host] = [];
          
          const metrics = hostMetrics[host];
          series.values.forEach((val: any) => {
            const ts = new Date(val[0] * 1000).toISOString();
            let point = metrics.find((p: any) => p.timestamp === ts);
            if (!point) {
              point = { timestamp: ts, cpu: 0, memory: 0, uptime: 0 };
              metrics.push(point);
            }
            (point as any)[key] = parseFloat(val[1]);
          });
        });
      };

      mergeResults(uptimeResult, 'uptime');
      mergeResults(cpuResult, 'cpu');
      mergeResults(memoryResult, 'memory');

      // Sort by timestamp
      Object.keys(hostMetrics).forEach(host => {
        hostMetrics[host]?.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });
    }

    const availableHosts = Object.keys(hostMetrics);

    const tier = process.env.SAAS_USER_TIER || 'free';
    const { maxSeries } = getTierLimits(tier);

    // Best-effort live series count; falls back to 0 on error
    let currentSeriesCount = 0;
    try {
      const vmDirect = process.env.VM_DIRECT_URL || process.env.VM_CLOUD_URL;
      if (vmDirect) {
        const tsdbRes = await fetch(`${vmDirect}/api/v1/status/tsdb`, { signal: AbortSignal.timeout(3000) });
        if (tsdbRes.ok) {
          const tsdb = await tsdbRes.json();
          currentSeriesCount = tsdb?.data?.totalSeries ?? 0;
        }
      }
    } catch { /* non-critical */ }

    res.json({
      data: hostMetrics,
      metadata: {
        hosts: availableHosts,
        currentSeriesCount,
        maxTierSeries: maxSeries ?? 0,
        tier,
        range: range
      }
    });
  } catch (error) {
    console.error('Metrics route error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Shared helper — reused by both routes
function buildFetcher(vmUrl: string, vmToken: string | undefined) {
  return async (query: string, instant = false) => {
    const endpoint = instant ? 'query' : 'query_range';
    const params: Record<string, string> = { query };
    if (!instant) {
      const now = Math.floor(Date.now() / 1000);
      params['start'] = String(now - 300);
      params['end'] = String(now);
      params['step'] = '60';
    } else {
      params['time'] = String(Math.floor(Date.now() / 1000));
    }
    const headers: Record<string, string> = {};
    if (vmToken) headers['Authorization'] = `Bearer ${vmToken}`;
    const response = await fetch(`${vmUrl}/api/v1/${endpoint}?${new URLSearchParams(params)}`, { headers });
    if (!response.ok) {
      console.error(`VM query failed [${response.status}]: ${query}`);
      return null;
    }
    const data = await response.json();
    return data.data?.result || null;
  };
}

interface GuestSnapshot {
  id: string;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  cpu: number;
  memory: number;
  running: boolean;
}

app.get('/api/v1/metrics/guests', async (req, res) => {
  try {
    const vmUrl = process.env.VM_CLOUD_URL;
    const vmToken = process.env.VM_CLOUD_TOKEN;

    if (!vmUrl) {
      // Mock guests for dev mode
      const mockGuests: GuestSnapshot[] = [
        { id: '100', name: 'ubuntu-dev', type: 'qemu', node: 'pve-node-1', cpu: 12.4, memory: 45.2, running: true },
        { id: '101', name: 'nginx-proxy', type: 'lxc',  node: 'pve-node-1', cpu: 2.1,  memory: 18.7, running: true },
        { id: '200', name: 'db-server',   type: 'qemu', node: 'pve-node-2', cpu: 55.3, memory: 72.1, running: true },
        { id: '201', name: 'monitoring',  type: 'lxc',  node: 'pve-node-2', cpu: 8.9,  memory: 31.4, running: true },
      ];
      return res.json({ guests: mockGuests });
    }

    const fetch = buildFetcher(vmUrl, vmToken);

    // Instant queries — current CPU and memory for all VMs and LXCs
    // system_cpu is 0–1 fraction of allocated vCPUs; system_mem/system_maxmem are bytes
    const [cpuQemu, cpuLxc, memQemu, memLxc] = await Promise.all([
      fetch('system_cpu{object="qemu"} * 100', true),
      fetch('system_cpu{object="lxc"}  * 100', true),
      fetch('(system_mem{object="qemu"} / system_maxmem{object="qemu"}) * 100', true),
      fetch('(system_mem{object="lxc"}  / system_maxmem{object="lxc"})  * 100', true),
    ]);

    const guests: Record<string, GuestSnapshot> = {};

    const upsert = (series: any, type: 'qemu' | 'lxc', field: 'cpu' | 'memory') => {
      if (!series) return;
      series.forEach((s: any) => {
        const m = s.metric;
        const rawId = m.vmid || m.id || 'unknown';
        const id = String(rawId).replace(/^(qemu|lxc)\//, '');
        const key = `${type}-${id}`;
        if (!guests[key]) {
          guests[key] = {
            id,
            // For guests: host= is the VM/LXC hostname; nodename= is the PVE node it runs on
            name: m.host || m.name || id,
            type,
            node: m.nodename || m.instance || 'unknown',
            cpu: 0,
            memory: 0,
            running: true,
          };
        }
        const value = parseFloat(Array.isArray(s.value) ? s.value[1] : '0');
        guests[key]![field] = isNaN(value) ? 0 : Math.round(value * 10) / 10;
      });
    };

    upsert(cpuQemu, 'qemu', 'cpu');
    upsert(cpuLxc,  'lxc',  'cpu');
    upsert(memQemu, 'qemu', 'memory');
    upsert(memLxc,  'lxc',  'memory');

    res.json({ guests: Object.values(guests) });
  } catch (error) {
    console.error('Guests route error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/v1/metrics/guest/:type/:id — disk I/O drilldown for a single VM or LXC
app.get('/api/v1/metrics/guest/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const vmUrl = process.env.VM_CLOUD_URL;
    const vmToken = process.env.VM_CLOUD_TOKEN;

    if (!type || !['qemu', 'lxc'].includes(type) || !id) {
      return res.status(400).json({ error: 'Invalid type or id' });
    }

    if (!vmUrl) {
      return res.json({
        diskReadBytesPerSec: Math.random() * 5_000_000,
        diskWriteBytesPerSec: Math.random() * 2_000_000,
        netInBytesPerSec: Math.random() * 1_000_000,
        netOutBytesPerSec: Math.random() * 500_000,
        uptime: 86400 + Math.floor(Math.random() * 604800),
      });
    }

    const fetchInstant = buildFetcher(vmUrl, vmToken);

    const selector = `object="${type}", vmid="${id}"`;
    const [rdRate, wrRate, netIn, netOut, uptime] = await Promise.all([
      fetchInstant(`rate(blockstat_rd_bytes{${selector}}[5m])`, true),
      fetchInstant(`rate(blockstat_wr_bytes{${selector}}[5m])`, true),
      fetchInstant(`rate(nics_netin{${selector}}[5m])`,         true),
      fetchInstant(`rate(nics_netout{${selector}}[5m])`,        true),
      fetchInstant(`system_uptime{${selector}}`,                true),
    ]);

    const firstVal = (result: any) => {
      if (!result || result.length === 0) return 0;
      const v = parseFloat(result[0]?.value?.[1] ?? '0');
      return isNaN(v) ? 0 : v;
    };

    res.json({
      diskReadBytesPerSec:  firstVal(rdRate),
      diskWriteBytesPerSec: firstVal(wrRate),
      netInBytesPerSec:     firstVal(netIn),
      netOutBytesPerSec:    firstVal(netOut),
      uptime:               firstVal(uptime),
    });
  } catch (error) {
    console.error('Guest detail route error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/v1/logs — query VictoriaLogs with optional filters
app.get('/api/v1/logs', async (req, res) => {
  try {
    const vlUrl   = process.env.VICTORIALOGS_URL || 'http://192.168.0.100:9428';
    const vmToken = process.env.VM_CLOUD_TOKEN;

    // Guest-panel params (legacy)
    const nodename = (req.query.nodename || req.query.host) as string | undefined;
    const vmid     = req.query.vmid     as string | undefined;
    // Logs-page params
    const host    = (req.query.host || nodename) as string | undefined;
    const appname = req.query.appname as string | undefined;
    const q       = req.query.q       as string | undefined;
    const startMs = req.query.start   as string | undefined;
    const endMs   = req.query.end     as string | undefined;
    const limit   = Math.min(parseInt(req.query.limit as string || '100', 10), 500);

    // Build LogsQL stream selector
    const parts: string[] = [];
    if (host)    parts.push(`tags.host="${host}"`);
    if (appname) parts.push(`tags.appname="${appname}"`);
    const streamFilter = parts.length ? `{${parts.join(', ')}}` : '*';

    // Append keyword and vmid filters
    let query = streamFilter;
    if (q)    query += ` _msg:"${q}"`;
    if (vmid) query += ` _msg:"${vmid}"`;

    const params = new URLSearchParams({ query, limit: String(limit) });
    if (startMs) params.set('start', new Date(Number(startMs)).toISOString());
    if (endMs)   params.set('end',   new Date(Number(endMs)).toISOString());

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (vmToken) headers['Authorization'] = `Bearer ${vmToken}`;

    const response = await fetch(`${vlUrl}/select/logsql/query?${params}`, { headers });

    if (!response.ok) {
      console.error(`VictoriaLogs query failed [${response.status}]`);
      return res.json({ logs: [] });
    }

    const text = await response.text();
    const logs = text.trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);

    res.json({ logs });
  } catch (error) {
    console.error('Logs route error:', error);
    res.json({ logs: [] });
  }
});

// GET /api/v1/alerts — active firing alerts from vmalert
app.get('/api/v1/alerts', async (req, res) => {
  try {
    const vmalertUrl = process.env.VMALERT_URL || 'http://192.168.0.100:8880';
    const headers: Record<string, string> = {};
    if (process.env.VM_CLOUD_TOKEN) headers['Authorization'] = `Bearer ${process.env.VM_CLOUD_TOKEN}`;

    const response = await fetch(`${vmalertUrl}/api/v1/alerts`, { headers });

    if (!response.ok) {
      console.error(`vmalert query failed [${response.status}]`);
      return res.json({ alerts: [] });
    }

    const data = await response.json();
    // vmalert returns { data: { alerts: [...] } }
    const allAlerts: any[] = data?.data?.alerts ?? [];
    // Return all states so the Alerts page can show pending/inactive too
    res.json({ alerts: allAlerts });
  } catch (error) {
    // vmalert not reachable yet — return empty rather than 500
    res.json({ alerts: [] });
  }
});

// GET /api/v1/alert-rules — all configured vmalert rule groups and rules
app.get('/api/v1/alert-rules', async (req, res) => {
  try {
    const vmalertUrl = process.env.VMALERT_URL || 'http://192.168.0.100:8880';
    const headers: Record<string, string> = {};
    if (process.env.VM_CLOUD_TOKEN) headers['Authorization'] = `Bearer ${process.env.VM_CLOUD_TOKEN}`;

    const response = await fetch(`${vmalertUrl}/api/v1/rules`, { headers });
    if (!response.ok) return res.json({ groups: [] });

    const data = await response.json();
    res.json(data?.data ?? { groups: [] });
  } catch {
    res.json({ groups: [] });
  }
});

// POST /api/v1/alerts/silence — create an alertmanager silence
app.post('/api/v1/alerts/silence', async (req, res) => {
  try {
    const amUrl = process.env.ALERTMANAGER_URL || 'http://192.168.0.100:9093';
    const { alertname, labels, durationMinutes = 60, comment = 'Silenced via LookingGlass' } = req.body;

    const now    = new Date();
    const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    // Build matchers — use provided labels or fall back to alertname only
    const matchers = labels
      ? Object.entries(labels).map(([name, value]) => ({ name, value: String(value), isRegex: false, isEqual: true }))
      : [{ name: 'alertname', value: alertname, isRegex: false, isEqual: true }];

    const payload = {
      matchers,
      startsAt: now.toISOString(),
      endsAt:   endsAt.toISOString(),
      createdBy: 'lookingglass',
      comment,
    };

    const response = await fetch(`${amUrl}/api/v2/silences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Alertmanager silence failed [${response.status}]: ${text}`);
      return res.status(502).json({ error: 'Failed to create silence' });
    }

    const result = await response.json();
    res.json({ silenceId: result.silenceID });
  } catch (error) {
    console.error('Silence route error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/v1/usage — live VictoriaMetrics + VictoriaLogs storage and series usage
app.get('/api/v1/usage', async (req, res) => {
  try {
    const vmDirect = process.env.VM_DIRECT_URL || process.env.VM_CLOUD_URL;
    const vlUrl    = process.env.VICTORIALOGS_URL || 'http://192.168.0.100:9428';
    const tier     = process.env.SAAS_USER_TIER || 'free';
    const limits   = getTierLimits(tier);

    // Parse a Prometheus text-format /metrics response into a flat key→value map.
    // Only handles unquoted gauge lines: `metric_name{...} value`.
    const parseMetrics = (text: string): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const line of text.split('\n')) {
        if (line.startsWith('#') || !line.trim()) continue;
        const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\{[^}]*\})?\s+([\d.eE+\-]+)/);
        if (m) {
          const key = m[1]!;
          const val = parseFloat(m[2]!);
          out[key] = (out[key] ?? 0) + val;
        }
      }
      return out;
    };

    let currentSeriesCount = 0;
    let metricsStorageBytes = 0;
    let metricsFreeDiskBytes: number | null = null;
    let logsStorageBytes = 0;
    let logsFreeDiskBytes: number | null = null;

    const opts = { signal: AbortSignal.timeout(4000) };

    await Promise.allSettled([
      // Series count from tsdb status
      (async () => {
        if (!vmDirect) return;
        const r = await fetch(`${vmDirect}/api/v1/status/tsdb`, opts);
        if (r.ok) {
          const d = await r.json();
          currentSeriesCount = d?.data?.totalSeries ?? 0;
        }
      })(),
      // VM storage metrics
      (async () => {
        if (!vmDirect) return;
        const r = await fetch(`${vmDirect}/metrics`, opts);
        if (r.ok) {
          const m = parseMetrics(await r.text());
          metricsStorageBytes = (m['vm_data_size_bytes'] ?? 0);
          metricsFreeDiskBytes = m['vm_free_disk_space_bytes'] ?? null;
        }
      })(),
      // VL storage metrics
      (async () => {
        const r = await fetch(`${vlUrl}/metrics`, opts);
        if (r.ok) {
          const m = parseMetrics(await r.text());
          logsStorageBytes = (m['vl_data_size_bytes'] ?? 0);
          logsFreeDiskBytes = m['vl_free_disk_space_bytes'] ?? null;
        }
      })(),
    ]);

    res.json({
      tier,
      currentSeriesCount,
      maxTierSeries: limits.maxSeries,
      maxNodes: limits.maxNodes,
      retentionDays: limits.retentionDays,
      seriesWarnThreshold: limits.seriesWarnThreshold,
      metricsStorageBytes,
      metricsFreeDiskBytes,
      logsStorageBytes,
      logsFreeDiskBytes,
    });
  } catch (error) {
    console.error('Usage route error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// In-process response cache — avoids re-querying Gemini for the same context within 10 minutes.
// Keyed by a stable hash of contextType + JSON-serialised payload.
const askCache = new Map<string, { answer: string; expiresAt: number }>();
const ASK_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashContext(contextType: string, payload: unknown): string {
  const raw = contextType + JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// POST /api/v1/ask-looking-glass — query Gemini with context for troubleshooting steps
app.post('/api/v1/ask-looking-glass', async (req, res) => {
  try {
    const { contextType, payload, message, history } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables.'
      });
    }

    // Clean up expired cache entries to prevent memory leaks
    for (const [key, val] of askCache.entries()) {
      if (val.expiresAt <= Date.now()) {
        askCache.delete(key);
      }
    }

    // Return cached initial answer if we have a fresh one for this exact context
    // Bypass cache if this is a follow-up chat message
    const cacheKey = hashContext(contextType, payload);
    const cached = askCache.get(cacheKey);
    if (!message && cached && cached.expiresAt > Date.now()) {
      return res.json({ answer: cached.answer, cached: true });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `You are "The Looking Glass", a friendly, highly intelligent AI troubleshooting assistant built for a Proxmox and VictoriaMetrics/Grafana cluster monitoring stack.
The user is viewing their server monitoring dashboard and needs help understanding a specific issue, log line, alert, or resource metric.

Your task is to analyze the provided context, propose potential root causes, and guide the user through a stepped troubleshooting process.

Crucial Instructions:
1. Reference Official Docs: For any issues involving VictoriaMetrics, VictoriaLogs, vmalert, or Alertmanager, structure your suggestions using patterns and best practices from the official documentation at https://docs.victoriametrics.com/.
2. Stepped, Educational Approach: Do NOT simply give the final answer or command to copy-paste. Instead, provide a logical, step-by-step checklist of investigations (e.g. "Step 1: Check if the service is running...", "Step 2: Inspect this log file..."). Force the user to inspect their cluster, think, and learn.
3. Strict Markdown: Format your output in clean, structured, and readable Markdown. Use code blocks for commands, bold highlights, and blockquotes for cautions. Keep sections concise.`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      systemInstruction: systemInstruction,
      generationConfig: {
        maxOutputTokens: 1024, // Control output costs
        temperature: 0.2,      // Ensure factual & logical troubleshooting instructions
      }
    });

    let userPrompt = '';
    if (contextType === 'alert') {
      userPrompt = `I received this active alert from vmalert/Alertmanager. Let's troubleshoot it step-by-step.
Alert Details:
${JSON.stringify(payload, null, 2)}`;
    } else if (contextType === 'log') {
      userPrompt = `I found this log line in the system logs. Let's analyze it and figure out the cause.
Log Content:
${JSON.stringify(payload, null, 2)}`;
    } else if (contextType === 'guest') {
      userPrompt = `I am looking at this VM/LXC container's resource usage. Let's analyze if there's an anomaly or issue.
Guest Stats:
${JSON.stringify(payload, null, 2)}`;
    } else {
      userPrompt = `Help me troubleshoot this server monitoring context:
${JSON.stringify(payload, null, 2)}`;
    }

    if (message && history) {
      // Map frontend history to Gemini's expected format
      const formattedHistory = history.map((msg: any) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));
      
      // Fix: Gemini chat history must start with a 'user' message. 
      // If the frontend history starts with the 'model' response, prepend the initial prompt context.
      if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        let initialPrompt = '';
        if (contextType === 'alert') {
          initialPrompt = `I received this active alert from vmalert/Alertmanager. Let's troubleshoot it step-by-step.\nAlert Details:\n${JSON.stringify(payload, null, 2)}`;
        } else if (contextType === 'log') {
          initialPrompt = `I found this log line in the system logs. Let's analyze it and figure out the cause.\nLog Content:\n${JSON.stringify(payload, null, 2)}`;
        } else if (contextType === 'guest') {
          initialPrompt = `I am looking at this VM/LXC container's resource usage. Let's analyze if there's an anomaly or issue.\nGuest Stats:\n${JSON.stringify(payload, null, 2)}`;
        } else {
          initialPrompt = `Help me troubleshoot this server monitoring context:\n${JSON.stringify(payload, null, 2)}`;
        }
        
        formattedHistory.unshift({
          role: 'user',
          parts: [{ text: initialPrompt }]
        });
      }
      
      const chat = model.startChat({ history: formattedHistory });
      const result = await chat.sendMessage(message);
      const response = await result.response;
      const text = response.text();
      
      return res.json({ answer: text });
    } else {
      const result = await model.generateContent(userPrompt);
      const response = await result.response;
      const text = response.text();

      // Cache the initial answer before returning
      askCache.set(cacheKey, { answer: text, expiresAt: Date.now() + ASK_CACHE_TTL_MS });

      res.json({ answer: text });
    }
  } catch (error: any) {
    console.error('Ask Looking Glass route error:', error);
    const msg: string = error.message || 'Internal Server Error';

    // Parse Gemini 429 rate-limit errors into friendly messages
    if (msg.includes('429') || msg.includes('Too Many Requests')) {
      const retryMatch = msg.match(/(\d+\.?\d*)s/);
      const retryIn = retryMatch ? Math.ceil(parseFloat(retryMatch[1] ?? '60')) : 60;
      const isDaily = msg.includes('PerDay');
      return res.status(429).json({
        error: isDaily
          ? `Daily quota reached for the Gemini free tier. This resets at midnight Pacific. Consider enabling billing on your Google Cloud project for uninterrupted access.`
          : `Rate limit reached. Please wait ${retryIn} seconds and try again.`,
        retryAfter: isDaily ? null : retryIn,
      });
    }

    res.status(500).json({ error: msg });
  }
});

app.listen(port, () => {
  console.log(`LookingGlass backend listening on port ${port}`);
});
