import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ClaudeUsageLimit {
  utilization: number; // Percentage of limit used (0-100)
  resets_at: string | null; // ISO timestamp when limit resets
}

export interface ClaudeUsageData {
  five_hour: ClaudeUsageLimit;
  seven_day: ClaudeUsageLimit;
  seven_day_sonnet?: ClaudeUsageLimit | null; // Sonnet-specific weekly usage
  seven_day_opus?: ClaudeUsageLimit | null; // Opus-specific weekly usage
  seven_day_oauth_apps?: ClaudeUsageLimit | null; // OAuth apps usage
  extra_usage?: {
    is_enabled: boolean;
    monthly_limit: number | null;
    used_credits: number | null;
    utilization: number | null;
  } | null;
}

export interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  };
}

export class ClaudeOAuthService {
  private static instance: ClaudeOAuthService;
  private cachedUsage: ClaudeUsageData | null = null;
  private lastFetch = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  static getInstance(): ClaudeOAuthService {
    if (!ClaudeOAuthService.instance) {
      ClaudeOAuthService.instance = new ClaudeOAuthService();
    }
    return ClaudeOAuthService.instance;
  }

  /**
   * Retrieve Claude Code OAuth access token from macOS Keychain
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null'
      );

      const credentials: ClaudeCredentials = JSON.parse(stdout.trim());

      if (credentials.claudeAiOauth?.accessToken) {
        return credentials.claudeAiOauth.accessToken;
      }

      console.error('No OAuth access token found in credentials');
      return null;
    } catch (error) {
      console.error('Failed to retrieve Claude Code credentials from Keychain:', error);
      return null;
    }
  }

  /**
   * Fetch usage limits from Claude's OAuth API
   */
  async getUsageData(): Promise<ClaudeUsageData | null> {
    const now = Date.now();

    // Return cached data if still fresh
    if (this.cachedUsage && now - this.lastFetch < this.CACHE_DURATION) {
      return this.cachedUsage;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return null;
    }

    try {
      const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'anthropic-beta': 'oauth-2025-04-20',
        },
      });

      if (!response.ok) {
        console.error(`OAuth usage API returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const data: ClaudeUsageData = await response.json();

      // Validate the response structure
      if (!data.five_hour || !data.seven_day) {
        console.error('Invalid usage data structure:', data);
        return null;
      }

      this.cachedUsage = data;
      this.lastFetch = now;

      return data;
    } catch (error) {
      console.error('Failed to fetch OAuth usage data:', error);
      return null;
    }
  }

  /**
   * Get 5-hour window utilization percentage
   */
  async getFiveHourUtilization(): Promise<{ utilization: number; resetsAt: Date } | null> {
    const data = await this.getUsageData();
    if (!data?.five_hour || !data.five_hour.resets_at) return null;

    return {
      utilization: data.five_hour.utilization,
      resetsAt: new Date(data.five_hour.resets_at),
    };
  }

  /**
   * Get 7-day window utilization percentage
   */
  async getSevenDayUtilization(): Promise<{ utilization: number; resetsAt: Date } | null> {
    const data = await this.getUsageData();
    if (!data?.seven_day || !data.seven_day.resets_at) return null;

    return {
      utilization: data.seven_day.utilization,
      resetsAt: new Date(data.seven_day.resets_at),
    };
  }

  /**
   * Format time remaining until reset
   */
  formatTimeUntilReset(resetsAt: Date): string {
    const now = new Date();
    const diff = resetsAt.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Resetting...';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  /**
   * Check if OAuth credentials are available
   */
  async hasCredentials(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  }

  /**
   * Clear cached data (useful when refreshing)
   */
  clearCache(): void {
    this.cachedUsage = null;
    this.lastFetch = 0;
  }
}
