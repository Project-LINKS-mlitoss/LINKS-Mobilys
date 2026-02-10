
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
  Typography,
  Autocomplete,
  TextField,
  Stack,
} from "@mui/material";

import BusMap from "../../components/simulation/car-routing/BusMap";
import CarCandidatesMap from "../../components/simulation/car-routing/CarCandidatesMap";
import { SIMULATION } from "@/strings";
import { useCarRoutingDetail } from "./hooks/useCarRoutingDetail";

const ALL = "__ALL__";
const strings = SIMULATION.carRouting;

function TopFilterBar({
  data,
  selectedRoute,
  setSelectedRoute,
  selectedPattern,
  setSelectedPattern,
}) {
  const routes = useMemo(() => data?.routes || [], [data]);

  const routeOptions = useMemo(() => {
    const opts = routes.map((r) => ({
      id: r.route_id,
      label: r.route_id,
      color: r.route_keyword_color || "#000",
      patterns: r.route_patterns,
    }));
    return [{ id: ALL, label: strings.filters.all }, ...opts];
  }, [routes]);

  const patternOptions = useMemo(() => {
    if (!selectedRoute || selectedRoute === ALL)
      return [{ id: ALL, label: strings.filters.all }];
    const r = routes.find((x) => x.route_id === selectedRoute);
    const patterns = r?.route_patterns || [];
    const list = patterns.map((p) => ({
      id: p.pattern_id,
      label: `${p.pattern_id}`,
      sub: p,
      color: r?.route_keyword_color || "#000",
    }));
    return list.length > 1
      ? [{ id: ALL, label: strings.filters.all }, ...list]
      : list;
  }, [routes, selectedRoute]);

  const routeVal = routeOptions.find((o) => o.id === selectedRoute) || null;
  const patternVal = patternOptions.find((o) => o.id === selectedPattern) || null;

  return (
    <Stack variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          disableClearable
          value={routeVal}
          onChange={(_, v) => setSelectedRoute(v?.id || ALL)}
          options={routeOptions}
          getOptionLabel={(o) => o.label}
          renderInput={(params) => (
            <TextField {...params} label={strings.filters.route} />
          )}
        />

        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          disableClearable
          value={patternVal}
          onChange={(_, v) => setSelectedPattern(v?.id || ALL)}
          options={patternOptions}
          getOptionLabel={(o) => o.label}
          disabled={selectedRoute === ALL}
          renderInput={(params) => (
            <TextField {...params} label={strings.filters.pattern} />
          )}
        />

        
      </Stack>
    </Stack>
  );
}

/* ───────────────────────────── Main ───────────────────────────── */
export default function CarRouting(props) {
  const simulationId = props?.simulationId;

  const { data, loading, error, clearError } =
    useCarRoutingDetail(simulationId);

  const [selectedRoute, setSelectedRoute] = useState(ALL);
  const [selectedPattern, setSelectedPattern] = useState(ALL);
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    setSelectedRoute(ALL);
    setSelectedPattern(ALL);
    setSelectedKey(null);
  }, [simulationId, data]);

  // Keep pattern consistent when route changes
  useEffect(() => {
    if (!data) return;

    if (selectedRoute === ALL) {
      if (selectedPattern !== ALL) setSelectedPattern(ALL);
      setSelectedKey(null);
      return;
    }

    const r = (data.routes || []).find((x) => x.route_id === selectedRoute);
    const patterns = r?.route_patterns || [];
    if (!patterns.length) {
      setSelectedPattern(ALL);
      setSelectedKey(null);
      return;
    }
    if (patterns.length === 1) {
      const pid = patterns[0].pattern_id;
      if (selectedPattern !== pid) setSelectedPattern(pid);
      setSelectedKey(`${selectedRoute}|${pid}`);
    } else {
      if (selectedPattern !== ALL) setSelectedPattern(ALL);
      setSelectedKey(null);
    }
  }, [data, selectedRoute]); // eslint-disable-line

  const routes = useMemo(() => data?.routes || [], [data]);

  // Layers — use route_patterns; support ALL for route & pattern
  const busLayers = useMemo(() => {
    const out = [];
    routes.forEach((r) => {
      if (selectedRoute !== ALL && r.route_id !== selectedRoute) return;
      const col = r.route_keyword_color || "#000";
      (r.route_patterns || []).forEach((p) => {
        if (selectedRoute !== ALL && selectedPattern !== ALL && p.pattern_id !== selectedPattern) return;
        out.push({
          key: `${r.route_id}|${p.pattern_id}`,
          route_id: r.route_id,
          color: col,
          feature: p.gtfs_shape || p.shape_geojson || p.feature || null,
          start: p.start,
          end: p.end,
          pattern_id: p.pattern_id,
          shape_id: p.shape_id,
          direction_id: p.direction_id,
        });
      });
    });
    return out;
  }, [routes, selectedRoute, selectedPattern]);

  const carLayers = useMemo(() => {
    const toFC = (segments = []) => ({
      type: "FeatureCollection",
      features: (segments || []).map((g) => ({
        type: "Feature",
        geometry: g.geometry,
        properties: { seq: g.seq, link_id: g.link_id, section_id: g.section_id, road_name: g.road_name },
      })),
    });

    const out = [];
    routes.forEach((r) => {
      if (selectedRoute !== ALL && r.route_id !== selectedRoute) return;
      const col = r.route_keyword_color || "#000";
      (r.route_patterns || []).forEach((p) => {
        if (selectedRoute !== ALL && selectedPattern !== ALL && p.pattern_id !== selectedPattern) return;
        out.push({
          key: `${r.route_id}|${p.pattern_id}`,
          route_id: r.route_id,
          color: col,
          geojson: toFC(p.car_path?.segments),
          segments: p.car_path?.segments || [],
          start: p.start,
          end: p.end,
          pattern_id: p.pattern_id,
          shape_id: p.shape_id,
          direction_id: p.direction_id,
        });
      });
    });
    return out;
  }, [routes, selectedRoute, selectedPattern]);

  const MAP_HEIGHT = 560;

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <TopFilterBar
        data={data}
        selectedRoute={selectedRoute}
        setSelectedRoute={(rid) => {
          setSelectedRoute(rid);
          setSelectedKey(null);
        }}
        selectedPattern={selectedPattern}
        setSelectedPattern={(pid) => {
          setSelectedPattern(pid);
          setSelectedKey(pid === ALL ? null : `${selectedRoute}|${pid}`);
        }}
      />

      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: { xs: "wrap", md: "nowrap" },
          alignItems: "stretch",
        }}
      >
      
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 0, overflow: "hidden" }}
        >
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            {strings.panels.carCandidates}
          </Typography>
          <CarCandidatesMap
            carLayers={carLayers}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            height={MAP_HEIGHT}
          />
        </Paper>
        
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 0, overflow: "hidden" }}
        >
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            {strings.panels.busRoutes}
          </Typography>
          <BusMap
            busLayers={busLayers}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            height={MAP_HEIGHT}
          />
        </Paper>

      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={clearError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled">
          {String(error)}
        </Alert>
      </Snackbar>
    </Box>
  );
}
