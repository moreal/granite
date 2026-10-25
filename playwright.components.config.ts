import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/components",
  outputDir: "component-results",
  workers: 2,
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "component-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4176/granite/storybook/",
    browserName: "chromium",
    viewport: { width: 320, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "VITE_BASE_PATH=/granite/ yarn vite preview --host 127.0.0.1 --port 4176 --strictPort",
    url: "http://127.0.0.1:4176/granite/storybook/",
    reuseExistingServer: false,
  },
});
