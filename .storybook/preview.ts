import "../src/styles.css";
import "../stories/fixtures.css";
export default {
  parameters: { layout: "fullscreen" },
  // Visibility precedes an async play function. Browser checks take control only
  // after Storybook has finished its own interactions and assertions.
  beforeEach: ({ canvasElement }: { canvasElement: HTMLElement }) => {
    canvasElement.removeAttribute("data-story-ready");
  },
  afterEach: ({ canvasElement }: { canvasElement: HTMLElement }) => {
    canvasElement.setAttribute("data-story-ready", "true");
  },
};
