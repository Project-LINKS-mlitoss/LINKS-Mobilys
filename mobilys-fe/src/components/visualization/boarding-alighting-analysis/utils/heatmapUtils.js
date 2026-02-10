/**
 * Generate heatmap color based on intensity ratio (0-1)
 * @param {number} t - Intensity ratio (0-1)
 * @param {object} theme - Material-UI theme object
 * @returns {string} - Color string in hex format
 */
export function heatColor(t, theme) {
  const strong = theme.palette.primary.main; // darker blue
  if (!Number.isFinite(t) || t <= 0) return "#f5f5f5";
  if (t >= 1) return strong;

  const alpha = 0.2 + 0.6 * t;
  return `${strong}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
