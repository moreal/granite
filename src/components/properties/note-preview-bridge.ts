interface Point {
  x: number;
  y: number;
}
interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** Only the polygon joining the nearest horizontal edges; no hit-test overlay. */
export function isInNotePreviewBridge(
  point: Point,
  trigger: Bounds,
  preview: Bounds,
): boolean {
  const from = preview.top >= trigger.bottom ? trigger.bottom : trigger.top;
  const to = preview.top >= trigger.bottom ? preview.top : preview.bottom;
  if (preview.top < trigger.bottom && preview.bottom > trigger.top)
    return false;
  if (from === to) return false;
  const progress = (point.y - from) / (to - from);
  if (progress < 0 || progress > 1) return false;
  const left = trigger.left + (preview.left - trigger.left) * progress;
  const right = trigger.right + (preview.right - trigger.right) * progress;
  return point.x >= left && point.x <= right;
}
