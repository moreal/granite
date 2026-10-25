import { expect, it } from "vitest";
import { isInNotePreviewBridge } from "../../src/components/properties/note-preview-bridge";
it("S28 holds only the nearest-edge corridor for a preview below or above the link", () => {
  const trigger = { left: 112, right: 140, top: 35, bottom: 59 };
  const below = { left: 12, right: 308, top: 67, bottom: 160 };
  expect(isInNotePreviewBridge({ x: 126, y: 63 }, trigger, below)).toBe(true);
  expect(isInNotePreviewBridge({ x: 300, y: 60 }, trigger, below)).toBe(false);
  expect(isInNotePreviewBridge({ x: 126, y: 200 }, trigger, below)).toBe(false);
  const above = { left: 12, right: 308, top: 2, bottom: 27 };
  expect(isInNotePreviewBridge({ x: 126, y: 31 }, trigger, above)).toBe(true);
  expect(isInNotePreviewBridge({ x: 300, y: 34 }, trigger, above)).toBe(false);
  expect(isInNotePreviewBridge({ x: 126, y: 63 }, trigger, above)).toBe(false);
});
