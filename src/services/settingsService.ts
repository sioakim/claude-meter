import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface AppSettings {
  menuBarDisplayMode: 'both' | 'percentage' | 'cost';
  menuBarCostSource: 'today' | 'sessionWindow';
  notificationThresholds: {
    warning: number;
    critical: number;
  };
}

export class SettingsService {
  private static instance: SettingsService;
  private settingsPath: string;
  private defaultSettings: AppSettings;

  constructor() {
    // Create settings directory in user's home directory
    const settingsDir = path.join(os.homedir(), '.claude-meter');
    this.settingsPath = path.join(settingsDir, 'settings.json');

    this.defaultSettings = {
      menuBarDisplayMode: 'both',
      menuBarCostSource: 'today',
      notificationThresholds: {
        warning: 70,
        critical: 90,
      },
    };

    // Ensure settings directory exists
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const rawSettings = JSON.parse(data);

        // Migrate old settings to new format
        const settings: Partial<AppSettings> = {};

        // Migrate menuBarDisplayMode: 'alternate' is now 'both'
        if (rawSettings.menuBarDisplayMode === 'alternate' || !rawSettings.menuBarDisplayMode) {
          settings.menuBarDisplayMode = 'both';
        } else {
          settings.menuBarDisplayMode = rawSettings.menuBarDisplayMode;
        }

        // Copy other valid settings
        if (rawSettings.menuBarCostSource) {
          settings.menuBarCostSource = rawSettings.menuBarCostSource;
        }
        if (rawSettings.notificationThresholds) {
          settings.notificationThresholds = rawSettings.notificationThresholds;
        }

        // Merge with defaults to ensure all required fields are present
        return {
          ...this.defaultSettings,
          ...settings,
        };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }

    // Return defaults if file doesn't exist or error occurred
    return this.defaultSettings;
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      // Load existing settings first
      const currentSettings = await this.loadSettings();

      // Merge with new settings
      const updatedSettings = {
        ...currentSettings,
        ...settings,
      };

      // Write to file
      fs.writeFileSync(this.settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  getDefaultSettings(): AppSettings {
    return { ...this.defaultSettings };
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }
}
