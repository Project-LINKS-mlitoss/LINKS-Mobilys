// src/components/edit/TripEdit/TripList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Tooltip,
  TextField,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  ListItemText,
  FormHelperText,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

import CreateTripForm from "./CreateTripForm";
import DuplicateTripForm from "./DuplicateTripForm";
import EditTripForm from "./EditTripForm";
import DeleteTripConfirmDialog from "./DeleteTripConfirmDialog";
import RoutePatternMap from "../RouteEdit/RoutePatternMap";

import { directionMap } from "../../../constant/gtfs";
import { EqualColGroup, cellTextSx } from "../../TableCols";
import EditRouteMetaForm from "../RouteEdit/EditRouteMetaForm";

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

const ALL_OPTION = "__ALL__"; // used for "すべて"
const formatGroupName = (g) =>
  String(g?.group_route_name ?? g?.keyword ?? g?.group_route_id ?? g?.keyword_id ?? "").trim();

const WEEKDAYS = [
  { value: "monday", label: LABELS.days.mondayLong },
  { value: "tuesday", label: LABELS.days.tuesdayLong },
  { value: "wednesday", label: LABELS.days.wednesdayLong },
  { value: "thursday", label: LABELS.days.thursdayLong },
  { value: "friday", label: LABELS.days.fridayLong },
  { value: "saturday", label: LABELS.days.saturdayLong },
  { value: "sunday", label: LABELS.days.sundayLong },
];
const weekdayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const weekdayFromDateStr = (d) => {
  if (!d) return null;
  let dateObj = null;
  if (typeof d === "string") {
    if (/^\d{8}$/.test(d)) {
      const y = d.slice(0, 4);
      const m = d.slice(4, 6);
      const day = d.slice(6, 8);
      dateObj = new Date(`${y}-${m}-${day}T00:00:00Z`);
    } else {
      dateObj = new Date(d);
    }
  } else if (d instanceof Date) {
    dateObj = d;
  }
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  return weekdayKeys[dateObj.getUTCDay()];
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
          whiteSpace: "normal",
          wordBreak: "break-word",
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

const TripListTab = ({
  routeGroups,
  tripData,
  onFetchDetail,
  calendarData,
  stopsData,
  onSave,
  scenarioId,
  onDelete,
  onEdit,
  onRefetchTrips,
  loadingTripActions,
  loadingEditTrips,
  shapeData,
  previewShapeData,
}) => {
  const timeToSeconds = (t) => {
    if (!t) return Number.POSITIVE_INFINITY;
    const [hh = "0", mm = "0", ss = "0"] = String(t).split(":");
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    const s = parseInt(ss, 10);
    if ([h, m, s].some(Number.isNaN)) return Number.POSITIVE_INFINITY;
    return h * 3600 + m * 60 + s;
  };

  const [openPatterns, setOpenPatterns] = useState({});

  const [showCreateTripForm, setShowCreateTripForm] = useState(false);
  const [showDuplicateTripForm, setShowDuplicateTripForm] = useState(false);
  const [showEditTripForm, setShowEditTripForm] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [tripDetailEditData, setTripDetailEditData] = useState([]);
  const [templateTripData, setTemplateTripData] = useState(null);

  // ✅ routeGroup & youbi are arrays now
  const [pendingFilters, setPendingFilters] = useState({
    directionId: "",
    routeGroup: [], // multi
    youbi: [], // multi
  });
  const [appliedFilters, setAppliedFilters] = useState({
    routeId: "",
    directionId: "",
    routeGroup: [], // multi
    youbi: [], // multi
  });

  const routeIdInputRef = useRef(null);
  const [selectedTrips, setSelectedTrips] = useState({});
  const [showDiscontinueDialog, setShowDiscontinueDialog] = useState(false);
  const [tripsToConfirm, setTripsToConfirm] = useState([]);

  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRouteForMap, setSelectedRouteForMap] = useState(null);
  const [selectedRouteColor, setSelectedRouteColor] = useState(null);
  const [showEditMetaForm, setShowEditMetaForm] = useState(false);

  const directionOptions = useMemo(() => {
    const entries = Object.entries(directionMap || {});
    const numericEntries = entries.filter(([k]) => k === "0" || k === "1" || Number.isFinite(Number(k)));
    const fallbackEntries = entries.filter(([k]) => k === "outbound" || k === "inbound");
    const useEntries = numericEntries.length > 0 ? numericEntries : fallbackEntries;
    const seen = new Set();
    const opts = [];
    useEntries.forEach(([value, label]) => {
      const v = String(value);
      if (seen.has(v)) return;
      seen.add(v);
      opts.push({ value: v, label });
    });
    return opts;
  }, []);

  const routeGroupOptions = useMemo(() => {
    const src =
      (routeGroups && routeGroups.data && routeGroups.data.routes_grouped_by_keyword) || routeGroups;
    if (!Array.isArray(src)) return [];
    const names = src.map(formatGroupName).filter((n) => n);
    return Array.from(new Set(names));
  }, [routeGroups]);

  const routeIdToGroupMap = useMemo(() => {
    const map = {};
    const src =
      (routeGroups && routeGroups.data && routeGroups.data.routes_grouped_by_keyword) || routeGroups;
    if (!Array.isArray(src)) return map;
    src.forEach((group) => {
      if (!group || !Array.isArray(group.routes)) return;
      const gname = formatGroupName(group);
      if (!gname) return;
      group.routes.forEach((r) => {
        if (!r || r.route_id == null) return;
        const rid = String(r.route_id);
        if (!map[rid]) map[rid] = new Set();
        map[rid].add(gname);
      });
    });
    return map;
  }, [routeGroups]);

  const calendarRows = useMemo(() => {
    const src = calendarData?.data ?? calendarData;
    const rows = Array.isArray(src?.calendar) ? src.calendar : Array.isArray(src) ? src : [];
    return rows.map((r) => ({
      ...r,
      service_id: r?.service_id == null ? "" : String(r.service_id).trim(),
    }));
  }, [calendarData]);

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

  if (showEditMetaForm && selectedRoute && selectedPattern) {
    const routesAll = tripData?.data || [];
    const routeIds = routesAll.map((r) => ({
      route_id: r.route_id,
      route_type: r.route_type,
      agency_id: r.agency_id,
    }));
    const routePatternsMap = {};
    routesAll.forEach((r) => {
      routePatternsMap[r.route_id] = r.route_patterns || [];
    });
    const tripsToUpdate = (selectedPattern.trips || []).map((t) => t.trip_id);
    const serviceIds = Array.from(
      new Set(
        routesAll.flatMap((r) =>
          (r.route_patterns || []).flatMap((p) => [
            p.service_id,
            ...(p.trips || []).map((t) => t.service_id),
          ])
        )
      )
    ).filter(Boolean);

    return (
      <EditRouteMetaForm
        agency_list={[]}
        service_id_list={serviceIds}
        stops_list={[]}
        route_list={routeIds}
        route_pattern_list={routePatternsMap}
        initialRouteId={selectedRoute.route_id}
        initialPatternId={selectedPattern.pattern_id}
        onCancel={() => setShowEditMetaForm(false)}
        onSave={undefined}
        scenarioId={scenarioId}
        loadingRouteActions={loadingTripActions}
        onSuccess={() => {
          try {
            onRefetchTrips && onRefetchTrips();
          } catch (_) { }
          setShowEditMetaForm(false);
        }}
        onRefetchTrips={onRefetchTrips}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
        tripsToUpdate={tripsToUpdate}
      />
    );
  }

  const routes = tripData?.data || [];
  if (loadingEditTrips) return <Typography>{MESSAGES.trip.loadingData}</Typography>;
  if (!routes.length) return <Typography>{MESSAGES.trip.loadingData}</Typography>;

  const togglePatternRow = (patternId) =>
    setOpenPatterns((prev) => ({ ...prev, [patternId]: !prev[patternId] }));

  const handleTripSelect = (tripId) =>
    setSelectedTrips((prev) => ({ ...prev, [tripId]: !prev[tripId] }));

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

  const stops_list = stopsData.map((stop) => ({
    stop_id: stop.stop_id,
    stop_name: stop.stop_name,
    stop_latlng: [stop.stop_lat, stop.stop_lon],
  }));

  // ✅ routeGroup is array now:
  // - empty array means "no selection" => show none (but default will be all selected)
  // - if selected all groups => it behaves as "all"
  const filteredRoutes = routes.filter((r) => {
    const rid = String(r.route_id || "");
    if (
      appliedFilters.routeId &&
      !rid.toLowerCase().includes(String(appliedFilters.routeId).toLowerCase())
    ) {
      return false;
    }

    const selectedGroups = Array.isArray(appliedFilters.routeGroup) ? appliedFilters.routeGroup : [];
    const allGroups = routeGroupOptions;

    const isAllGroupsSelected =
      allGroups.length > 0 && selectedGroups.length === allGroups.length;

    if (selectedGroups.length > 0 && !isAllGroupsSelected) {
      const groupsForRoute = Array.from(routeIdToGroupMap[rid] || []);
      const hasMatch = selectedGroups.some((g) => groupsForRoute.includes(g));
      if (!hasMatch) return false;
    }

    return true;
  });

  const matchesDirectionFilter = (directionId) => {
    if (!appliedFilters.directionId) return true;
    return String(directionId) === String(appliedFilters.directionId);
  };

  // ✅ youbi is array now, and "all selected" behaves as no filter
  const matchesYoubiFilter = (serviceId) => {
    const selected = Array.isArray(appliedFilters.youbi) ? appliedFilters.youbi : [];
    const allDays = WEEKDAYS.map((d) => d.value);

    if (selected.length === 0) return true; // no filter
    if (selected.length === allDays.length) return true; // all => no filter

    if (!serviceId) return false;
    const sid = String(serviceId).trim();
    const row = calendarRows.find((r) => r.service_id === sid);
    if (!row) return false;
    return selected.some((d) => Number(row[d]) === 1);
  };

  const serviceIdList = useMemo(() => {
    const ids = new Set();
    const src = calendarData?.data ?? calendarData;
    if (Array.isArray(src)) {
      src.forEach((v) => {
        if (v == null) return;
        if (typeof v === "string") ids.add(v);
        else if (v.service_id) ids.add(String(v.service_id).trim());
      });
    }
    const cal = Array.isArray(src?.calendar) ? src.calendar : [];
    cal.forEach((r) => r?.service_id && ids.add(String(r.service_id).trim()));
    const cds = Array.isArray(src?.calendar_dates) ? src.calendar_dates : [];
    cds.forEach((r) => r?.service_id && ids.add(String(r.service_id).trim()));
    return Array.from(ids);
  }, [calendarData]);

  // ✅ Default: both routeGroup and youbi start as "all selected"
  useEffect(() => {
    if (routeGroupOptions.length > 0 && pendingFilters.routeGroup.length === 0) {
      setPendingFilters((prev) => ({ ...prev, routeGroup: routeGroupOptions }));
      setAppliedFilters((prev) => ({ ...prev, routeGroup: routeGroupOptions }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeGroupOptions]);

  useEffect(() => {
    const allDays = WEEKDAYS.map((d) => d.value);
    if (allDays.length > 0 && pendingFilters.youbi.length === 0) {
      setPendingFilters((prev) => ({ ...prev, youbi: allDays }));
      setAppliedFilters((prev) => ({ ...prev, youbi: allDays }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Multi-select with "すべて" behavior (routeGroup)
  const handleRouteGroupChange = (valueRaw) => {
    const value = typeof valueRaw === "string" ? valueRaw.split(",") : valueRaw;
    const all = routeGroupOptions;
    const isAllCurrently = Array.isArray(pendingFilters.routeGroup) && pendingFilters.routeGroup.length === all.length;

    if (value.includes(ALL_OPTION)) {
      setPendingFilters((prev) => ({ ...prev, routeGroup: isAllCurrently ? [] : all }));
      return;
    }

    // If user manually selected all options, normalize to "all"
    const next = Array.isArray(value) ? value : [];
    const normalized = all.length > 0 && next.length === all.length ? all : next;

    setPendingFilters((prev) => ({ ...prev, routeGroup: normalized }));
  };

  // ✅ Multi-select with "すべて" behavior (youbi)
  const handleYoubiChange = (valueRaw) => {
    const value = typeof valueRaw === "string" ? valueRaw.split(",") : valueRaw;
    const allDays = WEEKDAYS.map((d) => d.value);
    const isAllCurrently =
      Array.isArray(pendingFilters.youbi) && pendingFilters.youbi.length === allDays.length;

    if (value.includes(ALL_OPTION)) {
      setPendingFilters((prev) => ({ ...prev, youbi: isAllCurrently ? [] : allDays }));
      return;
    }

    const next = Array.isArray(value) ? value : [];
    const normalized = next.length === allDays.length ? allDays : next;

    setPendingFilters((prev) => ({ ...prev, youbi: normalized }));
  };

  const routeGroupError =
    routeGroupOptions.length > 0 &&
    (!Array.isArray(pendingFilters.routeGroup) || pendingFilters.routeGroup.length === 0);

  const youbiError =
    WEEKDAYS.length > 0 &&
    (!Array.isArray(pendingFilters.youbi) || pendingFilters.youbi.length === 0);

  if (showCreateTripForm && selectedRoute && selectedPattern) {
    return (
      <CreateTripForm
        route_id={selectedRoute?.route_id}
        selectedRoutePattern={selectedPattern}
        service_id_list={serviceIdList}
        scenarioId={scenarioId}
        stops_list={stops_list}
        onSuccess={() => setShowCreateTripForm(false)}
        onSave={onSave}
        onCancel={() => setShowCreateTripForm(false)}
        loadingTripActions={loadingTripActions}
        loadingEditTrips={loadingEditTrips}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
        templateTripData={templateTripData}
        duplicateLock
      />
    );
  }

  if (showDuplicateTripForm && tripDetailEditData && selectedRoute) {
    return (
      <DuplicateTripForm
        route_id={selectedRoute?.route_id}
        service_id_list={serviceIdList}
        scenarioId={scenarioId}
        stops_list={stops_list}
        tripData={tripDetailEditData}
        onSave={onSave}
        onSuccess={() => setShowDuplicateTripForm(false)}
        onCancel={() => setShowDuplicateTripForm(false)}
        loadingTripActions={loadingTripActions}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
      />
    );
  }

  if (showEditTripForm && tripDetailEditData) {
    return (
      <EditTripForm
        service_id_list={serviceIdList}
        scenarioId={scenarioId}
        stops_list={stops_list}
        tripData={tripDetailEditData}
        onSuccess={() => setShowEditTripForm(false)}
        onEdit={onEdit}
        onCancel={() => setShowEditTripForm(false)}
        loadingTripActions={loadingTripActions}
        shapeData={shapeData}
        previewShapeData={previewShapeData}
      />
    );
  }

  return (
    <Box>
      <RoutePatternMap
        open={mapOpen}
        onClose={() => {
          setMapOpen(false);
          setSelectedRouteForMap(null);
          setSelectedRouteColor(null);
        }}
        shape={
          Array.isArray(shapeData) && shapeData.length > 0
            ? shapeData.map(([lng, lat]) => [lat, lng])
            : []
        }
        routeData={selectedRouteForMap}
        routeColor={selectedRouteColor}
      />

      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          size="small"
          color="primary"
          disabled={Object.values(selectedTrips).every((v) => !v)}
          onClick={() => {
            const selectedInfos = getSelectedTripInfos();
            if (selectedInfos.length === 0) return;
            setTripsToConfirm(selectedInfos);
            setShowDiscontinueDialog(true);
          }}
        >
          {BUTTONS.common.delete}
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 220 }} error={routeGroupError}>
          <InputLabel id="route-group-filter-label">{LABELS.trip.routeGroup}</InputLabel>
          <Select
            labelId="route-group-filter-label"
            multiple
            input={<OutlinedInput label={LABELS.trip.routeGroup} />}
            value={pendingFilters.routeGroup}
            onChange={(e) => handleRouteGroupChange(e.target.value)}
            renderValue={(selected) => {
              const all = routeGroupOptions;
              if (!Array.isArray(selected) || selected.length === 0) return LABELS.common.all;
              if (all.length > 0 && selected.length === all.length) return LABELS.common.all;
              return MESSAGES.calendar.selectedCount(selected.length);
            }}
          >
            <MenuItem value={ALL_OPTION}>
              <Checkbox
                checked={
                  routeGroupOptions.length > 0 &&
                  Array.isArray(pendingFilters.routeGroup) &&
                  pendingFilters.routeGroup.length === routeGroupOptions.length
                }
              />
              <ListItemText primary={LABELS.common.all} />
            </MenuItem>
            {routeGroupOptions.map((g) => (
              <MenuItem key={g} value={g}>
                <Checkbox checked={pendingFilters.routeGroup.indexOf(g) > -1} />
                <ListItemText primary={g} />
              </MenuItem>
            ))}
          </Select>
          {routeGroupError && <FormHelperText>{MESSAGES.validation.selectAtLeastOne}</FormHelperText>}
        </FormControl>

        <TextField
          label={LABELS.common.routeId}
          variant="outlined"
          size="small"
          sx={{ mb: 2, minWidth: 140 }}
          inputRef={routeIdInputRef}
          defaultValue={appliedFilters.routeId}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="direction-filter-label" shrink>
            {LABELS.common.direction}
          </InputLabel>

          <Select
            labelId="direction-filter-label"
            value={pendingFilters.directionId}
            label={LABELS.common.direction}
            displayEmpty
            onChange={(e) =>
              setPendingFilters((prev) => ({ ...prev, directionId: String(e.target.value) }))
            }
            renderValue={(selected) => {
              if (!selected) return LABELS.common.all;
              const key = String(selected);
              return directionMap?.[key] ?? key;
            }}
          >
            <MenuItem value="">
              <em>{LABELS.common.all}</em>
            </MenuItem>
            {directionOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 220 }} error={youbiError}>
          <InputLabel id="youbi-filter-label">{LABELS.common.day}</InputLabel>
          <Select
            labelId="youbi-filter-label"
            multiple
            input={<OutlinedInput label={LABELS.common.day} />}
            value={pendingFilters.youbi}
            onChange={(e) => handleYoubiChange(e.target.value)}
            renderValue={(selected) => {
              if (!Array.isArray(selected) || selected.length === 0) return LABELS.common.all;
              if (selected.length === WEEKDAYS.length) return LABELS.common.all;
              return MESSAGES.calendar.selectedCount(selected.length);
            }}
          >
            <MenuItem value={ALL_OPTION}>
              <Checkbox
                checked={
                  Array.isArray(pendingFilters.youbi) &&
                  pendingFilters.youbi.length === WEEKDAYS.length
                }
              />
              <ListItemText primary={LABELS.common.all} />
            </MenuItem>
            {WEEKDAYS.map((d) => (
              <MenuItem key={d.value} value={d.value}>
                <Checkbox checked={pendingFilters.youbi.indexOf(d.value) > -1} />
                <ListItemText primary={d.label} />
              </MenuItem>
            ))}
          </Select>
          {youbiError && <FormHelperText>{MESSAGES.validation.selectAtLeastOne}</FormHelperText>}
        </FormControl>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            size="small"
            disabled={routeGroupError || youbiError}
            onClick={() => {
              if (routeGroupError || youbiError) return;
              const routeIdValue = routeIdInputRef.current ? routeIdInputRef.current.value : "";
              setAppliedFilters({
                routeId: routeIdValue,
                directionId: pendingFilters.directionId,
                routeGroup: pendingFilters.routeGroup,
                youbi: pendingFilters.youbi,
              });
            }}
          >
            {BUTTONS.common.applyFilter}
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
          <Button
            variant="text"
            size="small"
            onClick={() => {
              const allGroups = routeGroupOptions;
              const allDays = WEEKDAYS.map((d) => d.value);

              if (routeIdInputRef.current) {
                routeIdInputRef.current.value = "";
              }

              setPendingFilters({
                directionId: "",
                routeGroup: allGroups,
                youbi: allDays,
              });
              setAppliedFilters({
                routeId: "",
                directionId: "",
                routeGroup: allGroups,
                youbi: allDays,
              });
            }}
          >
            {BUTTONS.common.reset}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <EqualColGroup cols={9} leadingPx={ICON_COL_WIDTH} trailingAuto />

          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>
                <TwoLineHeader jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader
                  jp={`${LABELS.route.routeShortName} / ${LABELS.common.routeLongName}`}
                  en={`${LABELS.gtfs.routeShortName} / ${LABELS.gtfs.routeLongName}`}
                  level="parent"
                />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.route.internalPatternId} en="" level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.common.section} en="" level="parent" />
              </TableCell>
              <TableCell>
                <TwoLineHeader jp={LABELS.trip.totalTrips} level="parent" />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRoutes.flatMap((route) => {
              const routePatterns = Array.isArray(route.route_patterns) ? route.route_patterns : [];
              if (!routePatterns.length) return [];

              return routePatterns
                .map((pattern) => {
                  const trips = Array.isArray(pattern.trips) ? pattern.trips : [];
                  const sortedTrips = [...trips].sort(
                    (a, b) => timeToSeconds(a?.departure_time) - timeToSeconds(b?.departure_time)
                  );
                  const tripPassesFilters = (trip) => {
                    const dirId = trip?.direction_id ?? pattern.direction_id;
                    const srvId = trip?.service_id ?? pattern.service_id;
                    return matchesDirectionFilter(dirId) && matchesYoubiFilter(srvId);
                  };
                  const filteredTrips = sortedTrips.filter(tripPassesFilters);
                  const patternPassesFilters = tripPassesFilters({
                    direction_id: pattern.direction_id,
                    service_id: pattern.service_id,
                  });

                  if (
                    (appliedFilters.directionId || (appliedFilters.youbi?.length ?? 0) > 0) &&
                    !patternPassesFilters &&
                    filteredTrips.length === 0
                  ) {
                    return null;
                  }

                  const earliestTripId = filteredTrips[0]?.trip_id;
                  const totalTripCount = filteredTrips.length;
                  const patternServiceText = (() => {
                    const ids = [...new Set(filteredTrips.map((t) => t.service_id))].filter(Boolean);
                    return ids.length === 1 ? ids[0] : pattern.service_id;
                  })();
                  const dirDisplay = (() => {
                    const ids = [...new Set(filteredTrips.map((t) => String(t.direction_id)))].filter(Boolean);
                    const dirId = ids.length === 1 ? ids[0] : pattern.direction_id;
                    return directionMap[dirId] || "-";
                  })();
                  const isGeneratedDir = trips.some((t) => t.is_direction_id_generated);
                  const patternOpen = !!openPatterns[pattern.pattern_id];

                  return (
                    <React.Fragment key={`${route.route_id}-${pattern.pattern_id}`}>
                      <TableRow>
                        <TableCell sx={{ width: ICON_COL_WIDTH }}>
                          <IconButton size="small" onClick={() => togglePatternRow(pattern.pattern_id)}>
                            {patternOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>

                        <EllipsizedCellWithTooltip title={route.route_id ?? ""}>{route.route_id}</EllipsizedCellWithTooltip>
                        <EllipsizedCellWithTooltip
                          title={
                            route.route_short_name && route.route_long_name
                              ? `${route.route_short_name} / ${route.route_long_name}`
                              : route.route_short_name || route.route_long_name || ""
                          }
                        >
                          {(() => {
                            const shortName = route.route_short_name?.trim();
                            const longName = route.route_long_name?.trim();
                            if (shortName && longName) return `${shortName} / ${longName}`;
                            return shortName || longName || "-";
                          })()}
                        </EllipsizedCellWithTooltip>

                        <EllipsizedCellWithTooltip title={pattern.pattern_id ?? ""}>
                          {pattern.pattern_id}
                        </EllipsizedCellWithTooltip>

                        <TableCell>
                          <Tooltip
                            title={
                              isGeneratedDir
                                ? MESSAGES.trip.systemGeneratedTooltip
                                : directionMap[pattern.direction_id] || "-"
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
                                color: isGeneratedDir ? "#1E88E5" : "inherit",
                                fontWeight: isGeneratedDir ? 700 : "normal",
                                cursor: "default",
                              }}
                            >
                              {dirDisplay}
                            </Box>
                          </Tooltip>
                        </TableCell>

                        <EllipsizedCellWithTooltip title={patternServiceText ?? ""}>
                          {patternServiceText || "-"}
                        </EllipsizedCellWithTooltip>

                        <EllipsizedCellWithTooltip title={pattern.headways ?? ""}>
                          {pattern.headways ?? "-"}
                        </EllipsizedCellWithTooltip>

                        <EllipsizedCellWithTooltip title={String(totalTripCount)}>
                          {totalTripCount}
                        </EllipsizedCellWithTooltip>

                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {(() => {
                            const earliest = earliestTripId;
                            return (
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={!earliest}
                                onClick={async () => {
                                  try {
                                    if (!earliest) return;
                                    const detail = await onFetchDetail(earliest);
                                    const stopIds = (detail?.stop_times || []).map((s) => s.stop_id) || [];
                                    await previewShapeData({ scenario_id: scenarioId, stop_ids: stopIds });
                                    const rid = String(route.route_id ?? "");

                                    const stopSeqFromDetail = (() => {
                                      if (Array.isArray(pattern.stop_sequence) && pattern.stop_sequence.length) {
                                        return pattern.stop_sequence;
                                      }
                                      const stopTimes = Array.isArray(detail?.stop_times) ? detail.stop_times : [];
                                      if (!stopTimes.length) return [];
                                      return [...stopTimes]
                                        .map((st, idx) => {
                                          const stop = stopsData.find((s) => String(s.stop_id) === String(st.stop_id));
                                          const latlngFromDetail =
                                            Array.isArray(st.stop_latlng) &&
                                              st.stop_latlng.length >= 2 &&
                                              st.stop_latlng[0] != null &&
                                              st.stop_latlng[1] != null
                                              ? st.stop_latlng
                                              : null;
                                          const latlngFromStop = stop
                                            ? Array.isArray(stop.stop_latlng) && stop.stop_latlng.length >= 2
                                              ? stop.stop_latlng
                                              : [stop.stop_lat, stop.stop_lon]
                                            : null;
                                          const latlng = latlngFromDetail || latlngFromStop || [];
                                          return {
                                            stop_id: st.stop_id,
                                            stop_name: stop?.stop_name ?? st.stop_name ?? "",
                                            stop_sequence: Number(st.stop_sequence ?? idx + 1),
                                            latlng,
                                          };
                                        })
                                        .filter(
                                          (s) =>
                                            Array.isArray(s.latlng) &&
                                            s.latlng.length >= 2 &&
                                            s.latlng[0] != null &&
                                            s.latlng[1] != null
                                        )
                                        .sort((a, b) => Number(a.stop_sequence ?? 0) - Number(b.stop_sequence ?? 0));
                                    })();

                                    let routeDataForMap = {
                                      route_id: route.route_id,
                                      route_short_name: route.route_short_name,
                                      route_long_name: route.route_long_name,
                                      route_type: route.route_type,
                                      agency_id: route.agency_id,
                                      geojson_data: route.geojson_data,
                                      route_patterns: [pattern],
                                    };
                                    if (Array.isArray(routeGroups)) {
                                      for (const group of routeGroups) {
                                        if (!group || !Array.isArray(group.routes)) continue;
                                        const matchRoute = group.routes.find((r) => String(r?.route_id) === rid);
                                        if (matchRoute) {
                                          const pats = Array.isArray(matchRoute.route_patterns)
                                            ? matchRoute.route_patterns
                                            : [];
                                          const matchPattern = pats.find((p) => p && p.pattern_id === pattern.pattern_id);
                                          routeDataForMap = {
                                            route_id: matchRoute.route_id,
                                            route_short_name: matchRoute.route_short_name,
                                            route_long_name: matchRoute.route_long_name,
                                            route_type: matchRoute.route_type,
                                            agency_id: matchRoute.agency_id,
                                            geojson_data: matchRoute.geojson_data,
                                            route_patterns: matchPattern ? [matchPattern] : [pattern],
                                          };
                                          break;
                                        }
                                      }
                                    }

                                    const basePattern = (routeDataForMap.route_patterns || [])[0] || pattern;
                                    const effectiveStopSeq =
                                      stopSeqFromDetail.length > 0
                                        ? stopSeqFromDetail
                                        : Array.isArray(basePattern.stop_sequence)
                                          ? basePattern.stop_sequence
                                          : [];

                                    routeDataForMap = {
                                      ...routeDataForMap,
                                      route_patterns: [{ ...basePattern, stop_sequence: effectiveStopSeq }],
                                    };

                                    setSelectedRouteForMap(routeDataForMap);
                                    setSelectedRouteColor(routeColorsMap[rid] || null);
                                    setMapOpen(true);
                                  } catch (_) { }
                                }}
                              >
                                {BUTTONS.stop.showMap}
                              </Button>
                            );
                          })()}
                        </TableCell>
                      </TableRow>

                      {filteredTrips.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={9} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                            <Collapse in={patternOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 1 }}>
                                <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                                  <EqualColGroup cols={6} leadingPx={CHECKBOX_COL_WIDTH} trailingAuto />
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={checkboxCellSx} align="center">
                                        <Box sx={centerBoxSx}>
                                          <Checkbox
                                            size="small"
                                            sx={checkboxSx}
                                            indeterminate={
                                              filteredTrips.some((t) => selectedTrips[t.trip_id]) &&
                                              !filteredTrips.every((t) => selectedTrips[t.trip_id])
                                            }
                                            checked={
                                              filteredTrips.length > 0 &&
                                              filteredTrips.every((t) => selectedTrips[t.trip_id])
                                            }
                                            onChange={() => handleSelectAllTrips(filteredTrips)}
                                          />
                                        </Box>
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader jp={LABELS.trip.tripId} en={LABELS.gtfs.tripId} level="sub" />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader jp={LABELS.trip.tripName} en={LABELS.gtfs.tripShortName} level="sub" />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader jp={LABELS.trip.tripHeadsign} en={LABELS.gtfs.tripHeadsign} level="sub" />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader jp={LABELS.trip.departureTime} en={LABELS.gtfs.departureTime} level="sub" />
                                      </TableCell>
                                      <TableCell />
                                    </TableRow>
                                  </TableHead>

                                  <TableBody>
                                    {filteredTrips.map((trip) => (
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

                                        <EllipsizedCellWithTooltip title={trip.trip_id ?? ""}>
                                          {trip.trip_id}
                                        </EllipsizedCellWithTooltip>

                                        <EllipsizedCellWithTooltip title={trip.trip_short_name ?? ""}>
                                          {trip.trip_short_name}
                                        </EllipsizedCellWithTooltip>

                                        <EllipsizedCellWithTooltip title={trip.trip_headsign ?? ""}>
                                          {trip.trip_headsign}
                                        </EllipsizedCellWithTooltip>

                                        <EllipsizedCellWithTooltip title={trip.departure_time ?? ""}>
                                          {trip.departure_time}
                                        </EllipsizedCellWithTooltip>

                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              justifyContent: "flex-start",
                                              alignItems: "center",
                                              gap: 1,
                                            }}
                                          >
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              onClick={() => {
                                                onFetchDetail(trip.trip_id).then((data) => {
                                                  setTripDetailEditData(data);
                                                  setSelectedRoute(route);
                                                  setSelectedPattern(pattern);
                                                  setShowEditTripForm(true);
                                                });
                                              }}
                                            >
                                              {BUTTONS.common.edit}
                                            </Button>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>

                                <Button
                                  size="small"
                                  sx={{ mt: 1 }}
                                  onClick={() => {
                                    setSelectedRoute(route);
                                    setSelectedPattern(pattern);
                                    if (earliestTripId) {
                                      onFetchDetail(earliestTripId)
                                        .then((data) => {
                                          setTemplateTripData(data);
                                          setShowCreateTripForm(true);
                                        })
                                        .catch(() => {
                                          setTemplateTripData(null);
                                          setShowCreateTripForm(true);
                                        });
                                    } else {
                                      setTemplateTripData(null);
                                      setShowCreateTripForm(true);
                                    }
                                  }}
                                >
                                  {BUTTONS.trip.addTrip}
                                </Button>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
                .filter(Boolean);
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <DeleteTripConfirmDialog
        open={showDiscontinueDialog}
        onClose={() => setShowDiscontinueDialog(false)}
        onConfirm={() => {
          const payload = Object.keys(selectedTrips);
          onDelete(scenarioId, payload);
          setShowDiscontinueDialog(false);
          setSelectedTrips({});
        }}
        trips={tripsToConfirm}
      />
    </Box>
  );
};

export default TripListTab;
