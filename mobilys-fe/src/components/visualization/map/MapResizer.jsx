import React from "react";
import { useMap } from "react-leaflet";

export function MapResizer({ containerWidth }) {
  const map = useMap();

  React.useEffect(() => {
    map.invalidateSize();
  }, [containerWidth, map]);

  return null;
}

