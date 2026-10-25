import type { StorybookConfig } from "storybook-solidjs-vite";
const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.tsx"],
  framework: { name: "storybook-solidjs-vite", options: { docgen: false } },
  addons: [],
  staticDirs: [],
  async viteFinal(config) {
    // Relative chunks work both at /storybook/ and Pages' /granite/storybook/.
    config.base = "./";
    config.publicDir = false;
    return config;
  },
};
export default config;
