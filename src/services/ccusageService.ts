import { loadDailyUsageData, loadSessionBlockData } from 'ccusage/data-loader';
import type {
  DailyUsage,
  MenuBarData,
  OAuthUtilization,
  UsageStats,
  UserConfiguration,
} from '../types/usage.js';
import { ClaudeOAuthService } from './claudeOAuthService.js';

interface ModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

interface DailyDataEntry {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  modelBreakdowns: ModelBreakdown[];
}

interface SessionBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  isGap?: boolean;
  costUSD: number;
}

/**
 * Simplified CCUsageService - only fetches real data, no predictions
 */
export class CCUsageService {
  private static instance: CCUsageService;
  private cachedStats: UsageStats | null = null;
  private lastUpdate = 0;
  private readonly CACHE_DURATION = 3000; // 3 seconds
  private oauthService: ClaudeOAuthService;

  // User configuration
  private menuBarCostSource: 'today' | 'sessionWindow' = 'today';
  private sessionBlocks: SessionBlock[] = [];

  constructor() {
    this.oauthService = ClaudeOAuthService.getInstance();
  }

  static getInstance(): CCUsageService {
    if (!CCUsageService.instance) {
      CCUsageService.instance = new CCUsageService();
    }
    return CCUsageService.instance;
  }

  updateConfiguration(config: Partial<UserConfiguration>): void {
    if (config.menuBarCostSource !== undefined) {
      this.menuBarCostSource = config.menuBarCostSource;
    }
    // Clear cache to force refresh
    this.cachedStats = null;
  }

  async getUsageStats(): Promise<UsageStats> {
    const now = Date.now();

    // Return cached data if fresh
    if (this.cachedStats && now - this.lastUpdate < this.CACHE_DURATION) {
      return this.cachedStats;
    }

    try {
      // Fetch data in parallel
      const [blocks, dailyData, oauthData] = await Promise.all([
        loadSessionBlockData({
          sessionDurationHours: 5,
          mode: 'calculate',
        }),
        loadDailyUsageData({
          mode: 'calculate',
        }),
        this.oauthService.getUsageData(),
      ]);

      // Store blocks for session window cost calculation
      this.sessionBlocks = blocks || [];

      // Process daily data
      const processedDaily = this.processDailyData(dailyData || []);
      const todayStr = new Date().toISOString().split('T')[0];
      const today = processedDaily.find((d) => d.date === todayStr) || this.getEmptyDay();

      // Get last 7 days
      const thisWeek = processedDaily.filter((d) => {
        const date = new Date(d.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      });

      const stats: UsageStats = {
        today,
        thisWeek,
        oauthUtilization: oauthData ? this.formatOAuthData(oauthData) : undefined,
      };

      this.cachedStats = stats;
      this.lastUpdate = now;

      return stats;
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      return this.getEmptyStats();
    }
  }

  async getMenuBarData(): Promise<MenuBarData> {
    const stats = await this.getUsageStats();

    // Get percentage from OAuth (real data) or default to 0
    const percentageUsed = stats.oauthUtilization?.isAvailable
      ? stats.oauthUtilization.fiveHour.utilization
      : 0;

    // Get cost based on user preference
    let cost = stats.today.totalCost;
    if (this.menuBarCostSource === 'sessionWindow') {
      cost = this.getSessionWindowCost();
    }

    return {
      percentageUsed,
      cost,
      status: this.getStatus(percentageUsed),
      oauthUtilization: stats.oauthUtilization,
    };
  }

  private processDailyData(data: DailyDataEntry[]): DailyUsage[] {
    return data.map((day) => ({
      date: day.date,
      totalTokens:
        day.inputTokens + day.outputTokens + day.cacheCreationTokens + day.cacheReadTokens,
      totalCost: day.totalCost,
      models: day.modelBreakdowns
        .filter((mb) => mb.modelName !== '<synthetic>')
        .reduce(
          (acc, mb) => {
            acc[mb.modelName] = {
              tokens:
                mb.inputTokens + mb.outputTokens + mb.cacheCreationTokens + mb.cacheReadTokens,
              cost: mb.cost,
            };
            return acc;
          },
          {} as { [key: string]: { tokens: number; cost: number } }
        ),
    }));
  }

  private formatOAuthData(
    data: Awaited<ReturnType<ClaudeOAuthService['getUsageData']>>
  ): OAuthUtilization {
    if (!data) {
      return {
        fiveHour: { utilization: 0, resetsAt: '', formattedTimeRemaining: 'Unknown' },
        sevenDay: { utilization: 0, resetsAt: '', formattedTimeRemaining: 'Unknown' },
        isAvailable: false,
      };
    }

    const fiveHourResetDate = new Date(data.five_hour.resets_at || Date.now());
    const sevenDayResetDate = new Date(data.seven_day.resets_at || Date.now());

    const result: OAuthUtilization = {
      fiveHour: {
        utilization: data.five_hour.utilization,
        resetsAt: data.five_hour.resets_at || '',
        formattedTimeRemaining: this.oauthService.formatTimeUntilReset(fiveHourResetDate),
      },
      sevenDay: {
        utilization: data.seven_day.utilization,
        resetsAt: data.seven_day.resets_at || '',
        formattedTimeRemaining: this.oauthService.formatTimeUntilReset(sevenDayResetDate),
      },
      isAvailable: true,
    };

    // Add model-specific limits if available
    if (data.seven_day_sonnet) {
      result.sevenDaySonnet = {
        utilization: data.seven_day_sonnet.utilization,
      };
    }

    if (data.seven_day_opus && data.seven_day_opus.utilization > 0) {
      const opusResetDate = data.seven_day_opus.resets_at
        ? new Date(data.seven_day_opus.resets_at)
        : null;
      result.sevenDayOpus = {
        utilization: data.seven_day_opus.utilization,
        resetsAt: data.seven_day_opus.resets_at,
        formattedTimeRemaining: opusResetDate
          ? this.oauthService.formatTimeUntilReset(opusResetDate)
          : 'N/A',
      };
    }

    // Add extra usage info
    if (data.extra_usage) {
      result.extraUsage = {
        isEnabled: data.extra_usage.is_enabled,
        monthlyLimit: data.extra_usage.monthly_limit,
        usedCredits: data.extra_usage.used_credits,
        utilization: data.extra_usage.utilization,
      };
    }

    return result;
  }

  private getSessionWindowCost(): number {
    if (!this.sessionBlocks || this.sessionBlocks.length === 0) return 0;

    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    let total = 0;

    for (const block of this.sessionBlocks) {
      if (block.isGap) continue;
      if (block.startTime >= windowStart) {
        total += block.costUSD || 0;
      }
    }
    return total;
  }

  private getStatus(percentageUsed: number): 'safe' | 'warning' | 'critical' {
    if (percentageUsed >= 90) return 'critical';
    if (percentageUsed >= 70) return 'warning';
    return 'safe';
  }

  private getEmptyDay(): DailyUsage {
    return {
      date: new Date().toISOString().split('T')[0],
      totalTokens: 0,
      totalCost: 0,
      models: {},
    };
  }

  private getEmptyStats(): UsageStats {
    return {
      today: this.getEmptyDay(),
      thisWeek: [],
    };
  }
}
