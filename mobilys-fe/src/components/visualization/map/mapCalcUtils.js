// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import L from "leaflet";

export const DEFAULT_CENTER_LAT_LNG = [35.681236, 139.767125];

export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  return L.latLng(lat1, lon1).distanceTo(L.latLng(lat2, lon2));
}

export function createCirclePolygon(center, radius, points = 64) {
  if (!center) return [];
  const [lat, lng] = center;
  const coords = [];
  const earthRadius = 6378137;
  const d = radius / earthRadius;
  for (let i = 0; i <= points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const latOffset = Math.asin(
      Math.sin((lat * Math.PI) / 180) * Math.cos(d) +
        Math.cos((lat * Math.PI) / 180) * Math.sin(d) * Math.cos(angle)
    );
    const lngOffset =
      (lng * Math.PI) / 180 +
      Math.atan2(
        Math.sin(angle) * Math.sin(d) * Math.cos((lat * Math.PI) / 180),
        Math.cos(d) - Math.sin((lat * Math.PI) / 180) * Math.sin(latOffset)
      );
    coords.push([(latOffset * 180) / Math.PI, (lngOffset * 180) / Math.PI]);
  }
  return coords;
}

export function getGeoJsonCenter(features) {
  if (!features || features.length === 0) return DEFAULT_CENTER_LAT_LNG;
  const lats = [];
  const lngs = [];
  features.forEach((f) => {
    const g = f.geometry;
    if (!g) return;
    const push = ([lng, lat]) => {
      lngs.push(lng);
      lats.push(lat);
    };
    if (g.type === "Point") push(g.coordinates);
    else if (g.type === "LineString") g.coordinates.forEach(push);
    else if (g.type === "Polygon") g.coordinates[0]?.forEach(push);
  });
  if (!lats.length) return DEFAULT_CENTER_LAT_LNG;
  return [
    lats.reduce((a, b) => a + b, 0) / lats.length,
    lngs.reduce((a, b) => a + b, 0) / lngs.length,
  ];
}

export function collectLatLngsFromGeom(geom) {
  const out = [];
  if (!geom) return out;
  const push = ([lng, lat]) => out.push([lat, lng]);
  const walk = (coords, depth) => {
    if (depth === 1) {
      coords.forEach(push);
      return;
    }
    coords.forEach((c) => walk(c, depth - 1));
  };
  switch (geom.type) {
    case "Polygon":
      walk(geom.coordinates, 2);
      break;
    case "MultiPolygon":
      walk(geom.coordinates, 3);
      break;
    case "LineString":
      walk(geom.coordinates, 1);
      break;
    case "MultiLineString":
      walk(geom.coordinates, 2);
      break;
    default:
      break;
  }
  return out;
}

