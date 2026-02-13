// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Accordion, AccordionSummary, AccordionDetails,
  Typography, Box, Chip, Stack, Paper, Divider
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { directionMap } from "../../../constant/gtfs";
import { directionMapforTimeTable } from "../../../constant/gtfs";
import { VISUALIZATION } from "@/strings";

const StopChildTimeTable = ({
  stopData,
  serviceIds = [],
  directionId = "",
  startTime = "00:00:00",
  endTime = "23:59:59",
}) => {
  if (!stopData || !Array.isArray(stopData.route_groups)) return null;

  const toSec = (hhmmss) => {
    if (!hhmmss) return null;
    const [h, m, s] = hhmmss.split(":").map(Number);
    return h * 3600 + m * 60 + (Number.isFinite(s) ? s : 0);
  };
  const inRange = (t) => {
    const x = toSec(t);
    return x >= toSec(startTime) && x <= toSec(endTime);
  };
  const fmtMinutes = (mins) =>
    mins.length ? mins.map((m) => String(Number(m)).padStart(2, "0")).join(" ") : "—";
  const dirLabel = directionId || VISUALIZATION.common.filters.all;
  const timeLabel = `${startTime?.slice(0, 5)} ～ ${endTime?.slice(0, 5)}`;

  return (
    <Box sx={{ p: 2 }}>
     <Box>
        <Typography
          variant="h5"
          sx={{ display: "flex", alignItems: "baseline", gap: 1 }}
        >
          <Box component="span">{stopData.stop_name}</Box>
          <Box
            component="span"
            sx={{ typography: "body2", color: "text.secondary" }}
          >
            {stopData.stop_id}
          </Box>
          <Box component="span">{VISUALIZATION.routeTimetable.labels.stopTimetable}</Box>
        </Typography>
      </Box>

     

      <Box sx={{ mb: 2 }}>
        <Stack direction="row" flexWrap="wrap" spacing={1} alignItems="center">
          <Typography variant="body2">
            {VISUALIZATION.busRunningVisualization.components.filterPanel.title}:
          </Typography>
          <Chip
            label={`${VISUALIZATION.busRunningVisualization.components.filterPanel.direction}: ${dirLabel}`}
            size="small"
          />
          {serviceIds?.length ? (
            <Chip
              label={`${VISUALIZATION.busRunningVisualization.components.filterPanel.travelDayLabel}: ${serviceIds.join(" / ")}`}
              size="small"
            />
          ) : (
            <Chip
              label={`${VISUALIZATION.busRunningVisualization.components.filterPanel.travelDayLabel}: ${VISUALIZATION.common.filters.all}`}
              size="small"
            />
          )}
          <Chip
            label={`${VISUALIZATION.busRunningVisualization.components.graphPanel.axis.time}: ${timeLabel}`}
            size="small"
          />
        </Stack>
      </Box>

      {stopData.route_groups.map((group) => (
        <Accordion
          key={group.route_group_id}
          defaultExpanded
          sx={{ boxShadow: "none", border: "1px solid #e0e0e0", mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{group.route_group_name}</Typography>
          </AccordionSummary>

          <AccordionDetails sx={{ pt: 1 }}>
            {(group.routes || []).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {VISUALIZATION.common.emptyState.noMatches}
              </Typography>
            )}

            {(group.routes || []).map((route) => {
              // Collect patterns only from this route
              const patterns = (route.route_patterns || []).filter((p) => {
                const dirOk =
                  !directionId ||
                  (directionMap?.[p.direction_id] ?? String(p.direction_id)) === directionId;
                const svcOk =
                  !serviceIds?.length ||
                  serviceIds.includes(p.service_id) ||
                  (p.trips || []).some((t) => serviceIds.includes(t.service_id));
                return dirOk && svcOk;
              });

              // Build an hour->minutes map per pattern (route-scoped)
              const patternsHourMap = patterns.map((p) => {
                const hourMap = {};
                (p.trips || [])
                  .filter(
                    (t) =>
                      (!serviceIds?.length || serviceIds.includes(t.service_id)) &&
                      (!directionId ||
                        (directionMap?.[t.direction_id] ?? String(t.direction_id)) === directionId) &&
                      inRange(t.departure_time)
                  )
                  .forEach((t) => {
                    const [h, m] = t.departure_time.split(":");
                    (hourMap[h] ||= []).push(m);
                  });
                Object.keys(hourMap).forEach((h) =>
                  hourMap[h].sort((a, b) => Number(a) - Number(b))
                );
                return { pattern: p, hourMap };
              });

              // Union the hour keys from this route's patterns
              const hours = Array.from(
                new Set(patternsHourMap.flatMap(({ hourMap }) => Object.keys(hourMap)))
              ).sort((a, b) => Number(a) - Number(b));

              // Calculate total trip count for this route (sum of trip_count or trips.length)
              const totalTripCount = patterns.reduce(
                (sum, p) => sum + (p.trip_count ?? (p.trips?.length ?? 0)),
                0
              );
              return (
                <Box key={route.route_id} sx={{ mb: 3 }}>
                  {/* Header route */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.routeId}：{route.route_id}
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                      {VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency}: {totalTripCount}
                    </Typography>
                  </Typography>

                  {patterns.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {VISUALIZATION.common.emptyState.noMatches}
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        width: "100%",
                        overflowX: "auto",
                        pb: 1,
                        display: "grid",
                        gridTemplateColumns: `80px repeat(${patterns.length}, minmax(260px, 1fr))`,
                        gap: 1,
                        alignItems: "start",
                      }}
                    >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1,
                        mb: 1,
                        borderRadius: 1.5,
                        border: "1px solid #e0e0e0",
                        background: "#f6fffe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 44,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                        時刻
                      </Typography>
                    </Paper>
                      {patternsHourMap.map(({ pattern }) => (
  
                        <Paper
                          key={pattern.pattern_id}
                          elevation={0}
                          sx={{
                            p: 1,
                            mb: 1,
                            borderRadius: 1.5,
                            border: "1px solid #e0e0e0",
                            background: "#f6fffe",
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                            Pattern: {directionMapforTimeTable?.[pattern.direction_id] ?? String(pattern.direction_id)} / {pattern.service_id || "—"} / {pattern.segment || "—"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency}: {pattern.trip_count ?? (pattern.trips?.length ?? 0)}
                          </Typography>
                        </Paper>
                      ))}

                      {hours.length === 0 ? (
                        <Box
                          sx={{
                            gridColumn: `1 / span ${patterns.length + 1}`,
                            py: 2,
                            textAlign: "center",
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            指定の時間帯に一致するデータがありません。
                          </Typography>
                        </Box>
                      ) : (
                        hours.map((h, idx) => (
                          <React.Fragment key={`${route.route_id}-${h}`}>
                            <Box
                              sx={{
                                px: 1,
                                py: 1,
                                borderRadius: 1,
                                fontWeight: 700,
                                minHeight: 44,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                background: idx % 2 === 0 ? "#f5f5f5" : "transparent",
                              }}
                            >
                              {h}
                            </Box>
                            {patternsHourMap.map(({ pattern, hourMap }) => (
                              <Box
                                key={`${pattern.pattern_id}-${h}`}
                                sx={{
                                  px: 1,
                                  py: 1,
                                  borderRadius: 1,
                                  background: idx % 2 === 0 ? "#e8f5e9" : "#f1f8e9",
                                  minHeight: 44,
                                  display: "flex",
                                  alignItems: "center",
                                  textAlign: "right",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "keep-all",
                                }}
                              >
                                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                  {fmtMinutes(hourMap[h] || [])}
                                </Typography>
                              </Box>
                            ))}
                          </React.Fragment>
                        ))
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}

          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default StopChildTimeTable;
