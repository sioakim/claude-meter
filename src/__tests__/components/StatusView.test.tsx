import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusView } from '../../components/StatusView';
import type { UsageStats } from '../../types/usage';

describe('StatusView', () => {
  const mockStats: UsageStats = {
    today: {
      date: '2026-01-18',
      totalTokens: 32200000,
      totalCost: 23.11,
      models: {
        'claude-sonnet-4-5': {
          tokens: 30000000,
          cost: 21.5,
        },
        'claude-opus-4-5': {
          tokens: 2200000,
          cost: 1.61,
        },
      },
    },
    thisWeek: [
      {
        date: '2026-01-12',
        totalTokens: 5000000,
        totalCost: 3.5,
        models: {},
      },
      {
        date: '2026-01-13',
        totalTokens: 8000000,
        totalCost: 5.2,
        models: {},
      },
      {
        date: '2026-01-14',
        totalTokens: 6500000,
        totalCost: 4.1,
        models: {},
      },
      {
        date: '2026-01-15',
        totalTokens: 10000000,
        totalCost: 7.3,
        models: {},
      },
      {
        date: '2026-01-16',
        totalTokens: 9200000,
        totalCost: 6.8,
        models: {},
      },
      {
        date: '2026-01-17',
        totalTokens: 11000000,
        totalCost: 8.1,
        models: {},
      },
      {
        date: '2026-01-18',
        totalTokens: 32200000,
        totalCost: 23.11,
        models: {},
      },
    ],
    oauthUtilization: {
      fiveHour: {
        utilization: 15,
        resetsAt: '2026-01-18T17:00:00Z',
        formattedTimeRemaining: '3h 9m',
      },
      sevenDay: {
        utilization: 2,
        resetsAt: '2026-01-25T00:00:00Z',
        formattedTimeRemaining: '6d 22h',
      },
      sevenDaySonnet: {
        utilization: 0,
      },
      isAvailable: true,
    },
  };

  it('renders current limits section', () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('Current Limits')).toBeInTheDocument();
  });

  it('displays 5-hour utilization correctly', () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('5-Hour')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('resets in 3h 9m')).toBeInTheDocument();
  });

  it('displays weekly utilization correctly', () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('resets in 6d 22h')).toBeInTheDocument();
  });

  it('displays model-specific limits when available', () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('Model-Specific Weekly Limits')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows warning when OAuth data is unavailable', () => {
    const statsWithoutOAuth: UsageStats = {
      ...mockStats,
      oauthUtilization: {
        fiveHour: mockStats.oauthUtilization!.fiveHour,
        sevenDay: mockStats.oauthUtilization!.sevenDay,
        isAvailable: false,
      },
    };
    render(<StatusView stats={statsWithoutOAuth} />);
    expect(screen.getByText('OAuth data unavailable - connect Claude Code')).toBeInTheDocument();
  });

  it("displays today's usage section", () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText("Today's Usage")).toBeInTheDocument();
  });

  it("formats today's token count correctly", () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('32.2M')).toBeInTheDocument(); // 32200000 tokens formatted
  });

  it("formats today's cost correctly", () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('$23.11')).toBeInTheDocument();
  });

  it('displays model breakdown for today', () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('By Model')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-5')).toBeInTheDocument();
    expect(screen.getByText('claude-opus-4-5')).toBeInTheDocument();
  });

  it('displays this week section', () => {
    render(<StatusView stats={mockStats} />);
    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('calculates weekly totals correctly', () => {
    render(<StatusView stats={mockStats} />);
    // Total tokens: 5M + 8M + 6.5M + 10M + 9.2M + 11M + 32.2M = 81.9M
    expect(screen.getByText('81.9M')).toBeInTheDocument();
    // Total cost: 3.5 + 5.2 + 4.1 + 7.3 + 6.8 + 8.1 + 23.11 = 58.11
    expect(screen.getByText('$58.11')).toBeInTheDocument();
  });

  it('renders sparkline for weekly data', () => {
    const { container } = render(<StatusView stats={mockStats} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector('polyline')).toBeInTheDocument();
  });

  it('handles empty weekly data gracefully', () => {
    const statsWithEmptyWeek: UsageStats = {
      ...mockStats,
      thisWeek: [],
    };
    render(<StatusView stats={statsWithEmptyWeek} />);
    expect(screen.getByText('This Week')).toBeInTheDocument();
    // When weekly data is empty, totals should be 0
    // The component will render the sparkline section but with no data points
    // We just verify the section renders without crashing
  });
});
