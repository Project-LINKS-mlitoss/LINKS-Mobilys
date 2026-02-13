// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useEffect, useRef } from "react";
import { Popup, useMap } from "react-leaflet";

export function FitToData({ points, selectedPoint, shouldFitBounds }) {
  const map = useMap();

  useEffect(() => {
    if (selectedPoint?.name) {
      const match = points.find((p) => p.name === selectedPoint.name);
      if (match && Number.isFinite(match.lat) && Number.isFinite(match.lng)) {
        map.setView([match.lat, match.lng], 16, { animate: true });
      }
      return;
    }

    if (!selectedPoint && points?.length > 0 && shouldFitBounds) {
      const latlngs = points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => [p.lat, p.lng]);
      if (!latlngs.length) return;

      const first = latlngs[0];
      const same = latlngs.every(([la, lo]) => la === first[0] && lo === first[1]);
      if (same) map.setView(first, 13);
      else map.fitBounds(latlngs, { padding: [24, 24] });
    }
  }, [points, selectedPoint, shouldFitBounds, map]);

  return null;
}

export function HoverPopup({ children }) {
  return (
    <Popup
      keepInView
      autoPan
      autoPanPadding={[24, 24]}
      closeButton={false}
      offset={[0, -4]}
    >
      <div style={{ fontSize: 13, lineHeight: 1.35 }}>{children}</div>
    </Popup>
  );
}

export function AutoZoomToRoutes({ routeFeatures, padding = [50, 50] }) {
  const map = useMap();
  const prevHashRef = useRef("");

  useEffect(() => {
    if (!Array.isArray(routeFeatures) || routeFeatures.length === 0) return;

    const latlngs = [];
    for (const f of routeFeatures) {
      const coords = f?.geometry?.coordinates;
      if (!Array.isArray(coords)) continue;
      for (const [lng, lat] of coords) {
        if (Number.isFinite(lat) && Number.isFinite(lng)) latlngs.push([lat, lng]);
      }
    }
    if (!latlngs.length) return;

    const hash = latlngs
      .map(([la, lo]) => `${la.toFixed(6)},${lo.toFixed(6)}`)
      .join("|");
    if (hash === prevHashRef.current) return;

    const first = latlngs[0];
    const allSame = latlngs.every(([la, lo]) => la === first[0] && lo === first[1]);

    if (allSame) map.setView(first, 13, { animate: false });
    else map.fitBounds(latlngs, { padding, animate: false });

    prevHashRef.current = hash;
  }, [routeFeatures, map, padding]);

  return null;
}

export function BusStopZoomWrapper({
  selectedVisualization,
  oDBusStopSelectedPoint,
  busStopLines,
  setODBusStopSelectedPoint,
}) {
  const mapZoom = useMap();

  useEffect(() => {
    if (selectedVisualization !== 2) return;
    if (!oDBusStopSelectedPoint) return;
    if (!Array.isArray(busStopLines) || busStopLines.length === 0) return;

    const target = busStopLines.find(
      (l) =>
        l.fromName === oDBusStopSelectedPoint.stopName ||
        l.toName === oDBusStopSelectedPoint.stopName
    );
    if (!target) return;

    const latlng =
      target.fromName === oDBusStopSelectedPoint.stopName ? target.from : target.to;
    if (!latlng) return;

    mapZoom.setView(latlng, 16, { animate: true });
    if (typeof setODBusStopSelectedPoint === "function") {
      setTimeout(() => setODBusStopSelectedPoint(null), 300);
    }
  }, [selectedVisualization, oDBusStopSelectedPoint, busStopLines, mapZoom, setODBusStopSelectedPoint]);

  return null;
}

