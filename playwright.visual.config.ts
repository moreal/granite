import { defineConfig } from "@playwright/test";
import type { ChromaticConfig } from "@chromatic-com/playwright";

// A separate, synthetic-only suite: never open a user's folder for cloud snapshots.
export default defineConfig<ChromaticConfig>({
  testDir: "./tests/visual",
  outputDir: "chromatic-results",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 6_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4175/granite/",
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "light",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    disableAutoSnapshot: true,
    cropToViewport: true,
  },
  webServer: {
    command:
      "VITE_BASE_PATH=/granite/ yarn vite preview --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175/granite/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
