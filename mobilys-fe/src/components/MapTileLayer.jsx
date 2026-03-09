// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { TileLayer } from "react-leaflet";
import { getBaseLayerItemByKey } from "../constant/map.js";
import { MAP as MAP_STRINGS } from "../strings/index.js";

export function MapTileLayer({ baseKey = "pale" }) {
  const base = getBaseLayerItemByKey(baseKey);
  return (
    <TileLayer
      key={base.key}           // force swap when baseKey changes
      url={base.url}
      attribution={MAP_STRINGS.selector.attributionHtml}
      zIndex={0}
    />
  );
}
