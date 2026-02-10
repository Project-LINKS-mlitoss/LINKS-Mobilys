import React from "react";
import { Marker, Pane } from "react-leaflet";
import L from "leaflet";
import { roundCoordinate } from "../utils/coordinateUtils";

export function SegmentsLayer({
    layers,
    metric,
    segmentLabels,
    stopValueIndex,
    onSegmentClick,
}) {
    if (!layers.segments) return null;

    return (
        <Pane name="api-segments" style={{ zIndex: 910 }}>
            {(segmentLabels || []).map((seg, idx) => {
                const [lng, lat] = seg.geometry.coordinates || [];
                let val = Number(seg?.properties?.value ?? 0);

                if (metric !== "in_car" && (!val || Number.isNaN(val))) {
                    const at = stopValueIndex.get(`${roundCoordinate(lat)},${roundCoordinate(lng)}`);
                    if (at) val = metric === "boarding" ? at.geton : at.getoff;
                }
                return (
                    <Marker
                        key={idx}
                        position={[lat, lng]}
                        icon={L.divIcon({
                            className: "segment-label-icon",
                            html: `<span style="font-weight:bold;color:#d6133a;font-size:12px;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;">${val}</span>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12],
                        })}
                        interactive={metric === "in_car"}
                        eventHandlers={metric === "in_car" ? { click: (e) => onSegmentClick?.(seg, e?.latlng) } : {}}
                    />
                );
            })}
        </Pane>
    );
}
