import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService, type AppSettings } from '../../services/settingsService';

// Mock fs module
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (path: string) => mockExistsSync(path),
  readFileSync: (path: string, encoding: string) => mockReadFileSync(path, encoding),
  writeFileSync: (path: string, data: string, encoding: string) =>
    mockWriteFileSync(path, data, encoding),
  mkdirSync: (path: string, options: any) => mockMkdirSync(path, options),
}));

const mockHomedir = vi.fn();
vi.mock('node:os', () => ({
  homedir: () => mockHomedir(),
}));

describe('SettingsService', () => {
  let service: SettingsService;
  const mockHomeDir = '/mock/home';

  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue(mockHomeDir);
    mockExistsSync.mockReturnValue(true);
    mockMkdirSync.mockReturnValue(undefined);

    // Create a new instance for each test
    service = new SettingsService();
  });

  describe('loadSettings', () => {
    it('returns default settings when no settings file exists', async () => {
      mockExistsSync.mockReturnValue(false);

      const settings = await service.loadSettings();

      expect(settings).toEqual({
        menuBarDisplayMode: 'both',
        menuBarCostSource: 'today',
        notificationThresholds: {
          warning: 70,
          critical: 90,
        },
      });
    });

    it('loads settings from file when it exists', async () => {
      const mockSettings = {
        menuBarDisplayMode: 'percentage',
        menuBarCostSource: 'sessionWindow',
        notificationThresholds: {
          warning: 80,
          critical: 95,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = await service.loadSettings();

      expect(settings).toEqual(mockSettings);
    });

    it('migrates "alternate" display mode to "both"', async () => {
      const mockSettings = {
        menuBarDisplayMode: 'alternate',
        menuBarCostSource: 'today',
        notificationThresholds: {
          warning: 70,
          critical: 90,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = await service.loadSettings();

      expect(settings.menuBarDisplayMode).toBe('both');
    });

    it('merges partial settings with defaults', async () => {
      const partialSettings = {
        menuBarDisplayMode: 'cost',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(partialSettings));

      const settings = await service.loadSettings();

      expect(settings).toEqual({
        menuBarDisplayMode: 'cost',
        menuBarCostSource: 'today', // from defaults
        notificationThresholds: {
          warning: 70, // from defaults
          critical: 90, // from defaults
        },
      });
    });

    it('returns defaults when file reading fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const settings = await service.loadSettings();

      expect(settings).toEqual({
        menuBarDisplayMode: 'both',
        menuBarCostSource: 'today',
        notificationThresholds: {
          warning: 70,
          critical: 90,
        },
      });
    });
  });

  describe('saveSettings', () => {
    it('saves settings to file', async () => {
      const newSettings: Partial<AppSettings> = {
        menuBarDisplayMode: 'percentage',
      };

      mockExistsSync.mockReturnValue(false);

      await service.saveSettings(newSettings);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.claude-meter/settings.json'),
        expect.stringContaining('"menuBarDisplayMode": "percentage"'),
        'utf8'
      );
    });

    it('merges new settings with existing settings', async () => {
      const existingSettings = {
        menuBarDisplayMode: 'both',
        menuBarCostSource: 'today',
        notificationThresholds: {
          warning: 70,
          critical: 90,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings));

      const newSettings: Partial<AppSettings> = {
        menuBarDisplayMode: 'cost',
      };

      await service.saveSettings(newSettings);

      const expectedSettings = {
        ...existingSettings,
        menuBarDisplayMode: 'cost',
      };

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.claude-meter/settings.json'),
        JSON.stringify(expectedSettings, null, 2),
        'utf8'
      );
    });

    it('throws error when writing fails', async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const newSettings: Partial<AppSettings> = {
        menuBarDisplayMode: 'percentage',
      };

      await expect(service.saveSettings(newSettings)).rejects.toThrow('Write error');
    });
  });

  describe('getDefaultSettings', () => {
    it('returns a copy of default settings', () => {
      const defaults = service.getDefaultSettings();

      expect(defaults).toEqual({
        menuBarDisplayMode: 'both',
        menuBarCostSource: 'today',
        notificationThresholds: {
          warning: 70,
          critical: 90,
        },
      });

      // Verify it's a copy, not a reference
      defaults.menuBarDisplayMode = 'percentage';
      expect(service.getDefaultSettings().menuBarDisplayMode).toBe('both');
    });
  });

  describe('getSettingsPath', () => {
    it('returns the correct settings path', () => {
      const settingsPath = service.getSettingsPath();
      expect(settingsPath).toContain('.claude-meter/settings.json');
    });
  });

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const instance1 = SettingsService.getInstance();
      const instance2 = SettingsService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
