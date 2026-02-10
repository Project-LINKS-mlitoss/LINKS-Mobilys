import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

/**
 * Component to auto-zoom map to route features
 */
export function AutoZoomToRoutes({ routeFeatures }) {
    const map = useMap();
    const prevHashRef = useRef("");

    useEffect(() => {
        if (!Array.isArray(routeFeatures) || routeFeatures.length === 0) return;
        const allCoords = [];
        routeFeatures.forEach((feature) => {
            if (feature.geometry?.type === "LineString" && Array.isArray(feature.geometry.coordinates)) {
                feature.geometry.coordinates.forEach(([lng, lat]) => allCoords.push([lat, lng]));
            }
        });
        if (allCoords.length === 0) return;

        const hash = allCoords.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
        if (hash !== prevHashRef.current) {
            map.fitBounds(allCoords, { padding: [50, 50] });
            prevHashRef.current = hash;
        }
    }, [routeFeatures, map]);

    return null;
}

/**
 * Component to track map interactions (move/zoom)
 */
export function MapInteractionTracker({ onMoveOrZoomEnd }) {
    useMapEvents({
        moveend() {
            onMoveOrZoomEnd?.();
        },
        zoomend() {
            onMoveOrZoomEnd?.();
        },
    });
    return null;
}
