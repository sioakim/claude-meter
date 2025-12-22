import type React from 'react';
import type { UsageStats } from '../types/usage';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

interface StatusViewProps {
  stats: UsageStats;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getStatusColor = (percentage: number): string => {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-amber-500';
  return 'bg-green-500';
};

// Simple sparkline component
const Sparkline: React.FC<{ data: number[]; className?: string }> = ({ data, className }) => {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const width = 200;
  const height = 40;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (value / max) * (height - 2 * padding);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
    </svg>
  );
};

export const StatusView: React.FC<StatusViewProps> = ({ stats }) => {
  const oauth = stats.oauthUtilization;
  const hasOAuth = oauth?.isAvailable;

  return (
    <div className="space-y-4 p-4">
      {/* Current Limits - OAuth API Data */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Current Limits</CardTitle>
          {!hasOAuth && (
            <p className="text-sm text-amber-400">OAuth data unavailable - connect Claude Code</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasOAuth ? (
            <>
              {/* 5-Hour and Weekly Limits */}
              <div className="grid grid-cols-2 gap-4">
                {/* 5-Hour Window */}
                <div className="space-y-2">
                  <p className="text-sm text-neutral-400">5-Hour</p>
                  <p className="text-2xl font-bold text-white">
                    {oauth.fiveHour.utilization.toFixed(0)}%
                  </p>
                  <Progress
                    value={oauth.fiveHour.utilization}
                    className={`h-3 ${getStatusColor(oauth.fiveHour.utilization)}`}
                  />
                  <p className="text-xs text-neutral-500">
                    resets in {oauth.fiveHour.formattedTimeRemaining}
                  </p>
                </div>

                {/* Weekly Limit */}
                <div className="space-y-2">
                  <p className="text-sm text-neutral-400">Weekly</p>
                  <p className="text-2xl font-bold text-white">
                    {oauth.sevenDay.utilization.toFixed(0)}%
                  </p>
                  <Progress
                    value={oauth.sevenDay.utilization}
                    className={`h-3 ${getStatusColor(oauth.sevenDay.utilization)}`}
                  />
                  <p className="text-xs text-neutral-500">
                    resets in {oauth.sevenDay.formattedTimeRemaining}
                  </p>
                </div>
              </div>

              {/* Model-Specific Limits */}
              {(oauth.sevenDaySonnet || oauth.sevenDayOpus) && (
                <div className="pt-2 border-t border-neutral-800">
                  <p className="text-xs text-neutral-500 mb-2">Model-Specific Weekly Limits</p>
                  <div className="grid grid-cols-2 gap-4">
                    {oauth.sevenDaySonnet && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Sonnet</span>
                        <span className="text-sm font-medium text-white">
                          {oauth.sevenDaySonnet.utilization.toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {oauth.sevenDayOpus && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Opus</span>
                        <span className="text-sm font-medium text-white">
                          {oauth.sevenDayOpus.utilization.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-neutral-500">
              <p>No OAuth data available</p>
              <p className="text-sm mt-2">Ensure Claude Code is authenticated</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Usage */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Today's Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-neutral-400">Tokens</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(stats.today.totalTokens)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Cost</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(stats.today.totalCost)}
              </p>
            </div>
          </div>

          {/* Model Breakdown */}
          {Object.keys(stats.today.models).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <p className="text-xs text-neutral-500">By Model</p>
              {Object.entries(stats.today.models).map(([model, data]) => {
                const percentage =
                  stats.today.totalTokens > 0 ? (data.tokens / stats.today.totalTokens) * 100 : 0;
                return (
                  <div key={model} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400 truncate max-w-[60%]">{model}</span>
                      <span className="text-white">
                        {formatNumber(data.tokens)} · {formatCurrency(data.cost)}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-1" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* This Week */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">This Week</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.thisWeek.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-neutral-400">Total Tokens</p>
                  <p className="text-xl font-bold text-white">
                    {formatNumber(stats.thisWeek.reduce((sum, d) => sum + d.totalTokens, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Total Cost</p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(stats.thisWeek.reduce((sum, d) => sum + d.totalCost, 0))}
                  </p>
                </div>
              </div>

              {/* Sparkline */}
              <div className="flex justify-center">
                <Sparkline
                  data={stats.thisWeek.map((d) => d.totalTokens)}
                  className="text-blue-400"
                />
              </div>

              {/* Daily breakdown labels */}
              <div className="flex justify-between text-xs text-neutral-500 mt-1">
                {stats.thisWeek.slice(0, 7).map((day) => (
                  <span key={day.date}>
                    {new Date(day.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center py-4 text-neutral-500">No data this week</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
