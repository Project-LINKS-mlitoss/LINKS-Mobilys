// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Collapse,
  IconButton,
  Typography,
  Button,
  Tooltip,
  TextField
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DeleteTripConfirmDialog from "./DeleteTripConfirmDialog";
import { EqualColGroup, cellTextSx } from "../../TableCols";
import { directionMap, formatRouteType } from "../../../constant/gtfs";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const ICON_COL_WIDTH = 48;        // expand/collapse columns
const CHECKBOX_COL_WIDTH = 40;    // leading checkbox column width in trips
const INDENT_PER_LEVEL = 10;      // consistent indent between levels



// Shared styles to keep checkbox column consistent (header + rows)
const checkboxCellSx = { width: CHECKBOX_COL_WIDTH, p: 0 };
const checkboxSx = { p: 0, m: 0 };
const centerBoxSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
};

// Two-line header label (JP + EN). EN space reserved even if empty.
function HeaderLabel({ jp, en }) {
  const hasEn = !!en && en.trim().length > 0;
  return (
    <Box>
      <Typography fontWeight="bold" fontSize={14} noWrap>
        {jp}
      </Typography>
      <Typography
        fontWeight="bold"
        fontSize={12}
        color="textSecondary"
        sx={{
          display: "block",
          lineHeight: "16px",
          minHeight: "16px",
          visibility: hasEn ? "visible" : "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {hasEn ? en : "x"}
      </Typography>
    </Box>
  );
}

// Two-line header label (JP + EN) with parent/child color logic
function TwoLineHeader({ jp, en, level = "parent" }) {
  const hasEn = !!en && en.trim().length > 0;
  const jpColor = level === "parent" ? "text.primary" : "#616161";
  const enColor = level === "parent" ? "text.secondary" : "#9e9e9e";
  return (
    <Box>
      <Typography fontWeight="bold" fontSize={14} noWrap color={jpColor}>
        {jp}
      </Typography>
      <Typography
        fontWeight="bold"
        fontSize={12}
        color={enColor}
        sx={{
          display: "block",
          lineHeight: "16px",
          minHeight: "16px",
          visibility: hasEn ? "visible" : "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {hasEn ? en : "x"}
      </Typography>
    </Box>
  );
}

const DeleteTripPatternTab = ({ tripData, scenarioId, onDelete, loadingEditTrips }) => {
  const [filter, setFilter] = useState("");
  const [openRows, setOpenRows] = useState({});
  const [openPatterns, setOpenPatterns] = useState({});
  const [selectedTrips, setSelectedTrips] = useState({});
  const [showDiscontinueDialog, setShowDiscontinueDialog] = useState(false);
  const [tripsToConfirm, setTripsToConfirm] = useState([]);

  const routes = tripData?.data || [];

  if (loadingEditTrips) {
    return <Typography>{MESSAGES.trip.loadingData}</Typography>;
  }

  const handleToggle = (routeId) => {
    setOpenRows((prev) => ({ ...prev, [routeId]: !prev[routeId] }));
  };

  const handlePatternToggle = (patternId) => {
    setOpenPatterns((prev) => ({ ...prev, [patternId]: !prev[patternId] }));
  };

  const handleTripSelect = (tripId) => {
    setSelectedTrips((prev) => ({ ...prev, [tripId]: !prev[tripId] }));
  };

  const handleSelectAllTrips = (trips) => {
    const allSelected = trips.every((t) => selectedTrips[t.trip_id]);
    const updated = { ...selectedTrips };
    trips.forEach((t) => {
      updated[t.trip_id] = !allSelected;
    });
    setSelectedTrips(updated);
  };

  const getSelectedTripInfos = () => {
    const selectedInfos = [];
    routes.forEach((route) => {
      (route.route_patterns || []).forEach((p) => {
        (p.trips || []).forEach((t) => {
          if (selectedTrips[t.trip_id]) {
            selectedInfos.push({
              trip_id: t.trip_id,
              direction_id: t.direction_id,
              service_id: t.service_id,
              trip_headsign: t.trip_headsign ?? "",
              departure_time: t.departure_time ?? "",
            });
          }
        });
      });
    });
    return selectedInfos;
  };

  const filteredRoutes = routes.filter((r) =>
    String(r.route_id || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
        <Button
          variant='outlined'
          size="small"
          color='primary'
          disabled={Object.values(selectedTrips).every((v) => !v)}
          onClick={() => {
            const selectedInfos = getSelectedTripInfos();
            if (selectedInfos.length === 0) return;
            setTripsToConfirm(selectedInfos);
            setShowDiscontinueDialog(true);
          }}>
          {BUTTONS.common.delete}
        </Button>
      </Box>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
        <TextField
          label={LABELS.common.routeId}
          variant='outlined'
          size='small'
          sx={{ mb: 2 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Box>

      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        {/* ===== LEVEL 0 (Routes) ===== */}
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <EqualColGroup cols={5} leadingPx={ICON_COL_WIDTH} />

          <TableHead>
            <TableRow>
              <TableCell /> {/* icon */}
              <TableCell><HeaderLabel jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} /></TableCell>
              <TableCell><HeaderLabel jp={LABELS.route.routeShortName} en={LABELS.gtfs.routeShortName} /></TableCell>
              <TableCell><HeaderLabel jp={LABELS.common.routeLongName} en={LABELS.gtfs.routeLongName} /></TableCell>
              <TableCell><HeaderLabel jp={LABELS.common.agencyId} en={LABELS.gtfs.agencyId} /></TableCell>
              <TableCell><HeaderLabel jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} /></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRoutes.map((route) => (
              <React.Fragment key={route.route_id}>
                <TableRow>
                  <TableCell sx={{ width: ICON_COL_WIDTH }}>
                    <IconButton size="small" onClick={() => handleToggle(route.route_id)}>
                      {openRows[route.route_id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={cellTextSx} title={route.route_id ?? ""}>{route.route_id}</TableCell>
                  <TableCell sx={cellTextSx} title={route.route_short_name ?? ""}>{route.route_short_name}</TableCell>
                  <TableCell sx={cellTextSx} title={route.route_long_name ?? ""}>{route.route_long_name || "-"}</TableCell>
                  <TableCell sx={cellTextSx} title={route.agency_id ?? ""}>{route.agency_id}</TableCell>
                  <TableCell sx={cellTextSx} title={String(route.route_type ?? "")}>{route.route_type}</TableCell>

                </TableRow>

                {(route.route_patterns?.length ?? 0) > 0 && (
                  <TableRow>
                    {/* indent child block */}
                    <TableCell colSpan={6} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                      <Collapse in={openRows[route.route_id]} timeout="auto" unmountOnExit>
                        {/* ===== LEVEL 1 (Patterns) ===== */}
                        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                          {/* pattern table also has an expand icon */}
                          <EqualColGroup cols={4} leadingPx={ICON_COL_WIDTH} />

                          <TableHead>
                            <TableRow>
                              <TableCell /> {/* icon */}
                              <TableCell><TwoLineHeader jp={LABELS.route.internalPatternId} en="" level="sub" /></TableCell>
                              <TableCell><TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} level="sub" /></TableCell>
                              <TableCell><TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} level="sub" /></TableCell>
                              <TableCell><TwoLineHeader jp={LABELS.common.section} en="" level="sub" /></TableCell>
                            </TableRow>
                          </TableHead>

                          <TableBody>
                            {route.route_patterns.map((p) => (
                              <React.Fragment key={p.pattern_id}>
                                <TableRow>
                                  <TableCell sx={{ width: ICON_COL_WIDTH }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handlePatternToggle(p.pattern_id)}
                                    >
                                      {openPatterns[p.pattern_id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                                    </IconButton>
                                  </TableCell>
                                  <TableCell sx={cellTextSx}>{p.pattern_id}</TableCell>
                                  <TableCell>
                                    <Tooltip
                                      title={
                                        p.trips.some((t) => t.is_direction_id_generated)
                                          ? MESSAGES.trip.systemGeneratedTooltip
                                          : directionMap[p.direction_id] || "-"
                                      }
                                      arrow
                                      enterTouchDelay={0}
                                    >
                                      <Box
                                        component="span"
                                        sx={{
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          display: "inline-block",
                                          maxWidth: 100,
                                          color: p.trips.some((t) => t.is_direction_id_generated)
                                            ? "#1E88E5"
                                            : "inherit",
                                          fontWeight: p.trips.some((t) => t.is_direction_id_generated)
                                            ? 700
                                            : "normal",
                                          cursor: "default",
                                        }}
                                      >
                                        {directionMap[p.direction_id] || "-"}
                                      </Box>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell sx={cellTextSx}>{p.service_id}</TableCell>
                                  <TableCell sx={cellTextSx}>{formatSectionLabel(p.segment) || "-"}</TableCell>
                                </TableRow>

                                {/* ===== LEVEL 2 (Trips) ===== */}
                                {(p.trips?.length ?? 0) > 0 && (
                                  <TableRow>
                                    {/* further indent */}
                                    <TableCell colSpan={5} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                                      <Collapse in={openPatterns[p.pattern_id]} timeout="auto" unmountOnExit>
                                        <Box sx={{ py: 1 }}>
                                          <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                                            <EqualColGroup cols={5} leadingPx={CHECKBOX_COL_WIDTH} />

                                            <TableHead>
                                              <TableRow>
                                                <TableCell sx={checkboxCellSx} align="center">
                                                  <Box sx={centerBoxSx}>
                                                    <Checkbox
                                                      size="small"
                                                      sx={checkboxSx}
                                                      indeterminate={
                                                        p.trips.some((t) => selectedTrips[t.trip_id]) &&
                                                        !p.trips.every((t) => selectedTrips[t.trip_id])
                                                      }
                                                      checked={
                                                        p.trips.length > 0 &&
                                                        p.trips.every((t) => selectedTrips[t.trip_id])
                                                      }
                                                      onChange={() => handleSelectAllTrips(p.trips)}
                                                    />
                                                  </Box>
                                                </TableCell>
                                                <TableCell><TwoLineHeader jp={LABELS.trip.tripId} en={LABELS.gtfs.tripId} level="sub" /></TableCell>
                                                <TableCell><TwoLineHeader jp={LABELS.trip.tripName} en={LABELS.gtfs.tripShortName} level="sub" /></TableCell>
                                                <TableCell><TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} level="sub" /></TableCell>
                                                <TableCell><TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} level="sub" /></TableCell>
                                                <TableCell><TwoLineHeader jp={LABELS.trip.tripHeadsign} en={LABELS.gtfs.tripHeadsign} level="sub" /></TableCell>
                                                <TableCell><TwoLineHeader jp={LABELS.trip.departureTime} en={LABELS.gtfs.departureTime} level="sub" /></TableCell>
                                              </TableRow>
                                            </TableHead>

                                            <TableBody>
                                              {p.trips.map((trip) => (
                                                <TableRow key={trip.trip_id}>
                                                  <TableCell sx={checkboxCellSx} align="center">
                                                    <Box sx={centerBoxSx}>
                                                      <Checkbox
                                                        size="small"
                                                        sx={checkboxSx}
                                                        checked={!!selectedTrips[trip.trip_id]}
                                                        onChange={() => handleTripSelect(trip.trip_id)}
                                                      />
                                                    </Box>
                                                  </TableCell>

                                                  <TableCell sx={cellTextSx}>{trip.trip_id}</TableCell>
                                                  <TableCell sx={cellTextSx}>{trip.trip_short_name}</TableCell>
                                                  <TableCell>
                                                    <Tooltip
                                                      title={
                                                        trip.is_direction_id_generated
                                                          ? MESSAGES.trip.systemGeneratedTooltip
                                                          : directionMap[trip.direction_id] || "-"
                                                      }
                                                      arrow
                                                      enterTouchDelay={0}
                                                    >
                                                      <Box
                                                        component="span"
                                                        sx={{
                                                          whiteSpace: "nowrap",
                                                          overflow: "hidden",
                                                          textOverflow: "ellipsis",
                                                          display: "inline-block",
                                                          maxWidth: 100,
                                                          color: trip.is_direction_id_generated
                                                            ? "#1E88E5"
                                                            : "inherit",
                                                          fontWeight: trip.is_direction_id_generated ? 700 : "normal",
                                                          cursor: "default",
                                                        }}
                                                      >
                                                        {directionMap[trip.direction_id] || "-"}
                                                      </Box>
                                                    </Tooltip>
                                                  </TableCell>
                                                  <TableCell sx={cellTextSx}>{trip.service_id}</TableCell>
                                                  <TableCell sx={cellTextSx}>{trip.trip_headways}</TableCell>
                                                  <TableCell sx={cellTextSx}>{trip.departure_time}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </Box>
                                      </Collapse>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <DeleteTripConfirmDialog
        open={showDiscontinueDialog}
        onClose={() => setShowDiscontinueDialog(false)}
        onConfirm={() => {
          const payload = Object.keys(selectedTrips); // array of trip_ids
          onDelete(scenarioId, payload);
          setShowDiscontinueDialog(false);
        }}
        trips={tripsToConfirm}
      />
    </Box>
  );
};

export default DeleteTripPatternTab;
