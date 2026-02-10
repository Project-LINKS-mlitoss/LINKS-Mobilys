import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Paper,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  Stack,
  Button,
  Slider,
} from "@mui/material";
import ChartBoardingAlighting from "./RoutesVisualizationChart";
import { VISUALIZATION } from "@/strings";

/** Helpers */
const normalizeText = (v) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v;

const normalizeRouteId = (v) => {
  if (typeof v !== "string") return v;
  return v.replace(/\s+/g, " ").trim();
};

function getRouteKeyword(row) {
  const v = row?.route_keyword ?? row?.keyword ?? row?.route_group ?? "";
  return normalizeText(v);
}

/**
 * Props:
 *  - metric: "in_car" | "boarding" | "alighting"
 *  - onChange: (filter) => void   
 *  - boardingAlightingData
 *  - boardingAlightingResult
 *  - routeGroupOptions
 *  - keywordRoutesMap
 *  - routeTripsMap
 *  - disabled?: boolean
 */
export default function RoutesVisualization({
  disabled = false,
  metric,
  boardingAlightingData,
  onChange,
  boardingAlightingResult,
  routeGroupOptions = [],
  keywordRoutesMap = {},
  routeTripsMap = {},
  scenarioName,
}) {
  /** Route group options */
  const rawGroupList = useMemo(() => {
    const list = (routeGroupOptions || []).filter(Boolean).map(normalizeText);
    return Array.from(new Set(list));
  }, [routeGroupOptions]);

  const [selectedRouteGroup, setSelectedRouteGroup] = useState("");
  useEffect(() => {
    if (!rawGroupList.length) {
      setSelectedRouteGroup("");
      return;
    }
    setSelectedRouteGroup((curr) =>
      curr && rawGroupList.includes(curr) ? curr : rawGroupList[0]
    );
  }, [rawGroupList]);

  /** Date options */
  const dateOptions = useMemo(() => {
    const dates = Array.isArray(boardingAlightingData)
      ? Array.from(new Set(boardingAlightingData.map((d) => d?.date).filter(Boolean)))
      : [];
    return [VISUALIZATION.common.filters.all, ...dates];
  }, [boardingAlightingData]);


  const [date, setDate] = useState(VISUALIZATION.common.filters.all);
  const [timeRange, setTimeRange] = useState([0, 24]); // [startHour, endHour]

  /** Route & Trip options */
  const routeOptions = useMemo(() => {
    const direct = keywordRoutesMap[selectedRouteGroup];
    const keyFallback =
      direct ||
      keywordRoutesMap[
        Object.keys(keywordRoutesMap || {}).find(
          (k) => normalizeText(k) === selectedRouteGroup
        ) || ""
      ];

    const fromMap = keyFallback;

    if (Array.isArray(fromMap) && fromMap.length) {
      const uniq = new Map();
      fromMap.forEach((r) => {
        const rawId = r?.route_id;
        const id = normalizeRouteId(rawId);
        if (!id) return;
        if (!uniq.has(id)) {
          uniq.set(id, { id, name: r?.route_name || id });
        }
      });
      return [
        { id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all },
        ...Array.from(uniq.values()),
      ];
    }

    if (!Array.isArray(boardingAlightingData)) {
      return [{ id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all }];
    }
    const byGroup = selectedRouteGroup
      ? boardingAlightingData.filter((d) => getRouteKeyword(d) === selectedRouteGroup)
      : boardingAlightingData;

    const uniq = new Map();
    byGroup.forEach((d) => {
      const id = normalizeRouteId(d?.route_id);
      if (!id) return;
      if (!uniq.has(id)) uniq.set(id, { id, name: id });
    });

    return [
      { id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all },
      ...Array.from(uniq.values()),
    ];
  }, [selectedRouteGroup, keywordRoutesMap, boardingAlightingData]);

  const [selectedRouteId, setSelectedRouteId] = useState(VISUALIZATION.common.filters.all);
  const [selectedTripId, setSelectedTripId] = useState(VISUALIZATION.common.filters.all);

  useEffect(() => {
    setSelectedRouteId(VISUALIZATION.common.filters.all);
    setSelectedTripId(VISUALIZATION.common.filters.all);
  }, [selectedRouteGroup]);

  useEffect(() => {
    if (!routeOptions.length) return;
    const ids = routeOptions.map((r) => r.id);
    if (!ids.includes(selectedRouteId)) {
      setSelectedRouteId(VISUALIZATION.common.filters.all);
      setSelectedTripId(VISUALIZATION.common.filters.all);
    }
  }, [routeOptions, selectedRouteId]);

  useEffect(() => {
    setSelectedTripId(VISUALIZATION.common.filters.all);
  }, [selectedRouteId, selectedRouteGroup]);

  const tripOptions = useMemo(() => {
    const keyword = selectedRouteGroup;
    if (!keyword || !selectedRouteId || selectedRouteId === VISUALIZATION.common.filters.all) {
      return [{ id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all }];
    }
    const routesArr = routeTripsMap[keyword];
    if (!Array.isArray(routesArr)) {
      return [{ id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all }];
    }
    const routeObj = routesArr.find(
      (r) => normalizeRouteId(r.route_id) === normalizeRouteId(selectedRouteId)
    );
    if (!routeObj || !Array.isArray(routeObj.valid_trip_ids)) {
      return [{ id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all }];
    }
    return [
      { id: VISUALIZATION.common.filters.all, name: VISUALIZATION.common.filters.all },
      ...routeObj.valid_trip_ids.map((tid) => ({ id: tid, name: tid })),
    ];
  }, [routeTripsMap, selectedRouteGroup, selectedRouteId]);

  /** Format helper for date option label */
  function formatDateOption(dateStr) {
    if (!dateStr || dateStr === VISUALIZATION.common.filters.all) return dateStr;
    const y = String(dateStr).slice(0, 4);
    const m = String(dateStr).slice(4, 6);
    const d = String(dateStr).slice(6, 8);
    const dateObj = new Date(`${y}-${m}-${d}`);
    const dayKanji = VISUALIZATION.common.weekdays.short[dateObj.getDay()];
    return `${y}/${m}/${d} (${dayKanji})`;
  }

  const handleApplyFilter = () => {
    onChange?.({
      type: metric, 
      date: date, // "all" | "YYYYMMDD"
      time: timeRange, // [startHour, endHour]
      routeId:
        selectedRouteId === VISUALIZATION.common.filters.all
          ? VISUALIZATION.common.filters.all
          : normalizeRouteId(selectedRouteId),
      tripId: selectedTripId,
      routeGroup: selectedRouteGroup,
    });
  };

  /** Reset filter */
  const handleResetFilter = () => {
    setDate(VISUALIZATION.common.filters.all);
    setTimeRange([0, 24]);
    setSelectedRouteGroup(rawGroupList[0] || "");
    setSelectedRouteId(VISUALIZATION.common.filters.all);
    setSelectedTripId(VISUALIZATION.common.filters.all);
  };

  const chartData = useMemo(() => {
    const arr = boardingAlightingResult?.data?.graphs;
    if (!Array.isArray(arr)) return [];
    return arr.map((g) => {
      const stops = Array.isArray(g.graph_data)
        ? g.graph_data.map((stop) => ({
            stop: stop?.stop_name ?? "",
            boardings: Number(stop?.count_geton ?? 0),
            alightings: Number(stop?.count_getoff ?? 0),
            inVehicle: Number(stop?.count_in_bus ?? 0),
          }))
        : [];
      const trips = Array.isArray(g.trips)
        ? g.trips.map((t) => ({
            tripId: t?.trip_id ?? "",
            stops: Array.isArray(t?.graph_data)
              ? t.graph_data.map((stop) => ({
                  stop: stop?.stop_name ?? "",
                  boardings: Number(stop?.count_geton ?? 0),
                  alightings: Number(stop?.count_getoff ?? 0),
                  inVehicle: Number(stop?.count_in_bus ?? 0),
                }))
              : [],
          }))
        : [];
      return {
        route_ids: Array.isArray(g.route_ids) ? g.route_ids : [],
        route_names: Array.isArray(g.route_names) ? g.route_names : [],
        stops,
        trips,
      };
    });
  }, [boardingAlightingResult]);

  /** Slider marks */
  const timeMarks = [
    { value: 0, label: `0${VISUALIZATION.common.time.hourSuffix}` },
    { value: 6, label: `6${VISUALIZATION.common.time.hourSuffix}` },
    { value: 12, label: `12${VISUALIZATION.common.time.hourSuffix}` },
    { value: 18, label: `18${VISUALIZATION.common.time.hourSuffix}` },
    { value: 24, label: `24${VISUALIZATION.common.time.hourSuffix}` },
  ];
  const formatTimeRangeText = ([s, e]) => `${s}:00 - ${e}:00`;

  return (
    <>
      {/* === FORM === */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          {/* Time range */}
          <FormControl component="fieldset" disabled={disabled} sx={{ mb: 1 }}>
            <FormLabel sx={{ mb: 1, fontWeight: 500, fontSize: 15 }}>
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.timeRange}{" "}
              {formatTimeRangeText(timeRange)}
            </FormLabel>
            <Box sx={{ px: 1.5, py: 2 }}>
              <Slider
                value={timeRange}
                min={0}
                max={24}
                step={1}
                marks={timeMarks}
                disableSwap
                valueLabelDisplay="auto"
                getAriaLabel={() => "time range"}
                getAriaValueText={(v) => `${v}${VISUALIZATION.common.time.hourSuffix}`}
                valueLabelFormat={(v) => `${v}${VISUALIZATION.common.time.hourSuffix}`}
                onChange={(_, v) => {
                  if (Array.isArray(v)) setTimeRange(v);
                }}
                sx={{
                  "& .MuiSlider-thumb": { width: 24, height: 24 },
                  "& .MuiSlider-markLabel": { mt: 1 },
                }}
              />
            </Box>
          </FormControl>

          {/* Date */}
          <FormControl fullWidth disabled={disabled}>
            <FormLabel sx={{ mb: 1 }}>
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.date}
            </FormLabel>
            <Select value={date} onChange={(e) => setDate(e.target.value)}>
              {dateOptions.length > 0
                ? dateOptions.map((d) => (
                    <MenuItem key={d} value={d}>
                      {formatDateOption(d)}
                    </MenuItem>
                  ))
                : (
                  <MenuItem value={date}>{formatDateOption(date)}</MenuItem>
                )}
            </Select>
          </FormControl>

          {/* Route Group */}
          <FormControl fullWidth disabled={disabled}>
            <InputLabel id="route-group-label">
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.routeGroup}
            </InputLabel>
            <Select
              labelId="route-group-label"
              label={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.routeGroup}
              value={selectedRouteGroup}
              onChange={(e) => setSelectedRouteGroup(e.target.value)}
            >
              {rawGroupList.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Route */}
          <FormControl fullWidth disabled={disabled}>
            <InputLabel id="route-label">
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.route}
            </InputLabel>
            <Select
              labelId="route-label"
              label={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.route}
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
            >
              {routeOptions.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Trip */}
          {selectedRouteId && selectedRouteId !== VISUALIZATION.common.filters.all && (
            <FormControl fullWidth disabled={disabled}>
              <InputLabel id="trip-label">
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.tripId}
              </InputLabel>
              <Select
                labelId="trip-label"
                label={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.form.tripId}
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
              >
                {tripOptions.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Apply & Reset Buttons */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              sx={{
                flex: 1,
                py: 1.5,
                fontWeight: 700,
                fontSize: 16,
                bgcolor: "#fff",
                borderColor: "#1976d2",
                color: "#1976d2",
                "&:hover": {
                  bgcolor: "#f5f5f5",
                  borderColor: "#1565c0",
                  color: "#1565c0",
                },
              }}
              onClick={handleResetFilter}
              disabled={disabled}
            >
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.actions.reset}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              sx={{
                flex: 1,
                py: 1.5,
                bgcolor: "#1976d2",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                "&:hover": { bgcolor: "#1565c0" },
              }}
              onClick={handleApplyFilter}
              disabled={disabled}
            >
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.actions.calculate}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* === CHART === */}
      {Array.isArray(chartData) && chartData.length > 0 ? (
        chartData.map((data, idx) => (
          <ChartBoardingAlighting
            key={idx}
            chartData={data.stops}
            routeId={data.route_ids}
            routeName={data.route_names}
            tripSeries={data.trips}
            scenarioName={scenarioName}
          />
        ))
      ) : (
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, mb: 2, textAlign: "center" }}
        >
          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualization.emptyState}
        </Paper>
      )}
    </>
  );
}
