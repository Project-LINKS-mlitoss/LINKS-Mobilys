import { niceStep, makeRamp } from "../../map/mapColorUtils";

/**
 * Build thresholds for color binning
 * @param {number[]} values - Array of values
 * @param {number} n - Number of bins (default: 5)
 * @returns {object} - { thresholds, max }
 */
export function buildThresholds(values = [], n = 5) {
  const max = Math.max(0, ...values.map((v) => Number(v) || 0));
  const step = niceStep(max, n);
  const thresholds = Array.from({ length: n + 1 }, (_, i) => step * i);
  return { thresholds, max };
}

/**
 * Convert value to bin index based on thresholds
 * @param {number} v - Value to bin
 * @param {number[]} thresholds - Threshold array
 * @returns {number} - Bin index
 */
export function valueToBinIndex(v, thresholds) {
  const x = Number(v) || 0;
  for (let i = 1; i < thresholds.length; i++) if (x < thresholds[i]) return i - 1;
  return thresholds.length - 1;
}

/**
 * Generate range labels from thresholds
 * @param {number[]} thresholds - Threshold array
 * @returns {string[]} - Array of range labels
 */
export function rangeLabels(thresholds) {
  const arr = [];
  for (let i = 0; i < thresholds.length - 1; i++) {
    arr.push(`${thresholds[i]} - ${thresholds[i + 1]}`);
  }
  arr.push(`≥ ${thresholds[thresholds.length - 1]}`);
  return arr;
}

export { makeRamp };
