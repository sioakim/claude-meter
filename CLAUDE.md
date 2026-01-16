# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Meter is a macOS menu bar Electron application that monitors Claude Code usage in real-time. This is a fork of [CCSeva](https://github.com/Iamshankhadeep/ccseva), completely rewritten to focus on **data honesty** - showing only real API data without predictions or estimates.

### Design Philosophy
- **Show only what we know** - No predictions, no estimates labeled as facts
- **Single glance** - User should understand status in 1 second
- **Honest labeling** - Clearly distinguish API data from calculations

For detailed architecture and module documentation, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Essential Commands

### Development
```bash
npm run electron-dev  # Start with hot reload (recommended for development)
npm run dev           # Build frontend only in watch mode
npm start            # Start built app
```

### Building
```bash
npm run build        # Production build (webpack + tsc compilation)
npm run pack         # Package app with electron-builder
npm run dist         # Build and create distribution package
npm run dist:mac     # Build for macOS specifically
```

### Code Quality
```bash
npm run lint         # Run Biome linter
npm run lint:fix     # Fix linting issues automatically
npm run format       # Format code with Biome
npm run check        # Run linting and formatting checks
npm run type-check   # TypeScript type checking without emit
```

## Architecture Overview

### Dual-Process Electron Architecture
- **Main Process** (`main.ts`): Manages system tray, IPC, window, and background polling
- **Renderer Process** (`src/`): React app with 2-view interface
- **Preload Script** (`preload.ts`): Secure bridge exposing `electronAPI` to renderer

### Data Sources (What's Real vs Calculated)

| Data | Source | Reliability |
|------|--------|-------------|
| 5-Hour utilization % | Claude OAuth API | 100% accurate |
| Weekly utilization % | Claude OAuth API | 100% accurate |
| Reset timestamps | Claude OAuth API | 100% accurate |
| Sonnet/Opus limits | Claude OAuth API | 100% accurate |
| Token counts | ccusage (local JSONL) | 100% accurate |
| Cost ($) | ccusage (tokens × LiteLLM pricing) | Estimated* |

*Cost is calculated by multiplying token counts by current pricing from [LiteLLM's pricing database](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). This includes cache token discounts but may differ from actual billing due to enterprise agreements.

### Service Layer

```
src/services/
├── ccusageService.ts      # Main data aggregation service
│   ├── Fetches OAuth data (utilization %)
│   ├── Fetches ccusage data (tokens, cost)
│   └── Provides MenuBarData and UsageStats
├── claudeOAuthService.ts  # Claude OAuth API integration
│   ├── Retrieves token from macOS Keychain
│   ├── Calls https://api.anthropic.com/api/oauth/usage
│   └── Returns 5-hour, 7-day, model-specific utilization
├── settingsService.ts     # User preferences (~/.claude-meter/settings.json)
└── notificationService.ts # macOS notification management
```

### UI Component Architecture

```
App.tsx (main container)
├── NavigationTabs (2 tabs: Status, Settings)
├── StatusView
│   ├── Current Limits (OAuth data)
│   │   ├── 5-Hour Window progress bar
│   │   ├── Weekly Limit progress bar
│   │   └── Model-specific limits (Sonnet/Opus)
│   ├── Today's Usage (ccusage data)
│   │   ├── Token count
│   │   ├── Cost (calculated)
│   │   └── Model breakdown
│   └── This Week (ccusage data)
│       ├── Total tokens/cost
│       └── Sparkline visualization
├── SettingsPanel
│   ├── Menu bar display mode
│   ├── Cost source preference
│   └── Notification thresholds
└── ui/ (Radix UI components)
```

### Menu Bar Display

Shows: `45% · $2.35` (configurable in settings)

Options:
- **Both**: `45% · $2.35` (default)
- **Percentage only**: `45%`
- **Cost only**: `$2.35`

Right-click context menu shows quick stats and Quit option.

## Data Flow

```
                    ┌─────────────────────────────┐
                    │   Claude OAuth API          │
                    │   api.anthropic.com/api/    │
                    │   oauth/usage               │
                    └──────────────┬──────────────┘
                                   │ utilization %
                                   │ reset times
                                   ▼
┌─────────────────┐     ┌─────────────────────────┐
│  ~/.claude/     │     │    CCUsageService       │
│  *.jsonl files  │────▶│    (aggregates data)    │
└─────────────────┘     └──────────────┬──────────┘
   tokens, models                      │
                                       ▼
                    ┌─────────────────────────────┐
                    │      Menu Bar + UI          │
                    │  StatusView, SettingsPanel  │
                    └─────────────────────────────┘
```

## What Was Removed (vs CCSeva)

These features were removed because they showed unreliable/estimated data:

| Removed | Reason |
|---------|--------|
| Burn rate predictions | Volatile, often wrong |
| Depletion time estimates | Based on unreliable burn rate |
| Velocity/trend analysis | Too noisy to be useful |
| Auto-detect plan | API cannot detect plans |
| Peak hour analysis | Was hardcoded |
| Terminal view | Fake logs, misleading |
| Dashboard view | Redundant with Status |
| Analytics view | Consolidated into Status |
| LiveMonitoring view | Consolidated into Status |
| Alternating menu bar | Confusing UX |

## Configuration

### Settings File
Location: `~/.claude-meter/settings.json`

```json
{
  "menuBarDisplayMode": "both",
  "menuBarCostSource": "today",
  "notificationThresholds": {
    "warning": 70,
    "critical": 90
  }
}
```

## OAuth API Details

Endpoint: `https://api.anthropic.com/api/oauth/usage`

Response structure:
```typescript
{
  five_hour: { utilization: number, resets_at: string },
  seven_day: { utilization: number, resets_at: string },
  seven_day_sonnet?: { utilization: number },
  seven_day_opus?: { utilization: number, resets_at: string },
  extra_usage?: {
    is_enabled: boolean,      // Pay-per-token billing enabled
    monthly_limit: number,
    used_credits: number,
    utilization: number
  }
}
```

Access token is retrieved from macOS Keychain (`Claude Code-credentials`).

## Cost Calculation

Cost is NOT from an API. It's calculated by `ccusage` package:

1. On startup, fetches pricing from: `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
2. Multiplies token counts by per-token prices
3. Includes all token types:
   - Input tokens
   - Output tokens
   - Cache creation tokens (at cache rate)
   - Cache read tokens (90% discount)

This is accurate for typical usage but may differ from actual billing.

## Project Structure

```
claude-meter/
├── main.ts                     # Electron main process
├── preload.ts                  # IPC bridge
├── src/
│   ├── App.tsx                 # Main React container
│   ├── components/
│   │   ├── StatusView.tsx      # Main status display
│   │   ├── SettingsPanel.tsx   # User preferences
│   │   ├── NavigationTabs.tsx  # 2-tab navigation
│   │   ├── LoadingScreen.tsx   # App initialization
│   │   ├── ErrorBoundary.tsx   # Error handling
│   │   └── ui/                 # Radix UI components
│   ├── services/
│   │   ├── ccusageService.ts   # Main data service
│   │   ├── claudeOAuthService.ts # OAuth API
│   │   ├── settingsService.ts  # Preferences
│   │   └── notificationService.ts # Notifications
│   ├── types/
│   │   ├── usage.ts            # TypeScript interfaces
│   │   └── electron.d.ts       # Electron API types
│   └── styles/index.css        # Tailwind CSS
├── package.json                # name: claude-meter
├── electron-builder.json       # App packaging
└── LICENSE                     # MIT (credits CCSeva)
```

## Dependencies

### Runtime
- `ccusage` - Token usage data from ~/.claude files
- `react` / `react-dom` - UI framework
- `@radix-ui/*` - Accessible UI components
- `sonner` - Toast notifications
- `tailwind-merge` / `clsx` - CSS utilities

### Development
- `electron` / `electron-builder` - Desktop app framework
- `typescript` - Type safety
- `webpack` - Bundling
- `@biomejs/biome` - Linting and formatting
- `tailwindcss` - Styling

## Testing Checklist

Since there are no automated tests:

1. Menu bar shows `XX% · $X.XX` format
2. Click opens window with Status view
3. OAuth data displays (5-hour, weekly percentages)
4. Token/cost data displays for today
5. Weekly sparkline renders
6. Settings changes persist after restart
7. Right-click context menu works
8. Notifications trigger at thresholds
9. App handles missing OAuth gracefully

## Credits

Based on [CCSeva](https://github.com/Iamshankhadeep/ccseva) by Claude Monitor.
Rewritten to focus on data accuracy and simplified UX.
