// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  CircularProgress,
  Button,
  Chip,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Divider,
} from "@mui/material";
import { VISUALIZATION } from "@/strings";
import { num, num1 } from "@/utils/number";

function Section({ title, children, sx }) {
  return (
    <Box sx={{ mb: 2.25, ...sx }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function KeyVal({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
      <Typography variant="body2" sx={{ color: "#000000" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * ClickDetailDialog
 * props:
 *  - open, mode: 'segment' | 'stop', loading, error, summary, onClose
 */
export default function ClickDetailDialog({
  open,
  mode,
  loading,
  error,
  summary,
  onClose,
}) {
  const isSegment = mode === "segment";
  const isStop = mode === "stop";

  // dynamic direction labels from stop names
  const AB = String(summary?.pair?.A ?? "A");
  const BA = String(summary?.pair?.B ?? "B");
  const labelAB = `${AB} → ${BA}`;
  const labelBA = `${BA} → ${AB}`;

  const tripsByRoute = useMemo(() => {
    const g = new Map();
    (summary?.trip_details || []).forEach((t) => {
      const rid = t?.route_id || "";
      if (!g.has(rid)) g.set(rid, []);
      g.get(rid).push(t);
    });
    g.forEach((list) =>
      list.sort((a, b) => String(a.trip_id).localeCompare(String(b.trip_id)))
    );
    return g;
  }, [summary]);

  return (
    <Dialog sx={{zIndex:10000}} open={!!open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isSegment ? (
          <>
            {AB} ↔ {BA}
            {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.titleSuffix}{" "}
          </>
        ) : (
          <>
            {summary?.label?.keyword}
            {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.titleSuffix}{" "}
          </>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Typography color="error" sx={{ py: 2 }}>
            {String(error)}
          </Typography>
        )}

        {!loading && !error && !!summary && (
          <>
            {/* ================= SEGMENT ================= */}
             {isSegment && (
              <Section
                title={
                  VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.sections
                    .segmentBreakdown
                }
                sx={{ mt: 0.5 }}
              >
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell rowSpan={2}>route_id</TableCell>
                        <TableCell align="center" colSpan={3}>{labelAB}</TableCell>
                        <TableCell align="center" colSpan={3}>{labelBA}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell align="right">
                          {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.table.tripCount}
                        </TableCell>
                        <TableCell align="right">
                          {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.table.average}
                        </TableCell>
                        <TableCell align="right">
                          {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.table.total}
                        </TableCell>
                        <TableCell align="right">
                          {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.table.tripCount}
                        </TableCell>
                        <TableCell align="right">
                          {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.table.average}
                        </TableCell>
                        <TableCell align="right">
                          {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.table.total}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(summary?.route_details || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ color: "#9ca3af" }}>
                            {VISUALIZATION.common.emptyState.noMatches}
                          </TableCell>
                        </TableRow>
                      )}
                      {(summary?.route_details || []).map((r, i) => {
                        const ab = r?.directions?.["A>B"] || {};
                        const ba = r?.directions?.["B>A"] || {};
                        return (
                          <TableRow key={`${r.route_id}-${i}`}>
                            <TableCell>{String(r.route_id ?? "-")}</TableCell>
                            <TableCell align="right">{num(ab.trip_count)}</TableCell>
                            <TableCell align="right">{num1(ab.avg_riders_per_segment)}</TableCell>
                            <TableCell align="right">{num(ab.sum_in_car)}</TableCell>
                            <TableCell align="right">{num(ba.trip_count)}</TableCell>
                            <TableCell align="right">{num1(ba.avg_riders_per_segment)}</TableCell>
                            <TableCell align="right">{num(ba.sum_in_car)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Section>
            )}

            {/* ================= STOP (unchanged, minimal) ================= */}
            {isStop && (
              <>
                <Section
                  title={
                    VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.sections
                      .overview
                  }
                  sx={{ p: 1.25, border: "1px solid #eee", borderRadius: 2 }}
                >
                    <KeyVal
                        label={
                          VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels
                            .routeCount
                        }
                        value={num(summary?.route_count)}
                    />
                    <KeyVal
                        label={
                          VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels
                            .tripCount
                        }
                        value={num(summary?.trip_count)}
                    />
                    <KeyVal
                        label={
                          VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels
                            .totalBoardings
                        }
                        value={num(summary?.totals?.boardings)}
                    />
                    <KeyVal
                        label={
                          VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels
                            .totalAlightings
                        }
                        value={num(summary?.totals?.alightings)}
                    />
                </Section>

                <Section
                  title={
                    VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.sections
                      .routeBreakdown
                  }
                >
                  {[...tripsByRoute.keys()].sort().map((rid) => {
                    const rows = tripsByRoute.get(rid) || [];
                    return (
                      <Box
                        key={rid || "no-route"}
                        sx={{
                          border: "1px solid #eee",
                          borderRadius: 2,
                          mb: 1.25,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            px: 1.25,
                            py: 1,
                            bgcolor: "#fafafa",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {rid}{" "}
                          </Typography>
                        </Box>

                        <Table
                          size="small"
                          aria-label="trips-of-route"
                          sx={{ "& td, & th": { py: 0.5 } }}
                        >
                          <TableHead>
                            <TableRow>
                              <TableCell>
                                {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels.tripId}
                              </TableCell>
                              <TableCell align="center">
                                {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels.boardings}
                              </TableCell>
                              <TableCell align="center">
                                {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels.alightings}
                              </TableCell>
                              <TableCell align="center">
                                {VISUALIZATION.boardingAlightingAnalysis.components.clickDetailDialog.labels.firstDeparture}
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} sx={{ color: "#9ca3af" }}>
                                  {VISUALIZATION.common.emptyState.noMatches}
                                </TableCell>
                              </TableRow>
                            )}
                            {rows.map((t, i) => (
                              <TableRow key={`${t.trip_id}-${i}`}>
                                <TableCell
                                  sx={{
                                    maxWidth: 240,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {String(t.trip_id ?? "-")}
                                </TableCell>
                                <TableCell align="center">{num(t.boarded)}</TableCell>
                                <TableCell align="center">{num(t.alighted)}</TableCell>
                                <TableCell align="center">
                                  {t.first_departure_time || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    );
                  })}
                  {tripsByRoute.size === 0 && (
                    <Typography variant="body2" sx={{ color: "#9ca3af" }}>
                      {VISUALIZATION.common.emptyState.noMatches}
                    </Typography>
                  )}
                </Section>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {VISUALIZATION.common.dialog.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}