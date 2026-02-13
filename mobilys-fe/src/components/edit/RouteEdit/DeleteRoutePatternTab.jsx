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
  TextField,
  Checkbox,
  Collapse,
  IconButton,
  Typography,
  Button,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DeleteRouteConfirmDialog from "./DeleteRouteConfirmDialog";
import { directionMap, formatRouteType } from "../../../constant/gtfs";
import { EqualColGroup, cellTextSx } from "../../TableCols";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";

const ICON_COL_WIDTH = 48;    // parent expand/collapse column
const CHECKBOX_COL_WIDTH = 40; // child checkbox column
const INDENT_PER_LEVEL = 10;

// Shared styles for checkbox column and checkbox (for consistency)
const checkboxCellSx = { width: CHECKBOX_COL_WIDTH, p: 0 };
const checkboxSx = { p: 0, m: 0 };
const centerBoxSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
};

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

/** Ordered stop_ids from a pattern row (fallbacks to any precomputed p.stop_ids) */
const toStopIds = (p) => {
  if (Array.isArray(p.stop_sequence) && p.stop_sequence.length) {
    return [...p.stop_sequence]
      .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
      .map((s) => String(s.stop_id));
  }
  if (Array.isArray(p.stop_ids) && p.stop_ids.length) {
    return p.stop_ids.map(String);
  }
  return [];
};

const DeleteRoutePatternTab = ({ routeData, scenarioId, onDelete }) => {
  const [filter, setFilter] = useState("");
  const [openRows, setOpenRows] = useState({});
  const [selectedPatterns, setSelectedPatterns] = useState({});
  const [showDiscontinueDialog, setShowDiscontinueDialog] = useState(false);
  const [patternsToConfirm, setPatternsToConfirm] = useState([]);

  const routes = routeData?.routes || [];

  const handleToggle = (routeId) =>
    setOpenRows((prev) => ({ ...prev, [routeId]: !prev[routeId] }));

  const handleSelect = (patternId) =>
    setSelectedPatterns((prev) => ({ ...prev, [patternId]: !prev[patternId] }));

  const handleSelectAll = (patterns) => {
    const updated = { ...selectedPatterns };
    const allSelected = patterns.every((p) => selectedPatterns[p.pattern_id]);
    patterns.forEach((p) => {
      updated[p.pattern_id] = !allSelected;
    });
    setSelectedPatterns(updated);
  };

  const getSelectedPatternIds = () =>
    Object.keys(selectedPatterns).filter((id) => !!selectedPatterns[id]);

  const filteredRoutes = routes.filter((r) =>
    String(r.route_id || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box sx={{ px: 3, py: 2 }}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          justifyContent: "flex-start",
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="outlined"
          size="small"
          disabled={Object.values(selectedPatterns).every((v) => !v)}
          onClick={() => {
            const selectedIds = getSelectedPatternIds();
            if (selectedIds.length === 0) return;

            const allPatterns = routes.flatMap((r) =>
              (r.patterns || []).map((p) => ({ ...p, route_id: r.route_id }))
            );

            // Keep only the exact pattern_id matches for the confirm dialog
            const selected = allPatterns.filter((p) =>
              selectedIds.includes(String(p.pattern_id))
            );

            setPatternsToConfirm(selected);
            setShowDiscontinueDialog(true);
          }}
        >
          {BUTTONS.common.delete}
        </Button>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          justifyContent: "flex-start",
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <TextField
          label={LABELS.common.routeId}
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Box>

      <TableContainer component={Paper}>
        {/* ===== LEVEL 0 (Routes) ===== */}
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          {/* Leading fixed icon col + 5 equal data cols */}
          <EqualColGroup
            cols={5}
            leadingPx={ICON_COL_WIDTH}
            trailingAuto={false}
          />

          <TableHead>
            <TableRow>
              <TableCell /> {/* icon col */}
              <TableCell>
                <TwoLineHeader jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader
                  jp={LABELS.route.routeShortName}
                  en={LABELS.gtfs.routeShortName}
                  level="parent"
                />
              </TableCell>
              <TableCell>
                <TwoLineHeader
                  jp={LABELS.common.routeLongName}
                  en={LABELS.gtfs.routeLongName}
                  level="parent"
                />
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
            {filteredRoutes.map((route) => {
              const isOpen = !!openRows[route.route_id];
              const hasPatterns =
                Array.isArray(route.patterns) && route.patterns.length > 0;

              return (
                <React.Fragment key={route.route_id}>
                  <TableRow hover>
                    <TableCell sx={{ width: ICON_COL_WIDTH }}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggle(route.route_id)}
                      >
                        {isOpen ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={cellTextSx}>{route.route_id}</TableCell>
                    <TableCell sx={cellTextSx}>
                      {route.route_short_name || "-"}
                    </TableCell>
                    <TableCell sx={cellTextSx}>
                      {route.route_long_name || "-"}
                    </TableCell>
                    <TableCell sx={cellTextSx}>{route.agency_id}</TableCell>
                    <TableCell sx={cellTextSx}>{formatRouteType(route.route_type)}</TableCell>
                  </TableRow>

                  {hasPatterns && (
                    <TableRow>
                      {/* Indent the entire nested block slightly (same pattern as Create) */}
                      <TableCell colSpan={6} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 1 }}>
                            {/* ===== LEVEL 1 (Patterns) ===== */}
                            <Table
                              size="small"
                              sx={{ tableLayout: "fixed", width: "100%" }}
                            >
                              {/* Leading fixed checkbox col + 4 equal data cols */}
                              <EqualColGroup
                                cols={4}
                                leadingPx={CHECKBOX_COL_WIDTH}
                                trailingAuto={false}
                              />

                              <TableHead>
                                <TableRow>
                                  <TableCell
                                    sx={checkboxCellSx}
                                    align="center"
                                  >
                                    <Box sx={centerBoxSx}>
                                      <Checkbox
                                        size="small"
                                        sx={checkboxSx}
                                        indeterminate={
                                          route.patterns.some(
                                            (p) =>
                                              selectedPatterns[p.pattern_id]
                                          ) &&
                                          !route.patterns.every(
                                            (p) =>
                                              selectedPatterns[p.pattern_id]
                                          )
                                        }
                                        checked={
                                          route.patterns.length > 0 &&
                                          route.patterns.every(
                                            (p) =>
                                              selectedPatterns[p.pattern_id]
                                          )
                                        }
                                        onChange={() =>
                                          handleSelectAll(route.patterns)
                                        }
                                      />
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <TwoLineHeader
                                      jp={LABELS.route.internalPatternId}
                                      en=""
                                      level="sub"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TwoLineHeader
                                      jp={LABELS.common.direction}
                                      en={LABELS.gtfs.directionId}
                                      level="sub"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TwoLineHeader
                                      jp={LABELS.common.serviceId}
                                      en={LABELS.gtfs.serviceId}
                                      level="sub"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TwoLineHeader jp={LABELS.common.section} en="" level="sub" />
                                  </TableCell>
                                </TableRow>
                              </TableHead>

                              <TableBody>
                                {route.patterns.map((p) => (
                                  <TableRow key={p.pattern_id} hover>
                                    <TableCell
                                      sx={checkboxCellSx}
                                      align="center"
                                    >
                                      <Box sx={centerBoxSx}>
                                        <Checkbox
                                          size="small"
                                          sx={checkboxSx}
                                          checked={
                                            !!selectedPatterns[p.pattern_id]
                                          }
                                          onChange={() =>
                                            handleSelect(p.pattern_id)
                                          }
                                        />
                                      </Box>
                                    </TableCell>
                                    <TableCell sx={cellTextSx}>
                                      {p.pattern_id}
                                    </TableCell>
                                    <TableCell sx={cellTextSx}>
                                      {directionMap[p.direction_id]}
                                    </TableCell>
                                    <TableCell sx={cellTextSx}>
                                      {p.service_id}
                                    </TableCell>
                                    <TableCell sx={cellTextSx}>
                                      {formatSectionLabel(p.segment)}
                                    </TableCell>
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
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <DeleteRouteConfirmDialog
        open={showDiscontinueDialog}
        onClose={() => setShowDiscontinueDialog(false)}
        onConfirm={() => {
          // Build payload with ordered stop_ids (Option A)
          const payload = {
            route_patterns: patternsToConfirm.map((p) => ({
              route_id: p.route_id,
              direction_id: p.direction_id,
              service_id: p.service_id,
              stop_ids: toStopIds(p), // <-- critical: ordered list
            })),
          };
          onDelete(scenarioId, payload);
          setShowDiscontinueDialog(false);
        }}
        patterns={patternsToConfirm}
      />
    </Box>
  );
};

export default DeleteRoutePatternTab;
