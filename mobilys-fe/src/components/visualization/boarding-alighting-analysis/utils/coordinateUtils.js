// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Convert coordinate array [lng, lat] to Leaflet format [lat, lng]
 * @param {Array} line - Array of [lng, lat] coordinates
 * @returns {Array} - Array of [lat, lng] coordinates
 */
export function toLatLngs(line) {
  return line.map(([lng, lat]) => [lat, lng]);
}

/**
 * Round number to 6 decimal places
 * @param {number} n - Number to round
 * @returns {string} - Rounded number as string
 */
export function roundCoordinate(n) {
  return (Math.round((Number(n) || 0) * 1e6) / 1e6).toFixed(6);
}

/**
 * Calculate midpoint of a LineString or MultiLineString geometry
 * @param {object} geometry - GeoJSON geometry object
 * @returns {Array|null} - [lat, lng] or null
 */
export function midpointLatLng(geometry) {
  if (!geometry) return null;
  const { type, coordinates } = geometry;

  if (type === "LineString" && Array.isArray(coordinates) && coordinates.length) {
    const mid = Math.floor(coordinates.length / 2);
    const [lng, lat] = coordinates[mid] || [];
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  if (type === "MultiLineString" && Array.isArray(coordinates) && coordinates.length) {
    const longest = coordinates.reduce(
      (acc, cur) => (cur.length > (acc?.length || 0) ? cur : acc),
      null
    );
    if (longest && longest.length) {
      const mid = Math.floor(longest.length / 2);
      const [lng, lat] = longest[mid] || [];
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }
  }

  return null;
}
