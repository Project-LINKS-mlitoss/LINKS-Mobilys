// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import "leaflet/dist/leaflet.css";

import { MAP } from "../constant";
import { useMapSelector } from "./mapSelector/hooks/useMapSelector";

export const MapSelector = () => {
  const { ui, mapUrl, mapList, loading, pending, mapReady, setMapReady, currentId, handleChange } = useMapSelector();

  if (loading || !mapList.length) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          {ui.loadingMapList}
        </Typography>
      </Box>
    );
  }

  if (!mapUrl) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          {ui.mapUrlMissing}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Box
        sx={{
          width: `${MAP.selector.sidebarWidthPercent}%`,
          p: 2,
          borderRight: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <Typography variant="h6" gutterBottom>
          {ui.title}
        </Typography>
        <FormControl component="fieldset">
          <RadioGroup value={currentId} onChange={handleChange}>
            {mapList.map((m) => (
              <FormControlLabel
                key={m.id}
                value={m.id}
                control={<Radio />}
                label={
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2">{m.name}</Typography>
                  </Box>
                }
                sx={{ mb: 2 }}
                disabled={pending}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>
      <Box sx={{ flexGrow: 1, p: 2, position: "relative" }}>
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: 0, height: "100%" }}>
            <MapContainer
              center={MAP.selector.defaultCenterLatLng}
              zoom={MAP.selector.defaultZoom}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url={mapUrl} attribution={ui.attributionHtml} eventHandlers={{ load: () => setMapReady(true) }} />
            </MapContainer>
          </CardContent>
          {(!mapReady || pending) && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(255,255,255,0.7)",
                zIndex: MAP.selector.overlayZIndex,
              }}
            >
              <CircularProgress />
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
};

