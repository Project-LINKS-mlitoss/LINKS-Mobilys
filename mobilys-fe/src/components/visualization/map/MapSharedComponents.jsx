// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import { getGeoJsonCenter } from "./mapCalcUtils";
import { pickPopulationColor } from "./mapColorUtils";

const DEFAULT_CENTER = [35.681236, 139.767125];

export function AutoCenterMap({
  features,
  zoom = 13,
  animate = true,
  enabled = true,
}) {
  const map = useMap();
  const lastCenterRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (!features || features.length === 0) return;

    const center = getGeoJsonCenter(features);
    const safeCenter =
      Array.isArray(center) && center.length === 2 ? center : DEFAULT_CENTER;

    const last = lastCenterRef.current;
    if (
      last &&
      Math.abs(last[0] - safeCenter[0]) < 1e-9 &&
      Math.abs(last[1] - safeCenter[1]) < 1e-9
    ) {
      return;
    }
    lastCenterRef.current = safeCenter;

    map.setView(safeCenter, zoom, { animate });
  }, [animate, enabled, features, map, zoom]);

  return null;
}

export function FocusOnStop({ stop, zoom = 17, animate = true, enabled = true }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    if (!stop) return;
    if (!Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) {
      return;
    }
    map.setView([Number(stop.lat), Number(stop.lng)], zoom, { animate });
  }, [animate, enabled, map, stop, zoom]);
  return null;
}

function getPopulationValue(props, activeKey) {
  switch (activeKey) {
    case "population0_14":
      return props.age_0_14 ?? 0;
    case "population15_64":
      return props.age_15_64 ?? 0;
    case "population65_up":
      return props.age_65_up ?? 0;
    default:
      return props.total ?? 0;
  }
}

function getActivePopulationKey(layerState, activeKey) {
  if (activeKey) return activeKey;
  if (!layerState) return null;
  return ["population", "population0_14", "population15_64", "population65_up"].find(
    (k) => layerState[k]
  );
}

export function PopulationLayer({
  populationData,
  layerState,
  activeKey: activeKeyProp,
  renderer,
  pane = "population-pane",
  fillOpacity = 0.3,
  weight = 0,
  outlineColor = "#ccc",
  zIndex,
}) {
  const activeKey = getActivePopulationKey(layerState, activeKeyProp);

  const paneStyle = useMemo(
    () => (Number.isFinite(Number(zIndex)) ? { zIndex: Number(zIndex) } : undefined),
    [zIndex]
  );

  if (!populationData || !activeKey) return null;

  const geoJson = (
    <GeoJSON
      key={`population-${activeKey}`}
      renderer={renderer}
      pane={pane}
      data={populationData}
      interactive={false}
      bubblingMouseEvents={false}
      style={(feature) => {
        const v = getPopulationValue(feature?.properties || {}, activeKey);
        return {
          fillColor: pickPopulationColor(v, activeKey),
          fillOpacity,
          color: outlineColor,
          weight,
        };
      }}
    />
  );

  if (paneStyle) {
    return (
      <Pane name={pane} style={paneStyle}>
        {geoJson}
      </Pane>
    );
  }

  return geoJson;
}

