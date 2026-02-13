// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useMapEvent } from "react-leaflet";

export function MapClickHandler({ onClick }) {
  useMapEvent("click", onClick);
  return null;
}

