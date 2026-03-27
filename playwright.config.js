const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,

  reporter: 'list',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
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
        // Connect to existing Chrome instance with CDP
        connectOptions: process.env.CDP_ENDPOINT ? {
          wsEndpoint: process.env.CDP_ENDPOINT,
        } : undefined,
        launchOptions: process.env.CDP_ENDPOINT ? undefined : {
          headless: false,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      },
    },
  ],

  // 使用已运行的服务器，不再自动启动
  // webServer: {
  //   command: 'REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm start',
  //   url: 'http://localhost:3001',
  //   timeout: 120000,
  //   reuseExistingServer: true,
  //   stdout: 'ignore',
  //   stderr: 'pipe',
  // },
});
