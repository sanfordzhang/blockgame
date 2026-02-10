const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // MetaMask 扩展路径（需要提前下载）
          // args: [
          //   `--disable-extensions-except=${path.join(__dirname, '../extensions/metamask')}`,
          //   `--load-extension=${path.join(__dirname, '../extensions/metamask')}`
          // ],
          headless: false, // 必须使用非无头模式才能加载扩展
        },
      },
    },
  ],
});
