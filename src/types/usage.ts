export interface DailyUsage {
  date: string;
  totalTokens: number;
  totalCost: number;
  models: {
    [key: string]: {
      tokens: number;
      cost: number;
    };
  };
}

/**
 * Real-time utilization data from Claude's OAuth API
 * This is the source of truth for rate limits
 */
export interface OAuthUtilization {
  fiveHour: {
    utilization: number; // Percentage used (0-100)
    resetsAt: string; // ISO timestamp
    formattedTimeRemaining: string; // e.g., "2h 30m"
  };
  sevenDay: {
    utilization: number; // Percentage used (0-100)
    resetsAt: string; // ISO timestamp
    formattedTimeRemaining: string; // e.g., "3d 5h"
  };
  sevenDaySonnet?: {
    utilization: number; // Sonnet-specific weekly limit (0-100)
  };
  sevenDayOpus?: {
    utilization: number; // Opus-specific weekly limit (0-100)
    resetsAt: string | null;
    formattedTimeRemaining: string;
  };
  extraUsage?: {
    isEnabled: boolean;
    monthlyLimit: number | null;
    usedCredits: number | null;
    utilization: number | null;
  };
  isAvailable: boolean;
}

/**
 * Simplified usage stats - only contains real data, no predictions
 */
export interface UsageStats {
  // Today's usage (from ccusage)
  today: DailyUsage;
  // Historical data
  thisWeek: DailyUsage[];
  // OAuth API data (real rate limits)
  oauthUtilization?: OAuthUtilization;
}

export interface UserConfiguration {
  menuBarCostSource: 'today' | 'sessionWindow';
  menuBarDisplayMode: 'both' | 'percentage' | 'cost';
  notificationThresholds: {
    warning: number; // percentage (default 70)
    critical: number; // percentage (default 90)
  };
}

export interface MenuBarData {
  percentageUsed: number;
  cost: number;
  status: 'safe' | 'warning' | 'critical';
  oauthUtilization?: OAuthUtilization;
}

// Legacy interfaces kept for compatibility during migration
export interface CCUsageBlock {
  id?: string;
  startTime: string;
  endTime?: string;
  actualEndTime?: string;
  isActive: boolean;
  isGap?: boolean;
  models?: string[];
  costUSD?: number;
  tokenCounts?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
}
