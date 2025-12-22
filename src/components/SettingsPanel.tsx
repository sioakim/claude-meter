import type React from 'react';
import type { UserConfiguration } from '../types/usage';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface SettingsPanelProps {
  preferences: UserConfiguration;
  onUpdatePreferences: (preferences: Partial<UserConfiguration>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  const handlePreferenceChange = <K extends keyof UserConfiguration>(
    key: K,
    value: UserConfiguration[K]
  ) => {
    onUpdatePreferences({ [key]: value });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Menu Bar Display */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Menu Bar Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-sm text-neutral-400 block mb-2">Display Mode</span>
            <Select
              value={preferences.menuBarDisplayMode}
              onValueChange={(value: 'both' | 'percentage' | 'cost') =>
                handlePreferenceChange('menuBarDisplayMode', value)
              }
            >
              <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (45% · $2.35)</SelectItem>
                <SelectItem value="percentage">Percentage only (45%)</SelectItem>
                <SelectItem value="cost">Cost only ($2.35)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preferences.menuBarDisplayMode !== 'percentage' && (
            <div>
              <span className="text-sm text-neutral-400 block mb-2">Cost Source</span>
              <Select
                value={preferences.menuBarCostSource}
                onValueChange={(value: 'today' | 'sessionWindow') =>
                  handlePreferenceChange('menuBarCostSource', value)
                }
              >
                <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today's total</SelectItem>
                  <SelectItem value="sessionWindow">5-hour session window</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500 mt-1">
                Choose whether to show today's cost or the rolling 5-hour window cost
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="warning-threshold" className="text-sm text-neutral-400 block mb-2">
                Warning at
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="warning-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={preferences.notificationThresholds.warning}
                  onChange={(e) =>
                    handlePreferenceChange('notificationThresholds', {
                      ...preferences.notificationThresholds,
                      warning: Number.parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-neutral-400">%</span>
              </div>
            </div>
            <div>
              <label htmlFor="critical-threshold" className="text-sm text-neutral-400 block mb-2">
                Critical at
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="critical-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={preferences.notificationThresholds.critical}
                  onChange={(e) =>
                    handlePreferenceChange('notificationThresholds', {
                      ...preferences.notificationThresholds,
                      critical: Number.parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                />
                <span className="text-neutral-400">%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Receive notifications when usage reaches these thresholds
          </p>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardContent className="py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Data source</span>
              <span className="text-neutral-300">Claude OAuth API + ccusage</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Refresh interval</span>
              <span className="text-neutral-300">30 seconds</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
