// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { VISUALIZATION } from "@/strings";

const ZERO_COLOR = "#bdbdbd";

// Percentile-based dynamic buckets for vis=0 (sum/origin/dest)
function buildDynamicBuckets(values, percentiles = [0, 0.2, 0.4, 0.6, 0.8, 0.95, 1]) {
  const vals = (values || [])
    .filter((v) => Number.isFinite(v) && v >= 1)
    .sort((a, b) => a - b);
  if (!vals.length) return [];

  const q = (p) => {
    if (vals.length === 1) return vals[0];
    const idx = Math.min(vals.length - 1, Math.max(0, Math.round(p * (vals.length - 1))));
    return vals[idx];
  };

  // dedupe bounds
  const rawBounds = percentiles.map(q);
  const bounds = [];
  for (let b of rawBounds) {
    const last = bounds[bounds.length - 1];
    if (last === undefined || b !== last) bounds.push(b);
  }
  if (bounds.length === 1) return [{ min: bounds[0], max: bounds[0], label: String(bounds[0]) }];

  const buckets = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = Math.floor(bounds[i]);
    const end = Math.floor(bounds[i + 1]);
    if (i === bounds.length - 2) {
      buckets.push({ min: start, max: Infinity, label: `≥ ${start}` });
    } else {
      const a = start;
      const b = Math.max(a, end);
      buckets.push({ min: a, max: b, label: `${a} - ${b}` });
    }
  }
  return buckets;
}

// size legend bullets (log-ish)
function makeSizeFor(buckets, rangeMin = 1, rangeMax = 5000, minSize = 5, maxSize = 12) {
  const vals = (buckets || []).map((d) => d.min).filter((v) => v > 0);
  const vMin = vals.length ? Math.min(...vals, rangeMin) : 1;
  const vMax = vals.length ? Math.max(...vals, rangeMax) : 1;
  if (vMin <= 0 || vMax <= 0) return () => minSize;
  const logMin = Math.log(vMin);
  const logMax = Math.log(vMax);
  return (v) => {
    if (v <= 0) return minSize;
    const t = (Math.log(v) - logMin) / Math.max(1e-6, logMax - logMin);
    return Math.round(minSize + (maxSize - minSize) * t);
  };
}

// quantile-ish legend for bus OD (vis=2)
function makeLegendBuckets(values, n = 5) {
  if (!values.length) return Array.from({ length: n }, () => ({ from: 0, to: 0 }));
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
  const qs = [0, 0.25, 0.5, 0.75, 1].map(q);
  const ranges = [
    { from: qs[0], to: qs[1] },
    { from: qs[1], to: qs[2] },
    { from: qs[2], to: qs[3] },
    { from: qs[3], to: qs[4] - 0 },
    { from: qs[4], to: qs[4] },
  ];
  return ranges.map((r) => ({ from: Math.round(r.from), to: Math.round(r.to) }));
}

const BLUE_SCALE = ["#3f51b5", "#5c6bc0", "#7986cb", "#9fa8da", "#c5cae9"];

const TABLE_HEAD_SX = {
  "& .MuiTableCell-root": {
    backgroundColor: "#ffffff",
    color: "#000000",
    borderBottom: "1px solid rgba(0,0,0,0.1)",
  },
};

// ===================== reusable shells =====================
const Bullet = ({ size = 8, color = "#FB8C00" }) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      bgcolor: color,
      flex: "0 0 auto",
    }}
  />
);

function LegendCard({ title, minWidth = 200, onClose, children }) {
  return (
    <Paper
      className="map-legend-card"
      elevation={0}
      variant="outlined"
      sx={{
        p: 1,
        backgroundColor: "#ffffff",
        color: "#000000",
        borderRadius: 2,
        // simple border instead of heavy shadow – avoids odd grey bands
        boxShadow: "none",
        borderColor: "none",
        minWidth,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5, backgroundColor: "#ffffff" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <IconButton
          size="small"
          aria-label={VISUALIZATION.common.dialog.close}
          title={VISUALIZATION.common.dialog.close}
          onClick={onClose}
          sx={{ width: 24, height: 24, borderRadius: 1}}
        >
          <CloseIcon sx={{ fontSize: 16, color: "#666" }} />
        </IconButton>
      </Box>
      {children}
    </Paper>
  );
}


export default function LegendsDock({
  open,                     // boolean: !legendMinimized
  onClose,                  // function: setLegendMinimized(true)
  anchorRight = 100,
  anchorBottom = 24,
  zIndex = 2000,
  selectedVisualization,    // 0 | 1 | 2

  // === vis=0 props ===
  odUsage = {
    mode: "sum",            // "sum" | "origin" | "dest"
    points: [],             // [{ val, on, off }]
    markerColor: undefined, // optional, hex
  },

  // === vis=1 parent props ===
  lastFirst = {
    mode: "first_stop",     // "first_stop" | "last_stop"
    points: [],             // [{ val }]
  },

  // === vis=1 child props ===
  lastFirstChild = {
    mode: "first_stop",
    feature: null,          // GeoJSON feature with properties.child_features
  },

  // === vis=2 props ===
  busOD = {
    lines: [],              // [{ count }]
  },

  collapseIn = true,        
}) {
  if (!open) return null;

  // ===== vis=0 compute =====
  const odModeTitle =
    odUsage.mode === "origin"
      ? VISUALIZATION.odAnalysis.components.common.labels.boardingCount
      : odUsage.mode === "dest"
        ? VISUALIZATION.odAnalysis.components.common.labels.alightingCount
        : VISUALIZATION.common.labels.total;

  const markerColor =
    odUsage.markerColor ||
    (odUsage.mode === "origin" ? "#1976d2" : odUsage.mode === "dest" ? "#e53935" : "#FB8C00");

  const odVals = useMemo(
    () => (odUsage.points || []).map((p) => Number(p?.val ?? 0)).filter((v) => Number.isFinite(v)),
    [odUsage.points]
  );
  const totalPoints = odUsage.points?.length || 0;
  const zeroCount = useMemo(() => (odUsage.points || []).filter((p) => (p?.val ?? 0) === 0).length, [odUsage.points]);
  const zeroPercent = totalPoints > 0 ? ((zeroCount / totalPoints) * 100).toFixed(1) : "0.0";
  const odBuckets = useMemo(() => buildDynamicBuckets(odVals), [odVals]);
  const sizeForLegend = useMemo(() => {
    const minV = Math.max(1, Math.min(...odVals, Infinity));
    const maxV = Math.max(1, Math.max(...odVals, 1));
    return makeSizeFor(odBuckets, minV, maxV);
  }, [odBuckets, odVals]);

  const getLegendCountDynamic = (bucket, nextMin) => {
    if (!Number.isFinite(bucket?.max)) {
      return (odUsage.points || []).filter((p) => (p?.val ?? 0) >= bucket.min).length;
    }
    const upper = Number.isFinite(nextMin) ? nextMin : (Number.isFinite(bucket.max) ? bucket.max + 1e-9 : Infinity);
    return (odUsage.points || []).filter((p) => (p?.val ?? 0) >= bucket.min && (p?.val ?? 0) < upper).length;
  };

  // ===== vis=1 compute =====
  const lastFirstColor = lastFirst.mode === "first_stop" ? "#1976d2" : "#e53935";
  const nonZeroLF = (lastFirst.points || []).filter((p) => (p?.val ?? 0) > 0).length;
  const zeroLF = (lastFirst.points || []).filter((p) => (p?.val ?? 0) === 0).length;

  const childBuckets = useMemo(() => {
    const cf = lastFirstChild?.feature?.properties?.child_features || [];
    const childTotals = cf.map((c) => Number(c?.properties?.total ?? 0)).filter((v) => Number.isFinite(v));
    if (!childTotals.length) return [];
    const min = Math.min(...childTotals);
    const max = Math.max(...childTotals);
    const step = Math.ceil((max - min) / 4) || 1;
    const arr = [];
    for (let i = 0; i < 4; i++) {
      const start = min + i * step;
      const end = i === 3 ? max : start + step - 1;
      arr.push({ min: start, max: end, label: `${start} - ${end}` });
    }
    return arr;
  }, [lastFirstChild?.feature]);

  // ===== vis=2 compute =====
  const busVolumes = useMemo(() => (busOD.lines || []).map((l) => Number(l?.count ?? 0)), [busOD.lines]);
  const busBuckets = useMemo(() => makeLegendBuckets(busVolumes, 5), [busVolumes]);
  const getBusBucketCount = (bucket) =>
    (busOD.lines || []).filter((l) => (l?.count ?? 0) >= bucket.from && (l?.count ?? 0) <= bucket.to).length;

  const isChildActive = !!(lastFirstChild?.feature);

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: anchorBottom,
        right: anchorRight,      
        zIndex,
        pointerEvents: "auto",
      }}
    >
      {/* vis=0: OD Usage Distribution */}
      {selectedVisualization === 0 && (
        <LegendCard title={odModeTitle} minWidth={220} onClose={onClose}>
          <Collapse in={collapseIn}>
            <Table size="small" aria-label="legend">
              <TableHead sx={{
                  "& .MuiTableCell-root": {
                    backgroundColor: "#ffffff",  // header row pure white
                  },
                }}
              >
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.caption}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.users}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.matchedStops}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zeroCount > 0 && (
                  <TableRow>
                    <TableCell align="center">
                      <Bullet size={8} color={ZERO_COLOR} />
                    </TableCell>
                    <TableCell>0</TableCell>
                    <TableCell>
                      {zeroCount}
                      {VISUALIZATION.odAnalysis.components.legend.units.items}（{zeroPercent}%）
                    </TableCell>
                  </TableRow>
                )}
                {odBuckets.map((bucket, idx) => {
                  const nextMin = idx === odBuckets.length - 1 ? Infinity : odBuckets[idx + 1].min;
                  const count = getLegendCountDynamic(bucket, nextMin);
                  const percent = totalPoints > 0 ? ((count / totalPoints) * 100).toFixed(1) : "0.0";
                  return (
                    <TableRow key={`${bucket.label}-${idx}`}>
                      <TableCell align="center">
                        <Bullet size={sizeForLegend(bucket.min)} color={markerColor} />
                       </TableCell>
                       <TableCell>{bucket.label}</TableCell>
                       <TableCell>
                         {count}
                         {VISUALIZATION.odAnalysis.components.legend.units.items}（{percent}%）
                       </TableCell>
                     </TableRow>
                   );
                 })}
              </TableBody>
            </Table>
          </Collapse>
        </LegendCard>
      )}

      {/* vis=1: parent/child */}
      {selectedVisualization === 1 && !isChildActive && (
        <LegendCard title="" minWidth={200} onClose={onClose}>
          <Collapse in={collapseIn}>
            <Table size="small">
              <TableHead sx={{
                  "& .MuiTableCell-root": {
                    backgroundColor: "#ffffff",  // header row pure white
                  },
                }}
              >
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.caption}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.users}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.stops}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell align="center">
                    <Bullet size={10} color={lastFirstColor} />
                  </TableCell>
                  <TableCell>{"> 0"}</TableCell>
                  <TableCell>
                    {nonZeroLF}
                    {VISUALIZATION.odAnalysis.components.legend.units.items}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell align="center">
                    <Bullet size={10} color={ZERO_COLOR} />
                  </TableCell>
                  <TableCell>0</TableCell>
                  <TableCell>
                    {zeroLF}
                    {VISUALIZATION.odAnalysis.components.legend.units.items}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Collapse>
        </LegendCard>
      )}

      {selectedVisualization === 1 && isChildActive && (
        <LegendCard title="" minWidth={200} onClose={onClose}>
          <Collapse in={collapseIn}>
            <Table size="small">
              <TableHead 
                sx={{
                  "& .MuiTableCell-root": {
                    backgroundColor: "#ffffff",
                  },
                }}    
              >
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.caption}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.users}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.matchedStops}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const cf = lastFirstChild?.feature?.properties?.child_features || [];
                  if (!childBuckets.length) return null;
                  return childBuckets.map((bucket) => {
                    const count = cf.filter((c) => {
                      const total = Number(c?.properties?.total ?? 0);
                      return total >= bucket.min && total <= bucket.max;
                    }).length;
                    const bulletSize = Math.max(6, Math.min(18, Math.sqrt(bucket.max) * 2));
                    const bulletColor = lastFirstChild.mode === "first_stop" ? "#e53935" : "#1976d2";
                     return (
                       <TableRow key={bucket.label}>
                         <TableCell align="center">
                           <Bullet size={bulletSize} color={bulletColor} />
                         </TableCell>
                         <TableCell>{bucket.label}</TableCell>
                         <TableCell>
                           {count}
                           {VISUALIZATION.odAnalysis.components.legend.units.items}
                         </TableCell>
                       </TableRow>
                     );
                   });
                 })()}
              </TableBody>
            </Table>
          </Collapse>
        </LegendCard>
      )}

      {/* vis=2: Bus stop OD */}
      {selectedVisualization === 2 && (
        <LegendCard title={VISUALIZATION.odAnalysis.components.legend.busStopTitle} minWidth={260} onClose={onClose}>
          <Collapse in={collapseIn}>
            <Table size="small">
              <TableHead 
                sx={{
                  "& .MuiTableCell-root": {
                    backgroundColor: "#ffffff",
                  },
                }}
              >
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 80 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.caption}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.users}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.odAnalysis.components.legend.headers.lineCount}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  if (!busBuckets.length) return null;
                  const allZero = busBuckets.length > 1 && busBuckets.every((x) => x.from === 0 && x.to === 0);
                  return busBuckets.map((b, i, arr) => {
                    const count = getBusBucketCount(b);
                    const lineWeight = 2 + Math.round(8 * (i / Math.max(1, arr.length - 1)));
                    if (allZero) {
                      if (i > 0) return null;
                      return (
                        <TableRow key={i}>
                          <TableCell>
                           <Box sx={{ width: 42, height: lineWeight, borderRadius: 1, bgcolor: BLUE_SCALE[0] }} />
                          </TableCell>
                          <TableCell>0 - 0</TableCell>
                          <TableCell>
                            {busOD.lines?.length || 0}
                            {VISUALIZATION.odAnalysis.components.legend.units.lines}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Box sx={{ width: 42, height: lineWeight, borderRadius: 1, bgcolor: BLUE_SCALE[i] }} />
                        </TableCell>
                        <TableCell>{b.from} - {b.to}</TableCell>
                        <TableCell>
                          {count}
                          {VISUALIZATION.odAnalysis.components.legend.units.lines}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </Collapse>
        </LegendCard>
      )}
    </Box>
  );
}
