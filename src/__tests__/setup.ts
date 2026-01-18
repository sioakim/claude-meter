import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock electron API
global.window.electronAPI = {
  getUsageStats: vi.fn(),
  refreshData: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  quitApp: vi.fn(),
  onUsageUpdated: vi.fn(),
  removeUsageUpdatedListener: vi.fn(),
};
