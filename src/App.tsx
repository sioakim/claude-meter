import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { NavigationTabs, type ViewType } from './components/NavigationTabs';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusView } from './components/StatusView';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import type { UsageStats, UserConfiguration } from './types/usage';

interface AppState {
  currentView: ViewType;
  stats: UsageStats | null;
  loading: boolean;
  error: string | null;
  preferences: UserConfiguration;
}

const defaultPreferences: UserConfiguration = {
  menuBarCostSource: 'today',
  menuBarDisplayMode: 'both',
  notificationThresholds: {
    warning: 70,
    critical: 90,
  },
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'status',
    stats: null,
    loading: true,
    error: null,
    preferences: defaultPreferences,
  });

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      if (!window.electronAPI) return;
      const settings = await window.electronAPI.loadSettings();
      setState((prev) => ({
        ...prev,
        preferences: { ...defaultPreferences, ...settings },
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Save settings
  const saveSettings = useCallback(async (newSettings: Partial<UserConfiguration>) => {
    try {
      if (!window.electronAPI) return;
      await window.electronAPI.saveSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, []);

  // Load usage stats
  const loadUsageStats = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      const data = await window.electronAPI.getUsageStats();
      setState((prev) => ({
        ...prev,
        stats: data,
        loading: false,
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage stats';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      if (!window.electronAPI) return;
      const data = await window.electronAPI.refreshData();
      setState((prev) => ({ ...prev, stats: data }));
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  }, []);

  // Update preferences
  const updatePreferences = useCallback(
    (newPreferences: Partial<UserConfiguration>) => {
      setState((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, ...newPreferences },
      }));
      saveSettings(newPreferences);
    },
    [saveSettings]
  );

  // Navigate
  const navigateTo = useCallback((view: ViewType) => {
    setState((prev) => ({ ...prev, currentView: view }));
  }, []);

  // Setup listeners
  useEffect(() => {
    loadSettings().then(() => loadUsageStats());

    const handleUsageUpdate = () => {
      window.electronAPI
        ?.getUsageStats()
        .then((data) => {
          setState((prev) => ({ ...prev, stats: data }));
        })
        .catch(console.error);
    };

    if (window.electronAPI) {
      window.electronAPI.onUsageUpdated(handleUsageUpdate);
    }

    return () => {
      window.electronAPI?.removeUsageUpdatedListener(handleUsageUpdate);
    };
  }, [loadSettings, loadUsageStats]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            refreshData();
            break;
          case 'q':
            event.preventDefault();
            window.electronAPI?.quitApp();
            break;
          case '1':
            event.preventDefault();
            navigateTo('status');
            break;
          case '2':
          case ',':
            event.preventDefault();
            navigateTo('settings');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [navigateTo, refreshData]);

  // Loading state
  if (state.loading && !state.stats) {
    return (
      <div className="app-background">
        <LoadingScreen />
      </div>
    );
  }

  // Error state
  if (state.error && !state.stats) {
    return (
      <div className="app-background">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass-card p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-bold text-white mb-4">Connection Error</h2>
            <p className="text-neutral-300 mb-6">{state.error}</p>
            <Button onClick={() => loadUsageStats()} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.stats) {
    return (
      <div className="app-background">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-background" />

      <div className="relative flex h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 max-w-full min-h-full">
            {/* Header */}
            <header className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                      {/* Outer ring */}
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="url(#meterGradient)"
                        strokeWidth="2"
                        fill="#1a1a2e"
                      />
                      {/* Meter arc */}
                      <path
                        d="M6 15.5A7 7 0 0 1 12 5a7 7 0 0 1 6 10.5"
                        stroke="url(#meterGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                      />
                      {/* Needle */}
                      <path
                        d="M12 12L15.5 7.5"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      {/* Center dot */}
                      <circle cx="12" cy="12" r="2" fill="#22d3ee" />
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gradient">Claude Meter</h1>
                    <p className="text-xs text-neutral-400">Usage Monitor</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={refreshData}
                    variant="ghost"
                    size="icon"
                    className="p-1 hover:bg-white/10"
                    title="Refresh (Cmd+R)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </Button>

                  <Button
                    onClick={() => window.electronAPI?.quitApp()}
                    variant="ghost"
                    size="icon"
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Quit (Cmd+Q)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                </div>
              </div>

              <NavigationTabs
                currentView={state.currentView}
                onNavigate={navigateTo}
                className="mb-3"
              />
            </header>

            {/* Content */}
            <div className="pb-3">
              {state.currentView === 'status' && <StatusView stats={state.stats} />}

              {state.currentView === 'settings' && (
                <SettingsPanel
                  preferences={state.preferences}
                  onUpdatePreferences={updatePreferences}
                />
              )}
            </div>
          </div>
        </main>
      </div>
      <Toaster />
    </ErrorBoundary>
  );
};

export default App;
