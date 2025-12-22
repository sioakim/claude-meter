import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage, screen } from 'electron';
import { CCUsageService } from './src/services/ccusageService.js';
import { NotificationService } from './src/services/notificationService.js';
import { SettingsService } from './src/services/settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ClaudeMeterApp {
  private tray: Tray | null = null;
  private window: BrowserWindow | null = null;
  private usageService: CCUsageService;
  private notificationService: NotificationService;
  private settingsService: SettingsService;
  private updateInterval: NodeJS.Timeout | null = null;
  private menuBarDisplayMode: 'both' | 'percentage' | 'cost' = 'both';

  constructor() {
    this.usageService = CCUsageService.getInstance();
    this.notificationService = NotificationService.getInstance();
    this.settingsService = SettingsService.getInstance();
  }

  async initialize() {
    await app.whenReady();

    // Load settings on startup
    const settings = await this.settingsService.loadSettings();
    this.menuBarDisplayMode = settings.menuBarDisplayMode || 'both';

    // Apply settings to usage service
    this.usageService.updateConfiguration({
      menuBarCostSource: settings.menuBarCostSource,
    });

    this.createTray();
    this.createWindow();
    this.setupIPC();
    this.startUsagePolling();

    app.on('window-all-closed', () => {
      // Keep app running in menu bar
    });

    app.on('activate', () => {
      if (this.window === null) {
        this.createWindow();
      }
    });
  }

  private createTray() {
    const emptyIcon = nativeImage.createEmpty();
    this.tray = new Tray(emptyIcon);
    this.tray.setToolTip('Claude Meter - Usage Monitor');

    // Left click: toggle window
    this.tray.on('click', () => {
      this.toggleWindow();
    });

    // Right click: context menu
    this.tray.on('right-click', () => {
      this.showContextMenu();
    });

    this.updateTrayTitle();
  }

  private showContextMenu() {
    const menuBarData = this.usageService['cachedStats'];
    const oauth = menuBarData?.oauthUtilization;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Refresh',
        click: () => this.updateTrayTitle(),
      },
      { type: 'separator' },
      {
        label: oauth?.isAvailable
          ? `5-Hour: ${oauth.fiveHour.utilization.toFixed(0)}%`
          : '5-Hour: --',
        enabled: false,
      },
      {
        label: oauth?.isAvailable
          ? `Weekly: ${oauth.sevenDay.utilization.toFixed(0)}%`
          : 'Weekly: --',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open Claude Meter',
        click: () => this.showWindow(),
      },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);

    this.tray?.popUpContextMenu(contextMenu);
  }

  private async updateTrayTitle() {
    try {
      const menuBarData = await this.usageService.getMenuBarData();

      // Format menu bar display
      const percentage = Math.round(menuBarData.percentageUsed);
      const cost = menuBarData.cost.toFixed(2);

      let title: string;
      switch (this.menuBarDisplayMode) {
        case 'percentage':
          title = `${percentage}%`;
          break;
        case 'cost':
          title = `$${cost}`;
          break;
        case 'both':
        default:
          title = `${percentage}% · $${cost}`;
          break;
      }

      this.tray?.setTitle(title);

      // Check for notifications
      this.notificationService.checkAndNotify(menuBarData, 'auto');
    } catch (error) {
      console.error('Error updating tray title:', error);
      this.tray?.setTitle('--');
    }
  }

  private createWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    this.window = new BrowserWindow({
      width: 480,
      height: 600,
      x: width - 500,
      y: 10,
      show: false,
      frame: false,
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    this.window.loadFile(path.join(__dirname, 'index.html'));

    this.window.on('blur', () => {
      this.hideWindow();
    });

    this.window.on('closed', () => {
      this.window = null;
    });
  }

  private setupIPC() {
    ipcMain.handle('get-usage-stats', async () => {
      return await this.usageService.getUsageStats();
    });

    ipcMain.handle('refresh-data', async () => {
      const stats = await this.usageService.getUsageStats();
      await this.updateTrayTitle();
      return stats;
    });

    ipcMain.handle('quit-app', () => {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      app.quit();
    });

    ipcMain.handle('load-settings', async () => {
      return await this.settingsService.loadSettings();
    });

    ipcMain.handle('save-settings', async (_, settings) => {
      await this.settingsService.saveSettings(settings);

      // Update services with new settings
      this.usageService.updateConfiguration({
        menuBarCostSource: settings.menuBarCostSource,
      });

      if (settings.menuBarDisplayMode) {
        this.menuBarDisplayMode = settings.menuBarDisplayMode;
        await this.updateTrayTitle();
      }

      return { success: true };
    });

    ipcMain.handle('take-screenshot', async () => {
      return this.takeScreenshot();
    });
  }

  private startUsagePolling() {
    // Update every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.updateTrayTitle();

      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('usage-updated');
      }
    }, 30000);

    // Initial update after 1 second
    setTimeout(() => this.updateTrayTitle(), 1000);
  }

  private showWindow() {
    if (this.window) {
      const cursorPoint = screen.getCursorScreenPoint();
      const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);

      const { x, y, width } = activeDisplay.workArea;
      this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.window.setBounds({ x: x + width - 500, y: y + 10, width: 480, height: 600 });
      this.window.show();
      this.window.focus();
    }
  }

  private hideWindow() {
    this.window?.hide();
  }

  private toggleWindow() {
    if (this.window?.isVisible()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  private async takeScreenshot() {
    try {
      if (!this.window) {
        throw new Error('Window not available');
      }

      const image = await this.window.webContents.capturePage();
      const screenshotsDir = path.join(os.homedir(), 'Pictures', 'ClaudeMeter-Screenshots');

      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filepath = path.join(screenshotsDir, `ClaudeMeter-${timestamp}.png`);

      fs.writeFileSync(filepath, image.toPNG());

      return {
        success: true,
        filepath,
        message: `Screenshot saved to ${filepath}`,
      };
    } catch (error) {
      console.error('Screenshot error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed',
      };
    }
  }
}

const claudeMeterApp = new ClaudeMeterApp();
claudeMeterApp.initialize().catch(console.error);
