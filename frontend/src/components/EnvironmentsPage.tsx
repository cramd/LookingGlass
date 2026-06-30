'use client';

import { getApiUrl } from '@/lib/config';
import React, { useEffect, useState } from 'react';
import {
  PlusCircle, Pencil, Trash2, Check, X, Layers, Box, Server
} from 'lucide-react';
import {
  Environment,
  loadEnvironments,
  saveEnvironments,
  createEnvironment,
  ENV_COLOR_OPTIONS,
  ENV_COLOR_CLASSES,
  Guest,
} from '@/lib/environments';
import { useEnv } from '@/app/page';

interface EnvironmentsPageProps {
  availableHosts: string[];
}

interface FormState {
  name: string;
  color: string;
  hostnames: string[];
  guests: string[];
}

const EMPTY_FORM: FormState = { name: '', color: 'indigo', hostnames: [], guests: [] };

function HostToggle({
  host,
  selected,
  onToggle,
}: {
  host: string;
  selected: boolean;
  onToggle: (h: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(host)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
        selected
          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
      }`}
    >
      {selected && <Check className="w-3 h-3" />}
      {host}
    </button>
  );
}

function GuestToggle({
  guest,
  selected,
  onToggle,
}: {
  guest: Guest;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const Icon = guest.type === 'qemu' ? Server : Box;
  return (
    <button
      onClick={() => onToggle(guest.id)}
      className={`flex items-center gap-2 px-2 py-1 rounded border text-xs transition-all ${
        selected
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
      }`}
      title={guest.name}
    >
      {selected && <Check className="w-3 h-3 shrink-0" />}
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate max-w-[120px]">{guest.name}</span>
    </button>
  );
}

function EnvForm({
  initial,
  availableHosts,
  onSave,
  onCancel,
}: {
  initial: FormState;
  availableHosts: string[];
  onSave: (f: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const { availableGuests } = useEnv();

  const toggleHost = (h: string) => {
    setForm(f => ({
      ...f,
      hostnames: f.hostnames.includes(h)
        ? f.hostnames.filter(x => x !== h)
        : [...f.hostnames, h],
    }));
  };

  const toggleGuest = (id: string) => {
    setForm(f => ({
      ...f,
      guests: f.guests.includes(id)
        ? f.guests.filter(x => x !== id)
        : [...f.guests, id],
    }));
  };

  // Group guests by their node for better display
  const guestsByNode = React.useMemo(() => {
    const grouped: Record<string, Guest[]> = {};
    availableGuests.forEach(g => {
      if (!grouped[g.node]) grouped[g.node] = [];
      grouped[g.node].push(g);
    });
    return grouped;
  }, [availableGuests]);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-5">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Production"
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">Color</label>
        <div className="flex gap-2">
          {ENV_COLOR_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-6 h-6 rounded-full transition-all ${ENV_COLOR_CLASSES[c]!.dot} ${
                form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'opacity-60 hover:opacity-100'
              }`}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Nodes */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">
          Assign nodes {availableHosts.length === 0 && <span className="text-zinc-600">(no nodes found)</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {availableHosts.length > 0
            ? availableHosts.map(h => (
                <HostToggle key={h} host={h} selected={form.hostnames.includes(h)} onToggle={toggleHost} />
              ))
            : (
              <p className="text-xs text-zinc-600 italic">
                Node list loads from the Dashboard. Make sure VictoriaMetrics is reachable.
              </p>
            )}
        </div>
      </div>

      {/* VMs and LXCs */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">
          Assign VMs & Containers
        </label>
        {Object.keys(guestsByNode).length > 0 ? (
          <div className="space-y-3">
            {Object.keys(guestsByNode).sort().map(nodeName => (
              <div key={nodeName} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">{nodeName}</p>
                <div className="flex flex-wrap gap-2">
                  {guestsByNode[nodeName].map(g => (
                    <GuestToggle 
                      key={g.id} 
                      guest={g} 
                      selected={form.guests.includes(g.id)} 
                      onToggle={toggleGuest} 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-600 italic">No guests found. (Ensure the Dashboard has loaded metrics first)</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function EnvironmentsPage({ availableHosts: propHosts }: EnvironmentsPageProps) {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { availableGuests, setAvailableGuests, availableHosts, setAvailableHosts } = useEnv();

  // Use context hosts if available, otherwise propHosts
  const activeHosts = availableHosts.length > 0 ? availableHosts : propHosts;

  useEffect(() => {
    setEnvs(loadEnvironments());
    
    const apiUrl = getApiUrl();
    
    // Fallback: If guests aren't loaded yet by the dashboard, fetch them directly
    if (availableGuests.length === 0) {
      fetch(`${apiUrl}/api/v1/metrics/guests`)
        .then(res => res.json())
        .then(json => {
          if (json.guests) setAvailableGuests(json.guests);
        })
        .catch(err => console.error('Failed to fetch guests fallback:', err));
    }

    // Fallback: If hosts aren't loaded yet by the dashboard, fetch them directly
    if (activeHosts.length === 0) {
      fetch(`${apiUrl}/api/v1/metrics/summary?range=1h`)
        .then(res => res.json())
        .then(json => {
          if (json.metadata?.hosts) setAvailableHosts(json.metadata.hosts);
        })
        .catch(err => console.error('Failed to fetch hosts fallback:', err));
    }
  }, [availableGuests.length, activeHosts.length, setAvailableGuests, setAvailableHosts]);

  const persist = (next: Environment[]) => {
    setEnvs(next);
    saveEnvironments(next);
  };

  const resolveHostnames = (f: FormState) => {
    const guestNodes = availableGuests
      .filter(g => f.guests.includes(g.id))
      .map(g => g.node);
    return Array.from(new Set([...f.hostnames, ...guestNodes]));
  };

  const handleCreate = (f: FormState) => {
    if (!f.name.trim()) return;
    const hostnames = resolveHostnames(f);
    persist([...envs, createEnvironment(f.name.trim(), f.color, hostnames, f.guests)]);
    setCreating(false);
  };

  const handleEdit = (id: string, f: FormState) => {
    if (!f.name.trim()) return;
    const hostnames = resolveHostnames(f);
    persist(envs.map(e => e.id === id ? { ...e, name: f.name.trim(), color: f.color, hostnames: hostnames, guests: f.guests } : e));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    persist(envs.filter(e => e.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center px-8 shrink-0">
        <Layers className="w-4 h-4 text-zinc-400 mr-2" />
        <span className="text-sm text-zinc-400">Environments</span>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full space-y-4">
        {/* Intro */}
        <div className="mb-2">
          <h2 className="text-xl font-bold text-zinc-50 mb-1">Environments</h2>
          <p className="text-sm text-zinc-500">
            Group your PVE nodes, VMs, and LXCs into logical environments. The selected environment filters the Dashboard, Logs, and Alerts views.
          </p>
        </div>

        {/* Existing environments */}
        {envs.length === 0 && !creating && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-sm">
            No environments yet. Create one to start grouping your nodes and guests.
          </div>
        )}

        {envs.map(env => {
          const colors = ENV_COLOR_CLASSES[env.color] ?? ENV_COLOR_CLASSES['indigo']!;
          if (editingId === env.id) {
            return (
              <EnvForm
                key={env.id}
                initial={{ name: env.name, color: env.color, hostnames: env.hostnames, guests: env.guests || [] }}
                availableHosts={activeHosts}
                onSave={f => handleEdit(env.id, f)}
                onCancel={() => setEditingId(null)}
              />
            );
          }
          return (
            <div
              key={env.id}
              className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${colors.bg} ${colors.border}`}
            >
              <div className={`w-3 h-3 rounded-full shrink-0 ${colors.dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${colors.text}`}>{env.name}</p>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <p className="text-xs text-zinc-500">
                    <span className="font-medium">Nodes:</span> {env.hostnames.length > 0 ? env.hostnames.join(', ') : <span className="italic">None</span>}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    <span className="font-medium">Guests:</span> {env.guests && env.guests.length > 0 ? `${env.guests.length} selected` : <span className="italic">None</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditingId(env.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(env.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {/* New environment form */}
        {creating ? (
          <EnvForm
            initial={EMPTY_FORM}
            availableHosts={activeHosts}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors py-2"
          >
            <PlusCircle className="w-4 h-4" />
            New environment
          </button>
        )}
      </div>
    </div>
  );
}
