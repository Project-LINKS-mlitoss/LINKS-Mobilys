// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
export function niceStep(max, n = 5) {
  if (!max || max <= 0) return 1;
  const raw = max / n;
  const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const e = raw / p10;
  if (e >= 7.5) return 10 * p10;
  if (e >= 3.5) return 5 * p10;
  if (e >= 1.5) return 2 * p10;
  return p10;
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const t = (x) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`.toUpperCase();
}

export function mixWithWhite(baseHex, whiteRatio) {
  const { r, g, b } = hexToRgb(baseHex);
  return rgbToHex(
    255 * whiteRatio + r * (1 - whiteRatio),
    255 * whiteRatio + g * (1 - whiteRatio),
    255 * whiteRatio + b * (1 - whiteRatio)
  );
}

export function makeRamp(baseHex) {
  return [0.3, 0.25, 0.2, 0.15, 0.1, 0.05].map((w) =>
    mixWithWhite(baseHex, w)
  );
}

export const POPULATION_BINS = {
  total: [0, 200, 500, 800, 1000, 3000, 6000],
  age: [0, 50, 100, 200, 400, 800, 1600],
};

export const POPULATION_COLORS = [
  "#ffffff",
  "#fff2b2",
  "#f2d8a7",
  "#f0a4a4",
  "#e98f8f",
  "#de6c6c",
  "#cd4646",
];

export function getPopulationBins(activeKey) {
  return activeKey === "population" ? POPULATION_BINS.total : POPULATION_BINS.age;
}

export function pickPopulationColor(value, activeKey) {
  const bins = getPopulationBins(activeKey);
  const colors = POPULATION_COLORS;
  const v = Number(value) || 0;

  for (let i = 0; i < bins.length - 1; i++) {
    const upper = bins[i + 1];
    if (v <= upper) return colors[i];
  }
  return colors[colors.length - 1];
}
