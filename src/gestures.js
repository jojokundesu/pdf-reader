// Interior grabs use displacement, not absolute pointer position: touching the
// middle must not instantly teleport half the sheet across the spine.
export function horizontalIntent(dx, dy, threshold = 8) {
  return Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.15;
}
export function interiorFoldPoint(
  width,
  height,
  anchorY,
  start,
  pointer,
  rect,
  reverse,
) {
  return {
    // A backward fold lifts from the left edge, so its fold point is measured
    // from that edge instead of from the right one.
    x: reverse
      ? ((pointer.clientX - start.x) / rect.width) * width
      : width + ((pointer.clientX - start.x) / rect.width) * width,
    y: anchorY + ((pointer.clientY - start.y) / rect.height) * height,
  };
}
export function completeTurn({
  canceled,
  interior,
  progress,
  velocity,
  distance,
  horizontalDistance,
  pageWidth,
}) {
  if (canceled) return false;
  if (interior)
    return (
      horizontalDistance >= Math.max(32, pageWidth * 0.22) ||
      (horizontalDistance >= 16 && velocity < -0.45)
    );
  return progress > 0.28 || velocity < -0.45 || distance < 7;
}
