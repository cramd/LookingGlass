export interface TierLimits {
  maxSeries: number | null;
  maxNodes: number | null;
  retentionDays: number;
  seriesWarnThreshold: number; // fraction e.g. 0.8
}

const TIERS: Record<string, TierLimits> = {
  free: {
    maxSeries: 10_000,
    maxNodes: 2,
    retentionDays: 7,
    seriesWarnThreshold: 0.8,
  },
  pro: {
    maxSeries: 100_000,
    maxNodes: 10,
    retentionDays: 30,
    seriesWarnThreshold: 0.8,
  },
  enterprise: {
    maxSeries: null,
    maxNodes: null,
    retentionDays: 90,
    seriesWarnThreshold: 0.9,
  },
};

export function getTierLimits(tier: string): TierLimits {
  return TIERS[tier.toLowerCase()] ?? TIERS['free']!;
}
