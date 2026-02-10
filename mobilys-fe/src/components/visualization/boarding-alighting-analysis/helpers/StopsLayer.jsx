import React from "react";
import { Marker, Pane } from "react-leaflet";
import L from "leaflet";
import StopLabelTooltip from "../../StopLabelTooltip";
import { VISUALIZATION } from "@/strings";
import { valueToBinIndex } from "../utils/colorUtils";

export function StopsLayer({
    layers,
    metric,
    stopsFeatures,
    thresholds,
    ramp,
    onStopClick,
}) {
    if (!layers.stops) return null;

    if (metric === "in_car") {
        return (
            <Pane name="api-stops-neutral" style={{ zIndex: 900 }}>
                {(stopsFeatures || []).map((stop, idx) => {
                    const [lng, lat] = stop.geometry.coordinates || [];
                    return (
                        <Marker
                            key={idx}
                            position={[lat, lng]}
                            icon={L.divIcon({
                                className: "stop-neutral",
                                html: `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#666;border:1.5px solid #666;opacity:.9;"></span>`,
                                iconSize: [10, 10],
                                iconAnchor: [5, 5],
                            })}
                            interactive
                            eventHandlers={{ click: (e) => onStopClick?.(stop, e?.latlng) }}
                        >
                            {layers.stopLabels && (
                                <StopLabelTooltip
                                    stopName={stop?.properties?.keyword}
                                    direction="top"
                                    offset={[0, -8]}
                                    permanent
                                />
                            )}
                        </Marker>
                    );
                })}
            </Pane>
        );
    }

    return (
        <Pane name="api-stops" style={{ zIndex: 900 }}>
            {(stopsFeatures || []).map((stop, idx) => {
                const [lng, lat] = stop.geometry.coordinates || [];
                const v = metric === "boarding"
                    ? Number(stop?.properties?.count_geton ?? 0)
                    : Number(stop?.properties?.count_getoff ?? 0);
                const bin = valueToBinIndex(v, thresholds);
                const color = ramp[Math.min(bin, ramp.length - 1)];
                return (
                    <Marker
                        key={idx}
                        position={[lat, lng]}
                        icon={L.divIcon({
                            className: "stop-colored",
                            html: `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid ${color};"></span>`,
                            iconSize: [12, 12],
                            iconAnchor: [6, 6],
                        })}
                        interactive
                        eventHandlers={{ click: (e) => onStopClick?.(stop, e?.latlng) }}
                    >
                        {layers.stopLabels && (
                            <StopLabelTooltip
                                stopName={
                                    stop?.properties?.keyword ??
                                    VISUALIZATION.common.map.labels.stopFallback
                                }
                                text={`${stop?.properties?.keyword ?? VISUALIZATION.common.map.labels.stopFallback}`}
                                direction="top"
                                offset={[0, -8]}
                                permanent
                            />
                        )}
                    </Marker>
                );
            })}
        </Pane>
    );
}
