import "../src/styles.css";
import "../stories/fixtures.css";
export default {
  globalTypes: {
    theme: {
      name: "테마",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "밝게" },
          { value: "dark", title: "어둡게" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: { layout: "fullscreen" },
  // Visibility precedes an async play function. Browser checks take control only
  // after Storybook has finished its own interactions and assertions.
  beforeEach: ({
    canvasElement,
    globals,
  }: {
    canvasElement: HTMLElement;
    globals: { theme?: string };
  }) => {
    document.documentElement.dataset.theme =
      globals.theme === "dark" ? "dark" : "light";
    canvasElement.removeAttribute("data-story-ready");
  },
  afterEach: ({ canvasElement }: { canvasElement: HTMLElement }) => {
    canvasElement.setAttribute("data-story-ready", "true");
  },
};
