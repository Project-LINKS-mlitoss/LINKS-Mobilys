import React, { useState, Suspense, lazy, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  TableContainer,
  Collapse,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { groupingMethodMap } from "../../../constant/gtfs";
import { EqualColGroup, cellTextSx } from "../../TableCols";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const StopGroupMap = lazy(() => import("./../../gtfs/StopGroupMap"));

const ICON_COL_WIDTH = 56;
const INDENT_PER_LEVEL = 10;
const ACTIONS_COL_WIDTH = 210;

/* --------------------------- Utils (numeric safety) --------------------------- */
// Convert unknown value to finite number; return null if invalid
const toNum = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Validate latitude/longitude ranges
const isValidLatLng = (lat, lon) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  lat >= -90 &&
  lat <= 90 &&
  lon >= -180 &&
  lon <= 180;

// Format coordinate for table display; show "—" when invalid
const fmtCoord = (v) => {
  const n = toNum(v);
  return n == null ? "—" : n.toFixed(6);
};

// Check if a group can be mapped (has a valid center or at least one valid stop)
const canDisplayMap = (group) => {
  const lat = toNum(group?.stop_names_lat ?? group?.stop_id_lat);
  const lon = toNum(group?.stop_names_lon ?? group?.stop_id_lon);
  const hasCenter = isValidLatLng(lat, lon);

  const hasAnyStop = (group?.stops ?? []).some((s) => {
    const slat = toNum(s?.stop_lat);
    const slon = toNum(s?.stop_lon);
    return isValidLatLng(slat, slon);
  });

  return hasCenter || hasAnyStop;
};

// Produce a sanitized clone for the map (numbers only, drop invalid stops)
const sanitizeGroupForMap = (group) => {
  if (!group) return group;
  const g = { ...group };

  // Normalize group-level coords (if present)
  const snLat = toNum(g.stop_names_lat);
  const snLon = toNum(g.stop_names_lon);
  const siLat = toNum(g.stop_id_lat);
  const siLon = toNum(g.stop_id_lon);

  g.stop_names_lat = snLat;
  g.stop_names_lon = snLon;
  g.stop_id_lat = siLat;
  g.stop_id_lon = siLon;

  // Only valid stops, with numeric lat/lon
  g.stops = (g.stops ?? [])
    .map((s) => ({
      ...s,
      stop_lat: toNum(s.stop_lat),
      stop_lon: toNum(s.stop_lon),
    }))
    .filter((s) => isValidLatLng(s.stop_lat, s.stop_lon));

  return g;
};

/* ------------------------------ Table helpers ------------------------------ */

// ID shown in the parent row (first column)
const getGroupIdText = (group, groupType) => {
  if (groupType === groupingMethodMap.GROUPING_BY_NAME) {
    return group?.stop_group_id_label ?? String(group?.group_id ?? "");
  }
  return group?.stop_id_group ?? String(group?.stop_id_group_id ?? "");
};

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

const getGroupKey = (group) =>
  group?.stop_name_group || group?.stop_id_group || String(group?.group_id || group?.stop_id_group_id);

// Display-only, safe coordinate extractors
const getGroupLat = (group) => fmtCoord(group?.stop_names_lat ?? group?.stop_id_lat);
const getGroupLon = (group) => fmtCoord(group?.stop_names_lon ?? group?.stop_id_lon);

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
          {children ?? "—"}
        </Box>
      </Tooltip>
    </TableCell>
  );
}

// Memoized stop row
const StopRow = React.memo(function StopRow({ stop, actionsCell }) {
  return (
    <TableRow>
      <EllipsizedCellWithTooltip title={stop.stop_id ?? ""}>{stop.stop_id}</EllipsizedCellWithTooltip>
      <EllipsizedCellWithTooltip title={stop.stop_name ?? ""}>{stop.stop_name}</EllipsizedCellWithTooltip>
      <EllipsizedCellWithTooltip title={fmtCoord(stop.stop_lat)}>{fmtCoord(stop.stop_lat)}</EllipsizedCellWithTooltip>
      <EllipsizedCellWithTooltip title={fmtCoord(stop.stop_lon)}>{fmtCoord(stop.stop_lon)}</EllipsizedCellWithTooltip>
      {actionsCell}
    </TableRow>
  );
});

/* -------------------------------- Component ------------------------------- */
const StopGroupTable = ({ data = {}, groupType, renderRowActions, onCreateChild, onCreate }) => {
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [dialogs, setDialogs] = useState({ map: false });

  // Reset open rows when grouping mode changes
  React.useEffect(() => {
    setExpandedKeys(new Set());
  }, [groupType]);

  const stopGroups = useMemo(
    () =>
      groupType === groupingMethodMap.GROUPING_BY_NAME
        ? data.stops_groups_by_name || []
        : data.stops_groups_by_id || [],
    [data, groupType]
  );

  const handleAccordionChange = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2 }}>
        <Button variant="outlined" size="small" onClick={() => onCreate?.()}>
          {BUTTONS.stop.createPole}
        </Button>
      </Box>

      {stopGroups.length === 0 && (
        <Typography align="center" color="text.secondary" sx={{ my: 6 }}>
          {MESSAGES.stop.noGroupData}
        </Typography>
      )}

      {/* ===== PARENT TABLE (Groups) ===== */}
      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 800, width: "100%", tableLayout: "fixed" }}>
          {/* icon (fixed) + 3 equal data cols + actions (fixed) */}
          <EqualColGroup cols={4} leadingPx={ICON_COL_WIDTH} />

          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>
                <TwoLineHeader jp={LABELS.common.stopId} en="" level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.common.stopName} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.stop.stopLat} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.stop.stopLon} level="parent" />
              </TableCell>
              <TableCell sx={{ width: ACTIONS_COL_WIDTH }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {stopGroups.map((group) => {
              const key = getGroupKey(group);
              const isOpen = expandedKeys.has(key);
              const mappable = canDisplayMap(group);

              const groupIdText = getGroupIdText(group, groupType);
              const groupNameText = key;
              const groupLatText = getGroupLat(group);
              const groupLonText = getGroupLon(group);

              return (
                <React.Fragment key={key}>
                  <TableRow
                    hover
                    sx={{
                      cursor: "pointer",
                      background: isOpen ? "#f9f9fb" : "inherit",
                      transition: "background 0.15s",
                    }}
                    onClick={() => handleAccordionChange(key)}
                  >
                    <TableCell sx={{ width: ICON_COL_WIDTH, p: 0 }}>
                      <IconButton size="small" disableRipple tabIndex={-1} sx={{ ml: 1, mr: 1, color: "#666" }}>
                        <ExpandMoreIcon
                          sx={{
                            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </IconButton>
                    </TableCell>

                    <EllipsizedCellWithTooltip title={groupIdText ?? ""}>{groupIdText}</EllipsizedCellWithTooltip>
                    <EllipsizedCellWithTooltip title={groupNameText ?? ""}>{groupNameText}</EllipsizedCellWithTooltip>
                    <EllipsizedCellWithTooltip title={groupLatText ?? ""}>{groupLatText}</EllipsizedCellWithTooltip>
                    <EllipsizedCellWithTooltip title={groupLonText ?? ""}>{groupLonText}</EllipsizedCellWithTooltip>

                    <TableCell sx={{ width: ACTIONS_COL_WIDTH, whiteSpace: "nowrap", textAlign: "right" }}>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!mappable}
                        onClick={(e) => {
                          e.stopPropagation();
                          const safe = sanitizeGroupForMap(group);
                          setSelectedGroup(safe);
                          setDialogs((d) => ({ ...d, map: true }));
                        }}
                      >
                        {BUTTONS.stop.showMap}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* ===== CHILD TABLE (Stops) ===== */}
                  <TableRow>
                    <TableCell colSpan={6} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 0 }}>
                          <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                            {renderRowActions ? <EqualColGroup cols={4} /> : <EqualColGroup cols={4} />}

                            <TableHead>
                              <TableRow>
                                <TableCell>
                                  <TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} level="sub" />
                                </TableCell>
                                <TableCell>
                                  <TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} level="sub" />
                                </TableCell>
                                <TableCell>
                                  <TwoLineHeader jp={LABELS.stop.latitude} en={LABELS.gtfs.stopLat} level="sub" />
                                </TableCell>
                                <TableCell>
                                  <TwoLineHeader jp={LABELS.stop.longitude} en={LABELS.gtfs.stopLon} level="sub" />
                                </TableCell>
                                {renderRowActions && <TableCell sx={{ width: ACTIONS_COL_WIDTH }} />}
                              </TableRow>
                            </TableHead>

                            <TableBody>
                              {group.stops?.length ? (
                                group.stops.map((stop, i) => (
                                  <StopRow
                                    key={stop.stop_id || i}
                                    stop={stop}
                                    actionsCell={
                                      renderRowActions ? (
                                        <TableCell
                                          sx={{
                                            width: ACTIONS_COL_WIDTH,
                                            whiteSpace: "nowrap",
                                            textAlign: "right",
                                          }}
                                        >
                                          {renderRowActions(stop, group)}
                                        </TableCell>
                                      ) : null
                                    }
                                  />
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={renderRowActions ? 6 : 5}>
                                    <Typography color="text.secondary" align="center">
                                      {MESSAGES.common.noData}
                                    </Typography>
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

      <Dialog
        open={dialogs.map}
        onClose={() => setDialogs((d) => ({ ...d, map: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{MESSAGES.stop.groupMapTitle}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ height: 500 }}>
            {selectedGroup && (
              <Suspense
                fallback={
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <CircularProgress />
                  </Box>
                }
              >
                <StopGroupMap group={selectedGroup} />
              </Suspense>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogs((d) => ({ ...d, map: false }))}>{BUTTONS.common.close}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StopGroupTable;
