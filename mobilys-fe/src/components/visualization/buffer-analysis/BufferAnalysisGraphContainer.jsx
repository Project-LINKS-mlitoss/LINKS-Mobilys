// src/components/visualization/buffer-analysis/BufferAnalysisGraphContainer.jsx
import React, { useMemo } from "react";
import { Box, Grid, Paper } from "@mui/material";

import RouteAndStopBufferAnalysisGraph from "./graph/RouteAndStopBufferAnalysisGraph";
import StopBufferGraph from "./graph/StopBufferGraph";
import POIBufferGraph from "./graph/POIBufferGraph";
import PopulationGraph from "./graph/PopulationGraph";
import { VISUALIZATION } from "@/strings";

export default function BufferAnalysisGraphContainer({
  populationWithinBuffer,
  dataByCutoff,
  data,
  activeCutoffIdx, // <-- connect to slider (0..8)
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
}) {
  // minutes scale (1..9 -> 10..90)
  const TIME_INTERVALS = useMemo(
    () => Array.from({ length: 9 }, (_, i) => (i + 1) * 10),
    []
  );

  // Slider index -> active minutes (null = show all)
  const activeMinutes =
    typeof activeCutoffIdx === "number" && activeCutoffIdx >= 0
      ? TIME_INTERVALS[Math.min(activeCutoffIdx, TIME_INTERVALS.length - 1)]
      : null;

  // Normalize cutoff_time (accept seconds or minutes; fallback to seconds)
  const toMinutesOrRaw = (raw, fallbackMin) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return (fallbackMin ?? 0) * 60; // seconds
    return n >= 600 ? n : Math.round(n) * 60; // store as seconds consistently
  };

  const buckets = useMemo(() => {
    const arr = Array.isArray(dataByCutoff) ? dataByCutoff : [];
    const source = arr.length > 0 ? arr : (data ? [data] : []);

    return source.map((d, i) => {
      const fallbackMin =
        TIME_INTERVALS[i] ?? TIME_INTERVALS[TIME_INTERVALS.length - 1];
      const cutoff_time = toMinutesOrRaw(d?.cutoff_time, fallbackMin);

      // --- Route & Stops
      const routesBucket = {
        cutoff_time,
        routes_data:
          d?.route_and_stops ??
          d?.routes_data ??
          d?.routeAndStopGraphData ??
          [],
      };

      // --- Stops
      const stopsSrc =
        d?.stops_on_buffer_area ||
        d?.stops ||
        d?.stopData ||
        {};
      const stopsBucket = {
        cutoff_time,
        grouping_method: stopsSrc?.grouping_method,
        stops: stopsSrc?.stops || [],
      };

      // --- POIs
      const poiBucket = {
        cutoff_time,
        poi_by_type:
          d?.POI_on_buffer_area || d?.POIGraphData || d?.poi_by_type || [],
      };

      // --- Population (keep as-is; flatten later)
      const populationBucket = d;

      return {
        routesBucket,
        stopsBucket,
        poiBucket,
        populationBucket,
      };
    });
  }, [dataByCutoff, data, TIME_INTERVALS]);

  // Build full arrays
  const routeAndStopDataAll = useMemo(
    () => buckets.map((b) => b.routesBucket),
    [buckets]
  );
  const stopDataAll = useMemo(
    () => buckets.map((b) => b.stopsBucket),
    [buckets]
  );
  const poiData = useMemo(() => buckets.map((b) => b.poiBucket), [buckets]);

  // Visible count based on slider (1..9). If slider is unset, show all.
  const visibleCount =
    typeof activeMinutes === "number"
      ? Math.max(1, Math.min(TIME_INTERVALS.length, Math.round(activeMinutes / 10)))
      : undefined;

  // Slice arrays up to the active cutoff so they follow the slider
  const routeAndStopData = useMemo(() => {
    return typeof visibleCount === "number"
      ? routeAndStopDataAll.slice(0, visibleCount)
      : routeAndStopDataAll;
  }, [routeAndStopDataAll, visibleCount]);

  const stopData = useMemo(() => {
    return typeof visibleCount === "number"
      ? stopDataAll.slice(0, visibleCount)
      : stopDataAll;
  }, [stopDataAll, visibleCount]);

  // ---------------- Population: flatten ages + slice by visibleCount ----------------
  const populationBucketsAll = useMemo(() => {
    const src =
      (Array.isArray(populationWithinBuffer) && populationWithinBuffer.length
        ? populationWithinBuffer
        : (Array.isArray(data?.population) && data.population.length
            ? data.population
            : (Array.isArray(dataByCutoff) && dataByCutoff.length
                ? dataByCutoff
                : data
                ? [data]
                : []))) || [];

    return src
      .filter(Boolean)
      .map((d, i) => {
        // unwrap common keys (and { data: ... } if present)
        const base =
          d?.population ??
          d?.population_within_buffer ??
          d?.populationWithinBuffer ??
          d?.population_on_buffer_area ??
          d?.data ??
          d;

        const p = Array.isArray(base) ? base[0] : base;

        const cutoff_time = toMinutesOrRaw(
          p?.cutoff_time ?? d?.cutoff_time,
          TIME_INTERVALS[i] ?? TIME_INTERVALS[TIME_INTERVALS.length - 1]
        );

        // Flatten ages to TOP-LEVEL for the chart
        const age_0_14 = Number(p?.age_0_14 ?? p?.age0_14 ?? 0) || 0;
        const age_15_64 = Number(p?.age_15_64 ?? p?.age15_64 ?? 0) || 0;
        const age_65_up = Number(p?.age_65_up ?? p?.age65_up ?? 0) || 0;

        return {
          cutoff_time,
          age_0_14,
          age_15_64,
          age_65_up,
          population: { age_0_14, age_15_64, age_65_up },
          ...d,
        };
      });
  }, [populationWithinBuffer, dataByCutoff, data, TIME_INTERVALS]);

  const populationBuckets = useMemo(() => {
    return typeof visibleCount === "number"
      ? populationBucketsAll.slice(0, visibleCount)
      : populationBucketsAll;
  }, [populationBucketsAll, visibleCount]);
  // ---------------------------------------------------------------------

  // --------- NEW: Show "no data" placeholder when everything is empty ----------
  const noBuckets = buckets.length === 0;

  const allGraphsEmpty =
    buckets.length > 0 &&
    routeAndStopDataAll.every(
      (b) => !Array.isArray(b.routes_data) || b.routes_data.length === 0
    ) &&
    stopDataAll.every(
      (b) => !Array.isArray(b.stops) || b.stops.length === 0
    ) &&
    poiData.every(
      (b) => !Array.isArray(b.poi_by_type) || b.poi_by_type.length === 0
    ) &&
    populationBucketsAll.every((p) => {
      const a = Number(p?.age_0_14 || 0);
      const b = Number(p?.age_15_64 || 0);
      const c = Number(p?.age_65_up || 0);
      return (a + b + c) === 0;
    });

  if (noBuckets || allGraphsEmpty) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          mb: 2,
          textAlign: "center",
        }}
      >
        {VISUALIZATION.common.emptyState.noResultsRunCalculation}
      </Paper>
    );
  }
  // ---------------------------------------------------------------------

  return (
    <Box sx={{ p: 1 }}>
      <Grid container spacing={2}>
        {/* 3) Total reachable stops */}
        <Grid item xs={12}>
          <StopBufferGraph data={stopData} activeMinutes={activeMinutes} scenarioName={scenarioName} />
        </Grid>

        {/* 1) Route + Stops */}
        {/* <Grid item xs={12}>
          <RouteAndStopBufferAnalysisGraph data={routeAndStopData} />
        </Grid> */}

        {/* 2) POI distribution */}
        <Grid item xs={12}>
          <POIBufferGraph data={poiData} activeMinutes={activeMinutes} scenarioName={scenarioName}/>
        </Grid>

        {/* 4) Population within reachable area by time */}
        <Grid item xs={12}>
          <PopulationGraph
            data={populationBuckets}
            visibleCount={visibleCount}
            scenarioName={scenarioName}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
