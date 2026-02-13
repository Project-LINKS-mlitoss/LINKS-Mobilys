// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
  Paper,
  Button,
  TextField,
  Tooltip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import RoutePatternMap from "./RoutePatternMap";
import CreateRouteForm from "./CreateRouteForm";
import EditRouteForm from "./EditRouteForm";
import EditRouteMetaForm from "./EditRouteMetaForm";
import DeleteRouteConfirmDialog from "./DeleteRouteConfirmDialog";

import { directionMap, formatRouteType } from "../../../constant/gtfs";
import { EqualColGroup, cellTextSx } from "../../TableCols";
import { formatSectionLabel } from "../../../utils/text";
import { getDetailTripFrequency } from "../../../services/tripService";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const ICON_COL_WIDTH = 48;
const CHECKBOX_COL_WIDTH = 40;
const INDENT_PER_LEVEL = 10;

const checkboxCellSx = { width: CHECKBOX_COL_WIDTH, p: 0 };
const checkboxSx = { p: 0, m: 0 };
const centerBoxSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
};

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

/** Get ordered stop_ids from a pattern row */
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

const CreateRoutePatternTab = ({
  routeGroups,
  routeData,
  onSave,
  scenarioId,
  onSaveExisting,
  onDelete,
  loadingRouteActions,
  loadingRoutes,
  shapeData,
  previewShapeData,
  onRefetchRoutes,

  // shape editing props
  onUpdateShapesBulk,


}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showEditMetaForm, setShowEditMetaForm] = useState(false);
  const [openRows, setOpenRows] = useState({});
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedRouteForMap, setSelectedRouteForMap] = useState(null);
  const [selectedRouteColor, setSelectedRouteColor] = useState(null);
  const [prefillSelection, setPrefillSelection] = useState(null);
  const [filter, setFilter] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTripData, setDetailTripData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMeta, setDetailMeta] = useState(null);

  // State for bulk delete
  const [selectedPatterns, setSelectedPatterns] = useState({}); // pattern_id => bool
  const [showDiscontinueDialog, setShowDiscontinueDialog] = useState(false);
  const [patternsToConfirm, setPatternsToConfirm] = useState([]);

  // Map route_id -> group's keyword_color (normalized to #RRGGBB)
  const routeColorsMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(routeGroups)) return map;

    routeGroups.forEach((group) => {
      if (!group) return;
      const routesInGroup = Array.isArray(group.routes) ? group.routes : [];
      const rawColor = group.keyword_color;
      if (!rawColor) return;
      const hex = String(rawColor).replace(/^#?/, "");
      const color = `#${hex}`;

      routesInGroup.forEach((r) => {
        if (!r || r.route_id == null) return;
        const rid = String(r.route_id);
        if (!map[rid]) {
          map[rid] = color;
        }
      });
    });

    return map;
  }, [routeGroups]);

  // Conditional returns after all hooks
  // Keep rendering (and keep local form state) during refetch when we already have routeData.
  if (
    loadingRoutes &&
    (!routeData || !Array.isArray(routeData.routes) || routeData.routes.length === 0)
  ) {
    return <Typography>{MESSAGES.route.loadingData}</Typography>;
  }
  if (!Array.isArray(routeData.routes) || routeData.routes.length === 0)
    return <Typography>{MESSAGES.route.loadingData}</Typography>;

  const routes = routeData.routes;
  const stops = routeData.stops;
  const service_id = routeData.service_ids;
  const agency_id = routeData.agency_ids;

  const routeIds = routes.map((route) => ({
    route_id: route.route_id,
    route_type: route.route_type,
    agency_id: route.agency_id,
  }));

  const routePatternsMap = {};
  routes.forEach((route) => {
    routePatternsMap[route.route_id] = route.patterns;
  });

  const toggleRow = (routeId) =>
    setOpenRows((prev) => ({ ...prev, [routeId]: !prev[routeId] }));

  const computeRouteTotalTrips = (route) =>
    (route?.patterns || []).reduce(
      (sum, p) => sum + (Number.isFinite(Number(p?.interval)) ? Number(p.interval) : 0),
      0
    );

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

  // filter by route_id
  const filteredRoutes = routes.filter((r) =>
    String(r.route_id || "").toLowerCase().includes(filter.toLowerCase())
  );

  if (showCreateForm) {
    return (
      <CreateRouteForm
        agency_list={agency_id}
        service_id_list={service_id}
        stops_list={stops}
        onCancel={() => setShowCreateForm(false)}
        onSave={onSave}
        scenarioId={scenarioId}
        loadingRouteActions={loadingRouteActions}
        onSuccess={() => setShowCreateForm(false)}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
      />
    );
  }

  if (showEditMetaForm) {
    return (
      <EditRouteMetaForm
        agency_list={agency_id}
        service_id_list={service_id}
        stops_list={stops}
        route_list={routeIds}
        route_pattern_list={routePatternsMap}
        initialRouteId={prefillSelection?.route_id ?? null}
        initialPatternId={prefillSelection?.pattern_id ?? null}
        initialShapeId={prefillSelection?.shape_id ?? null}
        initialShapePoints={prefillSelection?.shape ?? null}
        onCancel={() => {
          setShowEditMetaForm(false);
          setPrefillSelection(null);
        }}
        onSave={undefined}
        scenarioId={scenarioId}
        loadingRouteActions={loadingRouteActions}
        onSuccess={() => {
          setShowEditMetaForm(false);
          setPrefillSelection(null);
        }}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
        onRefetchTrips={onRefetchRoutes}
        onUpdateShapesBulk={onUpdateShapesBulk}
        enableShapeApplyDialog={true}
      />
    );
  }

  if (showEditForm) {
    return (
      <EditRouteForm
        agency_list={agency_id}
        service_id_list={service_id}
        stops_list={stops}
        route_list={routeIds}
        route_pattern_list={routePatternsMap}
        initialRouteId={prefillSelection?.route_id ?? null}
        initialPatternId={prefillSelection?.pattern_id ?? null}
        onCancel={() => {
          setShowEditForm(false);
          setPrefillSelection(null);
        }}
        onSave={onSaveExisting}
        scenarioId={scenarioId}
        loadingRouteActions={loadingRouteActions}
        onSuccess={() => {
          setShowEditForm(false);
          setPrefillSelection(null);
        }}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
      />
    );
  }

  return (
    <Box>
      {/* Top actions */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          justifyContent: "flex-start",
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Button variant="outlined" size="small" onClick={() => setShowCreateForm(true)}>
          {LABELS.route.createRoute}
        </Button>

        <Button
          variant="outlined"
          size="small"
          color="primary"
          disabled={Object.values(selectedPatterns).every((v) => !v)}
          onClick={() => {
            const selectedIds = getSelectedPatternIds();
            if (selectedIds.length === 0) return;

            const allPatterns = routes.flatMap((r) =>
              (r.patterns || []).map((p) => ({ ...p, route_id: r.route_id }))
            );

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

      {/* Filter */}
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
        <TextField
          label={LABELS.common.routeId}
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Box>

      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        {/* ===== LEVEL 0 (Routes) ===== */}
        <Table size="small" sx={{ minWidth: 800, width: "100%", tableLayout: "fixed" }}>
          {/* Leading fixed icon col + 5 equal data cols */}
          <EqualColGroup cols={6} leadingPx={ICON_COL_WIDTH} trailingAuto={false} />

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
                <TwoLineHeader jp={LABELS.trip.totalTrips} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} level="parent" />
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRoutes.map((route) => {
              const isOpen = !!openRows[route.route_id];
              const hasPatterns = Array.isArray(route.patterns) && route.patterns.length > 0;

              return (
                <React.Fragment key={route.route_id}>
                  <TableRow hover>
                    <TableCell sx={{ width: ICON_COL_WIDTH }}>
                      <IconButton size="small" onClick={() => toggleRow(route.route_id)}>
                        {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>

                    <EllipsizedCellWithTooltip title={route.route_id ?? ""}>
                      {route.route_id}
                    </EllipsizedCellWithTooltip>
                    <EllipsizedCellWithTooltip title={route.route_short_name ?? ""}>
                      {route.route_short_name || "-"}
                    </EllipsizedCellWithTooltip>
                    <EllipsizedCellWithTooltip title={route.route_long_name ?? ""}>
                      {route.route_long_name || "-"}
                    </EllipsizedCellWithTooltip>
                    <EllipsizedCellWithTooltip title={route.agency_id ?? ""}>
                      {route.agency_id}
                    </EllipsizedCellWithTooltip>

                    {/* ✅ route_type: NO tooltip (as requested) */}
                    <TableCell sx={cellTextSx}>
                      {(() => {
                        const total = computeRouteTotalTrips(route);
                        return Number.isFinite(total) ? total : "-";
                      })()}
                    </TableCell>
                    <TableCell sx={cellTextSx}>{formatRouteType(route.route_type)}</TableCell>
                  </TableRow>

                  {/* ===== LEVEL 1 (Route Patterns) ===== */}
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1 }}>
                          <Table
                            size="small"
                            sx={{ tableLayout: "fixed", width: "100%", minWidth: 900 }}
                          >
                            {/* checkbox lead + 5 data cols + trailing auto actions */}
                            <EqualColGroup
                              cols={7}
                              leadingPx={CHECKBOX_COL_WIDTH}
                              trailingAuto={true}
                            />

                            <TableHead>
                              <TableRow>
                                <TableCell sx={checkboxCellSx} align="center">
                                  <Box sx={centerBoxSx}>
                                    {hasPatterns && (
                                      <Checkbox
                                        size="small"
                                        sx={checkboxSx}
                                        indeterminate={
                                          route.patterns.some((p) => selectedPatterns[p.pattern_id]) &&
                                          !route.patterns.every((p) => selectedPatterns[p.pattern_id])
                                        }
                                        checked={
                                          route.patterns.length > 0 &&
                                          route.patterns.every((p) => selectedPatterns[p.pattern_id])
                                        }
                                        onChange={() => handleSelectAll(route.patterns)}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
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
                                <TableCell>
                                  <TwoLineHeader jp={LABELS.trip.totalTrips} level="sub" />
                                </TableCell>
                                <TableCell /> {/* actions */}
                              </TableRow>
                            </TableHead>

                            <TableBody>
                              {hasPatterns ? (
                                route.patterns.map((p) => (
                                  <TableRow
                                    key={p.pattern_id}
                                    hover
                                    sx={{ cursor: "pointer" }}
                                    onClick={async (e) => {
                                      if (
                                        e.target.closest("button") ||
                                        e.target.closest("input") ||
                                        e.target.closest("[data-skip-row-click='true']")
                                      ) {
                                        return;
                                      }
                                      const routeName =
                                        route.route_short_name ||
                                        route.route_long_name ||
                                        route.route_id;
                                      const dirLabel =
                                        directionMap?.[p.direction_id] ??
                                        (p?.direction_id ?? "-");
                                      setDetailMeta({
                                        route_id: route.route_id,
                                        route_name: routeName,
                                        pattern_id: p.pattern_id,
                                        direction_id: p.direction_id,
                                        direction_label: dirLabel,
                                        service_id: p.service_id,
                                        first_and_last_stop_name:
                                          p.first_and_last_stop_name || p.segment || "",
                                        segment: p.segment || "",
                                      });
                                      setDetailLoading(true);
                                      try {
                                        const res = await getDetailTripFrequency(
                                          scenarioId,
                                          route.route_id,
                                          p.service_id,
                                          p.trip_headsign,
                                          p.shape_id,
                                          p.direction_id,
                                          p.pattern_hash
                                        );
                                        setDetailTripData(res || []);
                                      } catch {
                                        setDetailTripData([]);
                                      } finally {
                                        setDetailLoading(false);
                                        setDetailModalOpen(true);
                                      }
                                    }}
                                  >
                                    <TableCell sx={checkboxCellSx} align="center">
                                      <Box sx={centerBoxSx}>
                                        <Checkbox
                                          size="small"
                                          sx={checkboxSx}
                                          checked={!!selectedPatterns[p.pattern_id]}
                                          onChange={() => handleSelect(p.pattern_id)}
                                        />
                                      </Box>
                                    </TableCell>

                                    <EllipsizedCellWithTooltip title={p.pattern_id ?? ""}>
                                      {p.pattern_id}
                                    </EllipsizedCellWithTooltip>

                                    <EllipsizedCellWithTooltip
                                      title={
                                        p.is_direction_id_generated
                                          ? MESSAGES.trip.systemGeneratedTooltip
                                          : directionMap[p.direction_id] || "-"
                                      }
                                    >
                                      <Box
                                        component="span"
                                        sx={{
                                          color: p.is_direction_id_generated ? "#1E88E5" : "inherit",
                                          fontWeight: p.is_direction_id_generated ? 700 : "normal",
                                        }}
                                      >
                                        {directionMap[p.direction_id] || "-"}
                                      </Box>
                                    </EllipsizedCellWithTooltip>

                                    <EllipsizedCellWithTooltip title={p.service_id ?? ""}>
                                      {p.service_id}
                                    </EllipsizedCellWithTooltip>

                                    <EllipsizedCellWithTooltip title={formatSectionLabel(p.segment) ?? ""}>
                                      {formatSectionLabel(p.segment)}
                                    </EllipsizedCellWithTooltip>

                                    <TableCell sx={cellTextSx}>{p.interval ?? "-"}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                                      <Box sx={{ display: "flex", gap: 1 }}>
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          data-skip-row-click="true"
                                          onClick={() => {
                                            setPrefillSelection({
                                              route_id: route.route_id,
                                              pattern_id: p.pattern_id,
                                              shape_id: p.shape_id,
                                              shape: p.shape,
                                            });
                                            setShowEditMetaForm(true);
                                          }}
                                        >
                                          {BUTTONS.common.edit}
                                        </Button>
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          data-skip-row-click="true"
                                          onClick={() => {
                                            setPrefillSelection({
                                              route_id: route.route_id,
                                              pattern_id: p.pattern_id,
                                            });
                                            setShowEditForm(true);
                                          }}
                                        >
                                          {BUTTONS.common.duplicate}
                                        </Button>
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          sx={{ mr: 1 }}
                                          onClick={() => {
                                            setSelectedShape(p.shape || []);
                                            setSelectedRouteForMap({
                                              route_id: route.route_id,
                                              route_short_name: route.route_short_name,
                                              route_long_name: route.route_long_name,
                                              route_type: route.route_type,
                                              agency_id: route.agency_id,
                                              geojson_data: route.geojson_data,
                                              route_patterns: [p],
                                            });
                                            const rid = String(route.route_id ?? "");
                                            setSelectedRouteColor(routeColorsMap[rid] || null);
                                            setMapOpen(true);
                                          }}
                                        >
                                          {BUTTONS.stop.showMap}
                                        </Button>
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={6}>
                                    <Typography color="text.secondary">{MESSAGES.route.noPatterns}</Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <RoutePatternMap
        open={mapOpen}
        onClose={() => {
          setMapOpen(false);
          setSelectedRouteForMap(null);
          setSelectedRouteColor(null);
        }}
        shape={selectedShape || []}
        routeData={selectedRouteForMap}
        routeColor={selectedRouteColor}
      />

      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{LABELS.trip.tripDetail}</DialogTitle>
        <DialogContent>
          <DetailHeader detailMeta={detailMeta} detailTripData={detailTripData} />

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, mt: 4 }}>
            {LABELS.trip.tabTripList}
          </Typography>

          {detailLoading ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CircularProgress />
            </Box>
          ) : detailTripData && detailTripData.length > 0 ? (
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <LabelStack
                      top={LABELS.trip.departureTime}
                      bottom={LABELS.gtfs.departureTime}
                    />
                  </TableCell>
                  <TableCell>
                    <LabelStack top={LABELS.trip.tripId} bottom={LABELS.gtfs.tripId} />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailTripData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.departure_time}</TableCell>
                    <TableCell>{row.trip_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography sx={{ py: 2, color: "#888" }}>{MESSAGES.common.noData}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailModalOpen(false)} variant="outlined">
            {BUTTONS.common.close}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm dialog for bulk delete */}
      <DeleteRouteConfirmDialog
        open={showDiscontinueDialog}
        onClose={() => setShowDiscontinueDialog(false)}
        onConfirm={() => {
          const payload = {
            route_patterns: patternsToConfirm.map((p) => ({
              route_id: p.route_id,
              direction_id: p.direction_id,
              service_id: p.service_id,
              stop_ids: toStopIds(p),
            })),
          };
          onDelete(scenarioId, payload);
          setShowDiscontinueDialog(false);
          setSelectedPatterns({});
        }}
        patterns={patternsToConfirm}
      />
    </Box>
  );
};

export default CreateRoutePatternTab;

const DetailHeader = ({ detailMeta, detailTripData }) => (
  <>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
      {LABELS.route.patternInfo}
    </Typography>
    <Table size="small" sx={{ mb: 1 }}>
      <TableHead>
        <TableRow>
          <TableCell>
            <LabelStack top={LABELS.route.internalPatternId} />
          </TableCell>
          <TableCell align="center">
            <LabelStack top={LABELS.common.direction} bottom={LABELS.gtfs.directionId} align="center" />
          </TableCell>
          <TableCell align="center">
            <LabelStack top={LABELS.common.serviceId} bottom={LABELS.gtfs.serviceId} align="center" />
          </TableCell>
          <TableCell>
            <LabelStack top={LABELS.common.section} />
          </TableCell>
          <TableCell align="center">
            <LabelStack top={LABELS.trip.totalTrips} />
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>{detailMeta?.pattern_id ?? "-"}</TableCell>
          <TableCell align="center">
            {detailMeta?.direction_label ??
              (detailMeta?.direction_id === 0 || detailMeta?.direction_id === 1
                ? String(detailMeta?.direction_id)
                : "-")}
          </TableCell>
          <TableCell align="center">{detailMeta?.service_id ?? "-"}</TableCell>
          <TableCell>{formatSectionLabel(detailMeta?.first_and_last_stop_name) ?? "-"}</TableCell>
          <TableCell align="center">{detailTripData?.length ?? 0}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </>
);

const LabelStack = ({ top, bottom, align = "left" }) => (
  <Box sx={{ textAlign: align, lineHeight: 1.2 }}>
    <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: "0.875rem" }}>
      {top}
    </Typography>
    {bottom && (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
      >
        {bottom}
      </Typography>
    )}
  </Box>
);
