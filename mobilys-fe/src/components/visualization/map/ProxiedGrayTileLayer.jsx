import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const DEFAULT_TILE_PROXY_PATH = "/visualization/tile-proxy";

/**
 * ProxiedGrayTileLayer
 *
 * Wraps an upstream tile template via backend proxy and requests server-side grayscale tiles.
 * This is shared across multiple visualization maps to avoid duplicated Leaflet layer wiring.
 */
export function ProxiedGrayTileLayer({
    upstreamTemplate,
    attribution,
    tileLayerRef,
    pane = "tilePane",
    apiBase = DEFAULT_API_BASE,
    tileProxyPath = DEFAULT_TILE_PROXY_PATH,
    mode = "gray",
}) {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
        if (!map || !upstreamTemplate) return;

        const Proxied = L.TileLayer.extend({
            getTileUrl: function (coords) {
                const upstream = L.Util.template(upstreamTemplate, coords);
                const encoded = encodeURIComponent(upstream);
                return `${apiBase}${tileProxyPath}?mode=${encodeURIComponent(mode)}&url=${encoded}`;
            },
        });

        const layer = new Proxied("", {
            attribution,
            pane,
            crossOrigin: "anonymous",
        });

        layer.addTo(map);
        layerRef.current = layer;
        if (tileLayerRef) tileLayerRef.current = layer;

        return () => {
            if (map && layer) map.removeLayer(layer);
            if (tileLayerRef && tileLayerRef.current === layer)
                tileLayerRef.current = null;
            layerRef.current = null;
        };
    }, [map, upstreamTemplate, attribution, pane, tileLayerRef, apiBase, tileProxyPath, mode]);

    return null;
}

