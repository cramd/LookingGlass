export interface Guest {
  id: string;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  cpu: number;
  memory: number;
  running: boolean;
}

export interface Environment {
  id: string;
  name: string;
  color: string;   // tailwind color name e.g. "indigo", "emerald", "amber"
  hostnames: string[];
  guests?: string[];
}

const STORAGE_KEY = 'lookingglass.environments';

const COLOR_OPTIONS = ['indigo', 'emerald', 'amber', 'sky', 'rose', 'violet'] as const;
export type EnvColor = typeof COLOR_OPTIONS[number];

export const ENV_COLOR_OPTIONS = COLOR_OPTIONS;

// tailwind bg/border/text classes keyed by color name
export const ENV_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  indigo:  { bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  text: 'text-indigo-300',  dot: 'bg-indigo-400' },
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-300',   dot: 'bg-amber-400'  },
  sky:     { bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     text: 'text-sky-300',     dot: 'bg-sky-400'    },
  rose:    { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-300',    dot: 'bg-rose-400'   },
  violet:  { bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  text: 'text-violet-300',  dot: 'bg-violet-400' },
};

export function loadEnvironments(): Environment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Environment[]) : [];
  } catch {
    return [];
  }
}

export function saveEnvironments(envs: Environment[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envs));
}

export function createEnvironment(name: string, color: string, hostnames: string[], guests: string[] = []): Environment {
  return {
    id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    color,
    hostnames,
    guests,
  };
}

/** Return true if a hostname belongs to the given environment (or env is "all"). */
export function hostnameInEnv(hostname: string, env: Environment | null): boolean {
  if (!env) return true;
  return env.hostnames.includes(hostname);
}

/** Filter a list of hostnames to those in the given environment. */
export function filterHosts(hosts: string[], env: Environment | null): string[] {
  if (!env) return hosts;
  const filtered = hosts.filter(h => env.hostnames.includes(h));
  // If the environment hostnames don't match any discovered hosts (e.g. name mismatch),
  // fall back to showing all hosts rather than showing nothing.
  return filtered.length > 0 ? filtered : hosts;
}

/** Filter a list of guests to those explicitly assigned to the environment. */
export function filterGuests(guests: Guest[], env: Environment | null): Guest[] {
  if (!env) return guests;
  // If `guests` array is undefined or empty (created before this feature, or no
  // guests explicitly assigned), default to returning all guests on the env's nodes.
  if (!env.guests || env.guests.length === 0) {
    return guests;
  }
  return guests.filter(g => env.guests!.includes(g.id));
}
