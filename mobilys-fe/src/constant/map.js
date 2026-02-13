// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Map-related constants.
 *
 * Purpose: store map configuration (default zoom/center, tile layer URL, bounds,
 * styling) so it is not hardcoded in multiple places.
 */
import PaleMap from "../assets/photos/pale.png";
import StdMap from "../assets/photos/std.png";
import BlankMap from "../assets/photos/blank.png";
import PhotoMap from "../assets/photos/photo.jpg";

export const VISUALIZATION_MAP_DEFAULTS = {
    roadNetworkCenterLatLng: {
        lat: "36.6958",
        lng: "137.2137",
    },
};

export const POI_LAYER = {
    Z_INDEX: 680,
    DEFAULT_COLOR: "#e53935",
    DEFAULT_GLYPH: "location_on",
};

export const POI_ICON_CONFIG = {
    学校: { glyph: "school", color: "#1976d2" },
    病院: { glyph: "medical_services", color: "#e53935" },
    カフェ: { glyph: "local_cafe", color: "#6d4c41" },
    公園: { glyph: "park", color: "#388e3c" },
    博物館: { glyph: "museum", color: "#5d4037" },
    ショッピング: { glyph: "local_mall", color: "#ff9800" },
    レストラン: { glyph: "restaurant", color: "#d84315" },
    スーパー: { glyph: "local_grocery_store", color: "#2e7d32" },
};

export const POI_MAP_DEFAULTS = {
    CENTER: [36.6959, 137.2137],
    ZOOM: 12,
    BASE_DIV_ICON_OPTS: {
        className: "leaflet-poi-icon",
        popupAnchor: [0, -28],
    },
};

export const MAP = {
    VISUALIZATION_MAP_DEFAULTS,
    POI_LAYER,
    POI_ICON_CONFIG,
    POI_MAP_DEFAULTS,
    selector: {
        sidebarWidthPercent: 25,
        defaultCenterLatLng: [35.6812, 139.7671],
        defaultZoom: 13,
        overlayZIndex: 10,
    },
};

export const MAP_BASE_LAYER_ITEMS = [
    {
        key: "pale",
        thumb: PaleMap,
        url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    },
    {
        key: "std",
        thumb: StdMap,
        url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    },
    {
        key: "blank",
        thumb: BlankMap,
        url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png",
    },
    {
        key: "photo",
        thumb: PhotoMap,
        url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    },
];

export const getBaseLayerItemByKey = (key) =>
    MAP_BASE_LAYER_ITEMS.find((i) => i.key === key) ?? MAP_BASE_LAYER_ITEMS[0];
