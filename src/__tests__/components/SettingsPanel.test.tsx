import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '../../components/SettingsPanel';
import type { UserConfiguration } from '../../types/usage';

describe('SettingsPanel', () => {
  const mockPreferences: UserConfiguration = {
    menuBarDisplayMode: 'both',
    menuBarCostSource: 'today',
    notificationThresholds: {
      warning: 70,
      critical: 90,
    },
  };

  const mockOnUpdatePreferences = vi.fn();

  beforeEach(() => {
    mockOnUpdatePreferences.mockClear();
  });

  it('renders menu bar display section', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Menu Bar Display')).toBeInTheDocument();
  });

  it('renders notifications section', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders about section with data source info', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Data source')).toBeInTheDocument();
    expect(screen.getByText('Claude OAuth API + ccusage')).toBeInTheDocument();
  });

  it('renders refresh interval info', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Refresh interval')).toBeInTheDocument();
    expect(screen.getByText('30 seconds')).toBeInTheDocument();
  });

  it('displays current warning threshold', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    const warningInput = screen.getByLabelText('Warning at') as HTMLInputElement;
    expect(warningInput.value).toBe('70');
  });

  it('displays current critical threshold', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    const criticalInput = screen.getByLabelText('Critical at') as HTMLInputElement;
    expect(criticalInput.value).toBe('90');
  });

  it('calls onUpdatePreferences when warning threshold changes', async () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);

    const warningInput = screen.getByLabelText('Warning at') as HTMLInputElement;

    // Simulate user changing the value
    fireEvent.change(warningInput, { target: { value: '75' } });

    expect(mockOnUpdatePreferences).toHaveBeenCalledWith({
      notificationThresholds: {
        warning: 75,
        critical: 90,
      },
    });
  });

  it('calls onUpdatePreferences when critical threshold changes', async () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);

    const criticalInput = screen.getByLabelText('Critical at') as HTMLInputElement;

    // Simulate user changing the value
    fireEvent.change(criticalInput, { target: { value: '95' } });

    expect(mockOnUpdatePreferences).toHaveBeenCalledWith({
      notificationThresholds: {
        warning: 70,
        critical: 95,
      },
    });
  });

  it('shows cost source selector when display mode is "both"', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Cost Source')).toBeInTheDocument();
  });

  it('shows cost source selector when display mode is "cost"', () => {
    const prefs = { ...mockPreferences, menuBarDisplayMode: 'cost' as const };
    render(<SettingsPanel preferences={prefs} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Cost Source')).toBeInTheDocument();
  });

  it('hides cost source selector when display mode is "percentage"', () => {
    const prefs = { ...mockPreferences, menuBarDisplayMode: 'percentage' as const };
    render(<SettingsPanel preferences={prefs} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.queryByText('Cost Source')).not.toBeInTheDocument();
  });

  it('enforces min/max values on threshold inputs', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);

    const warningInput = screen.getByLabelText('Warning at') as HTMLInputElement;
    expect(warningInput.min).toBe('0');
    expect(warningInput.max).toBe('100');
    expect(warningInput.type).toBe('number');

    const criticalInput = screen.getByLabelText('Critical at') as HTMLInputElement;
    expect(criticalInput.min).toBe('0');
    expect(criticalInput.max).toBe('100');
    expect(criticalInput.type).toBe('number');
  });

  it('handles invalid input gracefully by defaulting to 0', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);

    const warningInput = screen.getByLabelText('Warning at');
    await user.clear(warningInput);
    await user.type(warningInput, 'invalid');

    // When non-numeric input is parsed with parseInt, it returns NaN,
    // which gets coerced to 0 by the || 0 operator
    expect(mockOnUpdatePreferences).toHaveBeenCalledWith({
      notificationThresholds: {
        warning: 0,
        critical: 90,
      },
    });
  });

  it('displays notification threshold description', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText('Receive notifications when usage reaches these thresholds')).toBeInTheDocument();
  });

  it('displays cost source description', () => {
    render(<SettingsPanel preferences={mockPreferences} onUpdatePreferences={mockOnUpdatePreferences} />);
    expect(screen.getByText("Choose whether to show today's cost or the rolling 5-hour window cost")).toBeInTheDocument();
  });
});
