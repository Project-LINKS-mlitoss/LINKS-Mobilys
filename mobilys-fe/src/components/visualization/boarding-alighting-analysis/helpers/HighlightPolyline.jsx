import React, { useMemo, useEffect } from "react";
import { Polyline, Pane, useMap } from "react-leaflet";
import { METRIC_BASE } from "./LegendPanel";

const DEFAULT_THRESHOLDS = [0, 500, 1000, 1500, 2000, 2500];
const BIN_OPACITIES = [0.50, 0.60, 0.70, 0.75, 0.85, 0.95];
const BIN_WEIGHTS = [4, 6, 8, 10, 12, 14];

function valueToBinIndexLocal(v, edges) {
    if (!Array.isArray(edges) || edges.length === 0) return 0;
    for (let i = 1; i < edges.length; i++) if (v < edges[i]) return i - 1;
    return edges.length - 1;
}

export function HighlightPolyline({ coordinates, values, thresholds, baseColor }) {
    const map = useMap();

    const toLatLngs = (line) => line.map(([lng, lat]) => [lat, lng]);

    const color = baseColor || METRIC_BASE.in_car.base;
    const edges = Array.isArray(thresholds) && thresholds.length ? thresholds : DEFAULT_THRESHOLDS;

    const allPoints = useMemo(() => (coordinates || []).flat().map(([lng, lat]) => [lat, lng]), [coordinates]);

    const prevHashRef = React.useRef("");
    useEffect(() => {
        if (!allPoints.length) return;
        const hash = allPoints.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
        if (hash === prevHashRef.current) return;
        map.fitBounds(allPoints, { padding: [30, 30] });
        prevHashRef.current = hash;
    }, [allPoints, map]);

    return (
        <>
            <Pane name="api-highlight-casing" style={{ zIndex: 454 }}>
                {(coordinates || []).map((line, idx) => {
                    const v = Array.isArray(values) ? Number(values[Math.min(idx, values.length - 1)] ?? 0) : 0;
                    const bin = valueToBinIndexLocal(v, edges);
                    const weight = BIN_WEIGHTS[Math.min(bin, BIN_WEIGHTS.length - 1)] + 6;
                    return (
                        <Polyline
                            key={`casing-${idx}`}
                            positions={toLatLngs(line)}
                            pathOptions={{ color: "#FFFFFF", weight, opacity: 1, lineCap: "round", lineJoin: "round" }}
                        />
                    );
                })}
            </Pane>

            <Pane name="api-highlight" style={{ zIndex: 455 }}>
                {(coordinates || []).map((line, idx) => {
                    const v = Array.isArray(values) ? Number(values[Math.min(idx, values.length - 1)] ?? 0) : 0;
                    const bin = valueToBinIndexLocal(v, edges);
                    const weight = BIN_WEIGHTS[Math.min(bin, BIN_WEIGHTS.length - 1)];
                    const opacity = BIN_OPACITIES[Math.min(bin, BIN_OPACITIES.length - 1)];
                    return (
                        <Polyline
                            key={`stroke-${idx}`}
                            positions={toLatLngs(line)}
                            pathOptions={{ color, weight, opacity, lineCap: "round", lineJoin: "round" }}
                        />
                    );
                })}
            </Pane>
        </>
    );
}
