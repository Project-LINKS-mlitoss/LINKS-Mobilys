import React from "react";
import { useMapEvent } from "react-leaflet";

export function MapClickHandler({ onClick }) {
  useMapEvent("click", onClick);
  return null;
}

