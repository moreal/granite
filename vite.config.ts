import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [solid()],
  resolve: { conditions: ["browser", "development"] },
  test: {
    environment: "jsdom",
    server: { deps: { inline: true } },
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
