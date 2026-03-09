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
  Radio,
  Typography,
  Button,
  Collapse,
  IconButton,
  TextField,
  Tooltip,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import EditRoutePatternConfirmDialog from "./EditRoutePatternConfirmDialog";
import { directionMap, formatRouteType } from "../../../constant/gtfs";
import { EqualColGroup, cellTextSx } from "../../TableCols";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const ICON_COL_WIDTH = 48; // expand/collapse column
const INDENT_PER_LEVEL = 10; // subtle indent for nested blocks

function EllipsizedCellWithTooltip({ title, children, sx }) {
  const tooltip = title ?? "";
  return (
    <TableCell sx={{ ...cellTextSx, ...sx }}>
      <Tooltip title={tooltip} arrow enterTouchDelay={0}>
        <Box
          component="span"
          sx={{
            display: "block",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {children ?? "-"}
        </Box>
      </Tooltip>
    </TableCell>
  );
}

// Two-line header label (JP + EN). EN space reserved even if empty.
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

const EditRoutePatternTab = ({ routeData, onUpdate, scenarioId }) => {
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [expandedPattern, setExpandedPattern] = useState(null);
  const [startIdx, setStartIdx] = useState(null);
  const [endIdx, setEndIdx] = useState(null);
  const [filter, setFilter] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [originalStops, setOriginalStops] = useState([]);
  const [trimmedStops, setTrimmedStops] = useState([]);
  const [selectedPatternInfo, setSelectedPatternInfo] = useState(null);

  const { routes = [], stops = [] } = routeData ?? {};

  const filteredRoutes = (routes ?? []).filter((route) =>
    String(route.route_id || "").toLowerCase().includes(filter.toLowerCase())
  );

  const handleStartChange = (index) => {
    setStartIdx(index);
    if (endIdx !== null && index >= endIdx) setEndIdx(null);
  };

  const handleEndChange = (index) => {
    setEndIdx(index);
    if (startIdx !== null && index <= startIdx) setStartIdx(null);
  };

  const handleTrimConfirm = (pattern) => {
    if (startIdx !== null && endIdx !== null) {
      setOriginalStops(pattern.stop_sequence);
      const trimmed = pattern.stop_sequence.slice(startIdx, endIdx + 1).map((stop) => {
        const stopDetail = stops.find((s) => s.id === stop.stop_id);
        return {
          ...stop,
          latlng: stopDetail?.latlng ?? [null, null],
        };
      });
      setTrimmedStops(trimmed);
      setSelectedPatternInfo({
        route_id: pattern.route_id,
        direction_id: pattern.direction_id,
        service_id: pattern.service_id,
        shape_id: pattern.shape_id,
      });
      setShowConfirmDialog(true);
    }
  };
  if (!routeData) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2">{MESSAGES.route.loadingData}</Typography>
      </Paper>
    );
  }
  return (
    <Box sx={{ px: 3, py: 2 }}>
      <TextField
        label={LABELS.common.routeId}
        variant="outlined"
        size="small"
        sx={{ mb: 2 }}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <TableContainer component={Paper}>
        {/* ===== LEVEL 0 (Routes) ===== */}
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <EqualColGroup cols={5} leadingPx={ICON_COL_WIDTH} trailingAuto={false} />

          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>
                <TwoLineHeader jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.route.routeShortName} en={LABELS.gtfs.routeShortName} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.common.routeLongName} en={LABELS.gtfs.routeLongName} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.common.agencyId} en={LABELS.gtfs.agencyId} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} level="parent" />
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRoutes.map((route) => (
              <React.Fragment key={route.route_id}>
                <TableRow hover>
                  <TableCell sx={{ width: ICON_COL_WIDTH }}>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setExpandedRoute(expandedRoute === route.route_id ? null : route.route_id)
                      }
                    >
                      {expandedRoute === route.route_id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                  </TableCell>

                  <EllipsizedCellWithTooltip title={route.route_id ?? ""}>
                    {route.route_id}
                  </EllipsizedCellWithTooltip>
                  <EllipsizedCellWithTooltip title={route.route_short_name ?? ""}>
                    {route.route_short_name}
                  </EllipsizedCellWithTooltip>
                  <EllipsizedCellWithTooltip title={route.route_long_name ?? ""}>
                    {route.route_long_name}
                  </EllipsizedCellWithTooltip>
                  <EllipsizedCellWithTooltip title={route.agency_id ?? ""}>
                    {route.agency_id}
                  </EllipsizedCellWithTooltip>

                  <TableCell sx={cellTextSx}>{formatRouteType(route.route_type)}</TableCell>
                </TableRow>

                {/* ===== LEVEL 1 (Patterns) ===== */}
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                    <Collapse in={expandedRoute === route.route_id} timeout="auto" unmountOnExit>
                      <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                        <EqualColGroup cols={4} leadingPx={ICON_COL_WIDTH} trailingAuto={false} />

                        <TableHead>
                          <TableRow>
                            <TableCell />
                            <TableCell>
                              <TwoLineHeader jp={LABELS.route.internalPatternId} en="" level="sub" />
                            </TableCell>
                            <TableCell>
                              <TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} level="sub" />
                            </TableCell>
                            <TableCell>
                              <TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} level="sub" />
                            </TableCell>
                            <TableCell>
                              <TwoLineHeader jp={LABELS.common.section} en="" level="sub" />
                            </TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {(route.patterns ?? []).map((pattern) => (
                            <React.Fragment key={pattern.pattern_id}>
                              <TableRow hover>
                                <TableCell sx={{ width: ICON_COL_WIDTH }}>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      setExpandedPattern(
                                        expandedPattern === pattern.pattern_id ? null : pattern.pattern_id
                                      )
                                    }
                                  >
                                    {expandedPattern === pattern.pattern_id ? (
                                      <KeyboardArrowUpIcon />
                                    ) : (
                                      <KeyboardArrowDownIcon />
                                    )}
                                  </IconButton>
                                </TableCell>

                                <EllipsizedCellWithTooltip title={pattern.pattern_id ?? ""}>
                                  {pattern.pattern_id}
                                </EllipsizedCellWithTooltip>

                                <EllipsizedCellWithTooltip
                                  title={
                                    pattern.is_direction_id_generated
                                      ? MESSAGES.trip.systemGeneratedTooltip
                                      : directionMap[pattern.direction_id] || "-"
                                  }
                                >
                                  <Box
                                    component="span"
                                    sx={{
                                      color: pattern.is_direction_id_generated ? "#1E88E5" : "inherit",
                                      fontWeight: pattern.is_direction_id_generated ? 700 : "normal",
                                    }}
                                  >
                                    {directionMap[pattern.direction_id] || "-"}
                                  </Box>
                                </EllipsizedCellWithTooltip>

                                <EllipsizedCellWithTooltip title={pattern.service_id ?? ""}>
                                  {pattern.service_id}
                                </EllipsizedCellWithTooltip>

                                <EllipsizedCellWithTooltip title={formatSectionLabel(pattern.segment) ?? ""}>
                                  {formatSectionLabel(pattern.segment)}
                                </EllipsizedCellWithTooltip>
                              </TableRow>

                              {/* ===== LEVEL 2 (Stops in pattern) ===== */}
                              <TableRow>
                                <TableCell colSpan={5} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                                  <Collapse in={expandedPattern === pattern.pattern_id} timeout="auto" unmountOnExit>
                                    <Box mt={2}>
                                      <Box display="flex" justifyContent="flex-start" px={2}>
                                        <Button
                                          variant="outlined"
                                          color="primary"
                                          size="small"
                                          disabled={startIdx === null || endIdx === null}
                                          onClick={() => handleTrimConfirm({ ...pattern, route_id: route.route_id })}
                                        >
                                          {BUTTONS.common.save}
                                        </Button>
                                      </Box>

                                      <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                                        <EqualColGroup cols={5} />
                                        <TableHead>
                                          <TableRow>
                                            <TableCell>
                                              <TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} level="sub" />
                                            </TableCell>
                                            <TableCell>
                                              <TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} level="sub" />
                                            </TableCell>
                                            <TableCell>
                                              <TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} level="sub" />
                                            </TableCell>
                                            <TableCell>
                                              <TwoLineHeader jp={LABELS.trip.startPoint} en="start_point" level="sub" />
                                            </TableCell>
                                            <TableCell>
                                              <TwoLineHeader jp={LABELS.trip.endPoint} en="end_point" level="sub" />
                                            </TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {(pattern.stop_sequence ?? []).map((stop, index) => (
                                            <TableRow key={`${stop.stop_id}-${index}`}>
                                              <EllipsizedCellWithTooltip title={stop.stop_id ?? ""}>
                                                {stop.stop_id}
                                              </EllipsizedCellWithTooltip>
                                              <EllipsizedCellWithTooltip title={stop.stop_name ?? ""}>
                                                {stop.stop_name}
                                              </EllipsizedCellWithTooltip>
                                              <EllipsizedCellWithTooltip title={String(stop.stop_sequence ?? "")}>
                                                {stop.stop_sequence}
                                              </EllipsizedCellWithTooltip>

                                              <TableCell>
                                                <Radio
                                                  checked={startIdx === index}
                                                  onChange={() => handleStartChange(index)}
                                                  disabled={endIdx !== null && index >= endIdx}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Radio
                                                  checked={endIdx === index}
                                                  onChange={() => handleEndChange(index)}
                                                  disabled={startIdx !== null && index <= startIdx}
                                                />
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <EditRoutePatternConfirmDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => {
          const payload = {
            route_id: selectedPatternInfo.route_id,
            direction_id: selectedPatternInfo.direction_id,
            service_id: selectedPatternInfo.service_id,
            shape_id: selectedPatternInfo.shape_id,
            new_stop_sequence: trimmedStops.map((stop) => ({
              stop_id: stop.stop_id,
              name: stop.stop_name,
              latlng: stop.latlng,
            })),
          };
          onUpdate(scenarioId, payload);
          setShowConfirmDialog(false);
        }}
        originalStops={originalStops}
        trimmedStops={trimmedStops}
      />
    </Box>
  );
};

export default EditRoutePatternTab;
