import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useDeferredValue,
  useTransition,
  memo,
  Suspense,
  lazy,
  useMemo,
} from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Tooltip,
  CircularProgress,
  Backdrop,
  TableContainer,
  Paper,
  Collapse,
  IconButton,
  Checkbox,
  Divider,
  Stack,
  Fab,
  Autocomplete,
  TextField,
  ListItemText,
  Popover,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MapIcon from "@mui/icons-material/Map";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { HexColorPicker } from "react-colorful";
import { EqualColGroup, cellTextSx } from "../TableCols";
import { directionMap } from "../../constant/gtfs";
import RoutePatternMap from "../edit/RouteEdit/RoutePatternMap";
import { alpha } from "@mui/material/styles";
import { formatSectionLabel } from "../../utils/text";
import { GTFS } from "../../strings/domains/gtfs";

const RouteGroupMap = lazy(() => import("./RouteGroupMap"));

const ICON_COL_WIDTH = 48;
const INDENT_PER_LEVEL = 10;

const routeGroupUi = GTFS.import.detail.routeGroupTab;

const normalizeKeyword = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const keyword = value.keyword ?? value.name ?? value.label ?? null;
    if (typeof keyword === "string") return keyword.trim();
    const id = value.keyword_id ?? value.id ?? null;
    return id != null ? String(id) : "";
  }
  return String(value).trim();
};

const getPatternKeywords = (pattern) => {
  const raw = pattern?.keywords;
  if (Array.isArray(raw)) return raw.map(normalizeKeyword).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

/** Global body-cell typography for all tables */
const BODY_CELL_SX = {
  "& td": {
    fontSize: 12,
    lineHeight: "20px",
    color: "text.primary",
  },
};

/** Header with JP/EN stacked labels */
function TwoLineHeader({ jp, en, level = "parent" }) {
  const hasEn = !!en && en.trim().length > 0;
  const jpColor = level === "parent" ? "text.primary" : "#616161";
  const enColor = level === "parent" ? "text.secondary" : "#9e9e9e";
  return (
    <Box>
      <Typography
        fontWeight="bold"
        fontSize={14}
        noWrap
        color={jpColor}
        sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
      >
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
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {hasEn ? en : "x"}
      </Typography>
    </Box>
  );
}

function TwoLineHeaderWithTooltip({ jp, en, level = "parent" }) {
  const title = [jp, en].filter(Boolean).join("\n");
  return (
    <Tooltip title={title ?? ""} arrow>
      <Box sx={{ minWidth: 0 }}>
        <TwoLineHeader jp={jp} en={en} level={level} />
      </Box>
    </Tooltip>
  );
}

/** Ellipsized cell with tooltip */
export function EllipsizedCell({ title, children, sx }) {
  return (
    <TableCell
      sx={{
        ...cellTextSx,
        fontSize: 12,
        lineHeight: "20px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 0,
        ...sx,
      }}
    >
      <Tooltip title={title ?? ""} arrow>
        <Box
          component="span"
          sx={{
            display: "block",
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

export function EllipsizedText({ title, children, sx }) {
  return (
    <Tooltip title={title ?? ""} arrow>
      <Box
        component="span"
        sx={{
          display: "block",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...sx,
        }}
      >
        {children ?? "-"}
      </Box>
    </Tooltip>
  );
}

const gKey = (g) => g.keyword_id ?? g.keyword;
const gLabel = (g) => g.keyword ?? String(g.keyword_id ?? "");

/** Floating multi-group map tool */
function FloatingMapTool({
  open,
  onClose,
  routeGroups,
  stopGroupsGeojson,
  checkedGroups,
  checkedRoutes,
  mapProps,
}) {
  if (!open) return null;
  return (
    <Box
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 1400,
        width: 800,
        height: 520,
        bgcolor: "#fff",
        borderRadius: 3,
        boxShadow: 8,
        overflow: "hidden",
        border: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          bgcolor: "#f5f5f5",
          borderBottom: "1px solid #eee",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 16 }}>{routeGroupUi.mapTool.title}</span>
        <IconButton size="small" onClick={onClose} aria-label={GTFS.common.actions.close}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Suspense
          fallback={
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          <RouteGroupMap
            routeGroups={routeGroups}
            stopGroupsGeojson={stopGroupsGeojson}
            checkedGroups={checkedGroups}
            checkedRoutes={checkedRoutes}
            {...mapProps}
          />
        </Suspense>
      </Box>
    </Box>
  );
}

/** Child route row */
const RouteRow = memo(
  ({
    route,
    index,
    onToggleExpand,
    expanded,
    disableDrag,
    groupId,
    checkedRoutes,
    toggleRouteSelect,
  }) => {
    return (
      <Draggable
        draggableId={String(route.route_id)}
        index={index}
        isDragDisabled={disableDrag}
      >
        {(p, snapshot) => (
          <TableRow
            ref={p.innerRef}
            {...p.draggableProps}
            {...p.dragHandleProps}
            sx={{
              background: snapshot.isDragging ? "#e3f2fd" : "inherit",
              cursor: disableDrag ? "default" : "move",
              transition: "background 0.2s",
            }}
          >
            <TableCell
              sx={{ width: ICON_COL_WIDTH, fontSize: 12, lineHeight: "20px" }}
            >
              <IconButton
                size="small"
                onClick={onToggleExpand}
                aria-label={expanded ? routeGroupUi.mapTool.aria.collapse : routeGroupUi.mapTool.aria.expand}
              >
                {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              </IconButton>
            </TableCell>

            <TableCell
              sx={{
                ...cellTextSx,
                fontSize: 12,
                lineHeight: "20px",
                display: "flex",
                alignItems: "center",
                gap: 1,
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <Checkbox
                size="small"
                checked={checkedRoutes.includes(route.route_id)}
                onChange={() => toggleRouteSelect(route.route_id, groupId)}
              />
              <EllipsizedText title={route.route_id ?? ""} sx={{ flex: 1 }}>
                {route.route_id}
              </EllipsizedText>
            </TableCell>

            <EllipsizedCell title={route.route_short_name}>
              {route.route_short_name}
            </EllipsizedCell>
            <EllipsizedCell title={route.route_long_name}>
              {route.route_long_name}
            </EllipsizedCell>
          </TableRow>
        )}
      </Draggable>
    );
  }
);

export default function RouteGroupTabNested({
  routeGroups = [],
  stopGroupsGeojson = null,
  onSave,
  onReload,
  onSaveColor,
  loading: externalLoading = false,
  allowDragWhileMapOpen = false,
  mapProps = {},
  filterOptions = [],
  onCreateGroup,
  onDeleteGroup,
  onRenameGroup,
}) {
  const [groups, setGroups] = useState([]);
  const originalGroups = useRef([]);
  const [dirty, setDirty] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [dialogs, setDialogs] = useState({
    map: false,
    confirm: false,
    newGroup: false,
    delete: false,
  });
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [pendingMoves, setPendingMoves] = useState([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#cccccc");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dragging, setDragging] = useState(false);

  // inline rename state
  const [editingName, setEditingName] = useState(null); // { key, draft }

  // Color picker state (ref-anchored per group)
  const [colorPickerOpenGroupId, setColorPickerOpenGroupId] = useState(null);
  const swatchRefs = useRef(new Map());

  const [mapOpen, setMapOpen] = useState(false);
  const [checkedGroups, setCheckedGroups] = useState([]);
  const [checkedRoutes, setCheckedRoutes] = useState([]);

  // keyword filter state (pattern-level)
  const [selectedFilters, setSelectedFilters] = useState([]);
  const normalizedFilterOptions = useMemo(() => {
    const list = Array.isArray(filterOptions) ? filterOptions : [];
    const normalized = list.map(normalizeKeyword).filter(Boolean);
    return Array.from(new Set(normalized));
  }, [filterOptions]);

  // IMPORTANT: keep groups and routes; only filter the patterns list
  const displayedGroups = useMemo(() => {
    const hasFilter = selectedFilters?.length > 0;
    const selectedSet = hasFilter
      ? new Set(selectedFilters.map(normalizeKeyword).filter(Boolean))
      : null;

    const mapped = (groups || []).map((g) => {
      const routes = (g.routes || []).map((r) => {
        const pats = r.route_patterns || [];
        const filteredPatterns = hasFilter
          ? pats.filter(
              (p) => getPatternKeywords(p).some((kw) => selectedSet?.has(kw))
            )
          : pats;

        return { ...r, route_patterns: filteredPatterns };
      });

      const filteredRoutes = hasFilter
        ? routes.filter((r) => (r.route_patterns || []).length > 0)
        : routes;

      return { ...g, routes: filteredRoutes };
    });

    return hasFilter ? mapped.filter((g) => (g.routes || []).length > 0) : mapped;
  }, [groups, selectedFilters]);

  const dDisplayedGroups = useDeferredValue(displayedGroups);

  // Color for the selected route, based on its group's keyword_color
  const selectedRouteColor = useMemo(() => {
    if (!selectedRoute) return null;
    const rid = String(selectedRoute.route_id);
    const grp = (dDisplayedGroups || []).find(
      (g) =>
        Array.isArray(g?.routes) &&
        g.routes.some((r) => String(r.route_id) === rid)
    );
    const raw = grp?.keyword_color;
    if (!raw) return null;
    const hex = String(raw).replace(/^#?/, "");
    return `#${hex}`;
  }, [selectedRoute, dDisplayedGroups]);

  const loadGroups = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      try {
        const data = Array.isArray(routeGroups) ? routeGroups : [];
        setGroups(data);
        originalGroups.current = JSON.parse(JSON.stringify(data));
        setDirty(false);
        setExpandedGroups({});
        setExpandedRoutes({});
      } finally {
        setLoading(false);
      }
    }, 0);
  }, [routeGroups]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const toggleGroupRow = (key) =>
    setExpandedGroups((p) => ({ ...p, [key]: !p[key] }));
  const toggleRouteRow = (routeId) =>
    setExpandedRoutes((p) => ({ ...p, [routeId]: !p[routeId] }));

  const getRouteIdsInGroup = useCallback(
    (groupId) =>
      groups.find((g) => gKey(g) === groupId)?.routes.map((r) => r.route_id) ||
      [],
    [groups]
  );

  const toggleGroupSelect = (groupId) => {
    const routeIds = getRouteIdsInGroup(groupId);
    setCheckedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
    setCheckedRoutes((prev) => {
      const inGroup = new Set(routeIds);
      const remaining = prev.filter((id) => !inGroup.has(id));
      return checkedGroups.includes(groupId)
        ? remaining
        : [...remaining, ...routeIds];
    });
  };

  const toggleRouteSelect = (routeId, groupId) => {
    if (checkedGroups.includes(groupId)) {
      const routeIds = getRouteIdsInGroup(groupId);
      setCheckedGroups((p) => p.filter((g) => g !== groupId));
      setCheckedRoutes((p) => [
        ...p.filter((id) => !routeIds.includes(id)),
        routeId,
      ]);
      return;
    }
    setCheckedRoutes((p) =>
      p.includes(routeId) ? p.filter((id) => id !== routeId) : [...p, routeId]
    );
  };

  const handleDragEnd = useCallback(
    (res) => {
      const { source, destination, draggableId } = res;
      if (!destination) return;

      const sKey = source.droppableId;
      const dKey = destination.droppableId;
      if (!sKey || !dKey) return;

      startTransition(() => {
        setGroups((prev) => {
          const visibleIdsByGroup = new Map();
          for (const g of prev) {
            const key = gKey(g);
            const ids = (g.routes || []).map((r) => r.route_id);
            visibleIdsByGroup.set(key, ids);
          }

          const srcIdx = prev.findIndex((g) => gKey(g) === sKey);
          const dstIdx = prev.findIndex((g) => gKey(g) === dKey);
          if (srcIdx < 0 || dstIdx < 0) return prev;

          const srcRoutes = [...(prev[srcIdx].routes || [])];
          const mvIdx = srcRoutes.findIndex(
            (r) => String(r.route_id) === String(draggableId)
          );
          if (mvIdx < 0) return prev;
          const [mv] = srcRoutes.splice(mvIdx, 1);

          const dstRoutes =
            srcIdx === dstIdx ? srcRoutes : [...(prev[dstIdx].routes || [])];

          const dstVisibleIds = visibleIdsByGroup.get(dKey) || [];
          const anchorId = dstVisibleIds[destination.index];

          let insertAt;
          if (anchorId == null) {
            insertAt = dstRoutes.length;
          } else {
            insertAt = dstRoutes.findIndex((r) => r.route_id === anchorId);
            if (insertAt < 0) insertAt = dstRoutes.length;
          }

          dstRoutes.splice(insertAt, 0, mv);

          const next = [...prev];
          next[srcIdx] = { ...prev[srcIdx], routes: srcRoutes };
          next[dstIdx] = { ...prev[dstIdx], routes: dstRoutes };
          return next;
        });

        setDirty(true);
      });
    },
    [startTransition]
  );

  const diffMoves = () => {
    const before = {};
    originalGroups.current.forEach((g) =>
      (g.routes || []).forEach((r) => (before[r.route_id] = gKey(g)))
    );

    const moves = [];
    groups.forEach((g) =>
      (g.routes || []).forEach((r) => {
        const gidNow = gKey(g);
        if (before[r.route_id] !== gidNow) {
          const oldGKey = before[r.route_id];
          const oldGObj = originalGroups.current.find((og) => gKey(og) === oldGKey);
          moves.push({
            route_id: r.route_id,
            old_group: oldGKey,
            old_group_label: oldGObj ? gLabel(oldGObj) : String(oldGKey ?? ""),
            new_group: gidNow,
            new_group_label: gLabel(g),
          });
        }
      })
    );
    return moves;
  };

  // ---- Map view state
  const [mapCenter, setMapCenter] = useState([36.75, 137.13]);
  const [mapZoom, setMapZoom] = useState(12);

  const handleMapMove = useCallback((center, zoom) => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, []);

  const mergedMapProps = useMemo(
    () => ({
      ...mapProps,
      center: mapCenter,
      zoom: mapZoom,
      onMove: handleMapMove,
    }),
    [mapProps, mapCenter, mapZoom, handleMapMove]
  );

  // Reset edits
  const handleResetEdits = useCallback(() => {
    const restored = JSON.parse(JSON.stringify(originalGroups.current));
    setGroups(restored);
    setDirty(false);
    setExpandedGroups({});
    setExpandedRoutes({});
    setCheckedGroups([]);
    setCheckedRoutes([]);
    setColorPickerOpenGroupId(null);
    setDialogs((d) => ({ ...d, confirm: false }));
  }, []);

  const handleConfirmSave = useCallback(async () => {
    setLoading(true);
    try {
      await onSave?.(pendingMoves);

      if (typeof onReload === "function") {
        const fresh = await onReload();
        if (Array.isArray(fresh)) {
          setGroups(fresh);
          originalGroups.current = JSON.parse(JSON.stringify(fresh));
        } else {
          const data = Array.isArray(routeGroups) ? routeGroups : [];
          setGroups(data);
          originalGroups.current = JSON.parse(JSON.stringify(data));
        }
      } else {
        originalGroups.current = JSON.parse(JSON.stringify(groups));
      }

      setSelectedFilters([]);
      setExpandedGroups({});
      setExpandedRoutes({});
      setCheckedGroups([]);
      setCheckedRoutes([]);
    } catch (e) {
      console.error(e);
    } finally {
      setDirty(false);
      setDialogs((d) => ({ ...d, confirm: false }));
      setLoading(false);
    }
  }, [onSave, onReload, pendingMoves, routeGroups, groups]);

  // inline rename: start/cancel/save
  const startInlineEdit = (key, currentName) => {
    setEditingName({ key, draft: currentName || "" });
  };

  const cancelInlineEdit = () => {
    setEditingName(null);
  };

  const saveInlineEdit = async () => {
    if (!editingName) return;
    const key = editingName.key;

    const draft = (editingName.draft || "").trim();

    const currentName = groups.find((g) => gKey(g) === key)?.keyword ?? "";

    if (!draft || draft === currentName) {
      setEditingName(null);
      return;
    }

    await onRenameGroup?.({ keyword_id: key, keyword: draft });

    // optimistic UI
    setGroups((prev) => prev.map((g) => (gKey(g) === key ? { ...g, keyword: draft } : g)));

    if (typeof onReload === "function") await onReload();
    setEditingName(null);
  };

  const iconOutlinedButtonSx = (theme) => ({
    minWidth: 40,
    height: 36,
    p: "6px",
    borderColor: alpha(theme.palette.primary.main, 0.5),
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
  });

  return (
    <>
      <Backdrop open={loading || externalLoading} sx={{ zIndex: 2000 }}>
        <CircularProgress />
      </Backdrop>

      <Box sx={{ px: 3, py: 2 }}>
        {/* Top bar */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setDialogs((d) => ({ ...d, newGroup: true }))}
              disabled={dragging || dirty || isPending || loading || externalLoading}
            >
              {routeGroupUi.actions.newGroup}
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={!dirty || isPending || loading || externalLoading}
              onClick={() => {
                const moves = diffMoves();
                setPendingMoves(moves);
                setDialogs((d) => ({ ...d, confirm: true }));
              }}
            >
              {GTFS.common.actions.save}
            </Button>

            <Button
              variant="text"
              size="small"
              disabled={!dirty || isPending || loading || externalLoading}
              onClick={handleResetEdits}
            >
              {GTFS.common.actions.reset}
            </Button>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 2,
              py: 1,
              bgcolor: "#FFF7E0",
              borderRadius: 2,
              border: "1px solid #FFD700",
            }}
          >
            <WarningAmberIcon sx={{ color: "#FF9900", fontSize: 12 }} />
            <Typography
              color="text.secondary"
              fontSize={12}
              fontWeight={500}
              sx={{ lineHeight: 1.6, letterSpacing: 0.2 }}
            >
              {routeGroupUi.help.directionAutofill.line1}
              <br />
              {routeGroupUi.help.directionAutofill.line2}
              <br />
              {routeGroupUi.help.directionAutofill.line3}
            </Typography>
          </Stack>
        </Stack>

        {/* Keyword filter */}
        <Box sx={{ mb: 1 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={normalizedFilterOptions}
            value={selectedFilters}
            onChange={(e, v) => setSelectedFilters(v)}
            getOptionLabel={(o) => o}
            renderOption={(props, option, { selected }) => (
              <li {...props} style={{ display: "flex", alignItems: "center" }}>
                <Checkbox checked={selected} size="small" sx={{ mr: 1 }} />
                <ListItemText primary={option} />
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label={routeGroupUi.filters.keyword}
                size="small"
              />
            )}
            sx={{ minWidth: 240, maxWidth: 360 }}
          />
        </Box>

        {/* ===== PARENT TABLE ===== */}
        <TableContainer component={Paper}>
          <Table size="small" sx={{ tableLayout: "fixed", width: "100%", ...BODY_CELL_SX }}>
            <EqualColGroup cols={3} leadingPx={ICON_COL_WIDTH} trailingAuto />
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>
                  <TwoLineHeader jp={routeGroupUi.table.headers.routeGroup} en="" level="parent" />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              <DragDropContext
                onDragStart={() => setDragging(true)}
                onDragEnd={(res) => {
                  setDragging(false);
                  handleDragEnd(res);
                }}
              >
                {dDisplayedGroups.map((group) => {
                  const key = gKey(group);
                  const isOpen = !!expandedGroups[key];
                  return (
                    <React.Fragment key={key}>
                      <TableRow hover>
                        <TableCell sx={{ width: ICON_COL_WIDTH }}>
                          <IconButton size="small" onClick={() => toggleGroupRow(key)}>
                            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell
                          sx={{
                            ...cellTextSx,
                            fontSize: 12,
                            lineHeight: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            overflow: "visible",
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={checkedGroups.includes(key)}
                            onChange={() => toggleGroupSelect(key)}
                          />
                          <Box sx={{ position: "relative", flexShrink: 0 }}>
                            <Box
                              ref={(el) => {
                                if (el) swatchRefs.current.set(key, el);
                                else swatchRefs.current.delete(key);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setColorPickerOpenGroupId((prev) => (prev === key ? null : key));
                              }}
                              sx={{
                                width: 18,
                                height: 18,
                                borderRadius: "4px",
                                border: "1px solid #ccc",
                                bgcolor: `#${group.keyword_color ?? "cccccc"}`,
                                cursor: "pointer",
                                display: "inline-block",
                              }}
                            />

                            <Popover
                              open={colorPickerOpenGroupId === key && Boolean(swatchRefs.current.get(key))}
                              anchorEl={swatchRefs.current.get(key) || null}
                              onClose={() => setColorPickerOpenGroupId(null)}
                              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                              transformOrigin={{ vertical: "top", horizontal: "left" }}
                              disableAutoFocus
                              disableEnforceFocus
                              slotProps={{
                                root: { sx: { zIndex: 1600 } },
                                paper: {
                                  sx: {
                                    p: 2,
                                    borderRadius: 2,
                                    border: "1px solid #eee",
                                    boxShadow: 4,
                                  },
                                },
                              }}
                            >
                              <HexColorPicker
                                color={`#${group.keyword_color ?? "cccccc"}`}
                                onChange={async (newColor) => {
                                  if (onSaveColor) {
                                    await onSaveColor(key, newColor.replace("#", ""));
                                  }
                                  setGroups((prev) =>
                                    prev.map((g) =>
                                      gKey(g) === key
                                        ? { ...g, keyword_color: newColor.replace("#", "") }
                                        : g
                                    )
                                  );
                                }}
                              />
                            </Popover>
                          </Box>

                          {/* Inline route group name edit */}
                          {editingName?.key === key ? (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                              <TextField
                                size="small"
                                variant="outlined"
                                value={editingName.draft}
                                onChange={(e) => setEditingName((p) => ({ ...p, draft: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveInlineEdit();
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelInlineEdit();
                                  }
                                }}
                                autoFocus
                                sx={{
                                  "& .MuiInputBase-input": { py: 0.5, fontSize: 12, lineHeight: "20px" },
                                  minWidth: 160,
                                  maxWidth: 320,
                                }}
                              />
                              <IconButton
                                size="small"
                                aria-label={GTFS.common.actions.save}
                                onClick={saveInlineEdit}
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label={GTFS.common.actions.cancel}
                                onClick={cancelInlineEdit}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                              <EllipsizedText title={gLabel(group)} sx={{ maxWidth: 360 }}>
                                {gLabel(group)}
                              </EllipsizedText>
                              <IconButton
                                size="small"
                                aria-label={routeGroupUi.actions.editName}
                                onClick={() => startInlineEdit(key, gLabel(group))}
                              >
                                <span className="material-symbols-outlined outlined">edit</span>
                              </IconButton>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", textAlign: "right" }}>
                          <Tooltip title={GTFS.common.actions.delete}>
                            <Button
                              aria-label={GTFS.common.actions.delete}
                              variant="outlined"
                              size="small"
                              disabled={(group.routes?.length ?? 0) > 0}
                              onClick={() => {
                                setDeleteTarget({ key, label: gLabel(group) });
                                setDialogs((d) => ({ ...d, delete: true }));
                              }}
                              sx={iconOutlinedButtonSx}
                            >
                              <span className="material-symbols-outlined outlined">delete</span>
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>

                      {/* ===== CHILD TABLE (Routes) ===== */}
                      <TableRow>
                        <TableCell colSpan={3} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                          <Collapse in={isOpen} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1 }}>
                              <Table size="small" sx={{ tableLayout: "fixed", width: "100%", ...BODY_CELL_SX }}>
                                <EqualColGroup cols={3} leadingPx={ICON_COL_WIDTH} />
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ width: ICON_COL_WIDTH }} />
                                    <TableCell>
                                      <TwoLineHeader jp={routeGroupUi.table.headers.routeId} en="route_id" level="sub" />
                                    </TableCell>
                                    <TableCell>
                                      <TwoLineHeader
                                        jp={routeGroupUi.table.headers.routeShortName}
                                        en="route_short_name"
                                        level="sub"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <TwoLineHeader
                                        jp={routeGroupUi.table.headers.routeLongName}
                                        en="route_long_name"
                                        level="sub"
                                      />
                                    </TableCell>
                                  </TableRow>
                                </TableHead>

                                <Droppable droppableId={String(key)}>
                                  {(provided, snapshot) => (
                                    <TableBody
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      sx={{
                                        background: snapshot.isDraggingOver ? "#FFF9C4" : "inherit",
                                        border: snapshot.isDraggingOver ? "2px dashed #FFD600" : "none",
                                        transition: "all 0.18s",
                                        minHeight: 48,
                                      }}
                                    >
                                      {(group.routes || []).map((route, rIdx) => (
                                        <React.Fragment key={route.route_id}>
                                          <RouteRow
                                            route={route}
                                            index={rIdx}
                                            groupId={key}
                                            checkedRoutes={checkedRoutes}
                                            toggleRouteSelect={toggleRouteSelect}
                                            disableDrag={dialogs.map && !allowDragWhileMapOpen}
                                            expanded={!!expandedRoutes[route.route_id]}
                                            onToggleExpand={() => toggleRouteRow(route.route_id)}
                                          />

                                          {/* Pattern table per route */}
                                          <TableRow>
                                            <TableCell colSpan={8} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                                              <Collapse in={!!expandedRoutes[route.route_id]} timeout="auto" unmountOnExit>
                                                <Table size="small" sx={{ tableLayout: "fixed", width: "100%", ...BODY_CELL_SX }}>
                                                  <EqualColGroup cols={6} />
                                                  <TableHead>
                                                    <TableRow>
                                                      <TableCell>
                                                        <TwoLineHeaderWithTooltip
                                                          jp={routeGroupUi.table.headers.patternId}
                                                          en=""
                                                          level="sub"
                                                        />
                                                      </TableCell>
                                                      <TableCell>
                                                        <TwoLineHeader
                                                          jp={routeGroupUi.table.headers.direction}
                                                          en="direction_id"
                                                          level="sub"
                                                        />
                                                      </TableCell>
                                                      <TableCell>
                                                        <TwoLineHeader
                                                          jp={routeGroupUi.table.headers.serviceId}
                                                          en="service_id"
                                                          level="sub"
                                                        />
                                                      </TableCell>
                                                      <TableCell>
                                                        <TwoLineHeader jp={routeGroupUi.table.headers.segment} en="" level="sub" />
                                                      </TableCell>
                                                      <TableCell>
                                                        <TwoLineHeader jp={routeGroupUi.table.headers.keyword} en="" level="sub" />
                                                      </TableCell>
                                                      <TableCell>
                                                        <TwoLineHeaderWithTooltip jp="" en="" level="sub" />
                                                      </TableCell>
                                                    </TableRow>
                                                  </TableHead>
                                                  <TableBody>
                                                    {(route.route_patterns || []).length === 0 ? (
                                                      <TableRow>
                                                        <TableCell colSpan={6} sx={{ color: "text.secondary" }}>
                                                          {routeGroupUi.help.noPatterns}
                                                        </TableCell>
                                                      </TableRow>
                                                    ) : (
                                                      (route.route_patterns || []).map((pat, pIdx) => (
                                                        <React.Fragment key={pat.pattern_id ?? `${route.route_id}-${pIdx}`}>
                                                          <TableRow>
                                                            <EllipsizedCell title={pat.pattern_id}>
                                                              {pat.pattern_id}
                                                            </EllipsizedCell>

                                                            <EllipsizedCell
                                                              title={
                                                                pat.is_direction_id_generated
                                                                  ? routeGroupUi.help.systemGeneratedInitialValue
                                                                  : directionMap[pat.direction_id] || "-"
                                                              }
                                                            >
                                                              <Box
                                                                component="span"
                                                                sx={{
                                                                  color: pat.is_direction_id_generated ? "#1E88E5" : "inherit",
                                                                  fontWeight: pat.is_direction_id_generated ? 700 : "normal",
                                                                }}
                                                              >
                                                                {directionMap[pat.direction_id] || "-"}
                                                              </Box>
                                                            </EllipsizedCell>

                                                            <EllipsizedCell title={pat.service_id}>
                                                              {pat.service_id}
                                                            </EllipsizedCell>

                                                            <EllipsizedCell title={formatSectionLabel(pat.segment) ?? "-"}>
                                                              {formatSectionLabel(pat.segment) || "-"}
                                                            </EllipsizedCell>

                                                            <EllipsizedCell
                                                              title={
                                                                Array.isArray(pat.keywords) && pat.keywords.length
                                                                  ? pat.keywords.join(", ")
                                                                  : "-"
                                                              }
                                                            >
                                                              {Array.isArray(pat.keywords) && pat.keywords.length
                                                                ? pat.keywords.join(", ")
                                                                : "-"}
                                                            </EllipsizedCell>
                                                            <TableCell sx={{ whiteSpace: "nowrap" }}>
                                                              <Box sx={{ display: "flex", gap: 1 }}>
                                                                <Button
                                                                  variant="outlined"
                                                                  size="small"
                                                                  onClick={() => {
                                                                    let shape = pat.shape || [];

                                                                    if (shape.length === 0 && route.geojson_data?.length > 0) {
                                                                      const routeShape = route.geojson_data[0];
                                                                      shape =
                                                                        routeShape?.coordinates?.map(([lon, lat]) => [lat, lon]) ||
                                                                        [];
                                                                    }

                                                                    if (shape.length === 0 && pat.stop_sequence?.length > 0) {
                                                                      shape = pat.stop_sequence.map((stop) => stop.latlng);
                                                                    }

                                                                    setSelectedRoute(route);
                                                                    setSelectedPattern({ ...pat, shape });
                                                                    setDialogs((d) => ({ ...d, map: true }));
                                                                  }}
                                                                >
                                                                  {routeGroupUi.actions.showMap}
                                                                </Button>
                                                              </Box>
                                                            </TableCell>
                                                          </TableRow>

                                                          {pIdx !== (route.route_patterns?.length ?? 0) - 1 && (
                                                            <TableRow>
                                                              <TableCell colSpan={5} sx={{ py: 0 }}>
                                                                <Divider />
                                                              </TableCell>
                                                            </TableRow>
                                                          )}
                                                        </React.Fragment>
                                                      ))
                                                    )}
                                                  </TableBody>
                                                </Table>
                                              </Collapse>
                                            </TableCell>
                                          </TableRow>
                                        </React.Fragment>
                                      ))}
                                      {((group.routes || []).length === 0) && (
                                        <TableRow>
                                          <TableCell colSpan={4} sx={{ py: 1.5 }}>
                                            <Box
                                              sx={{
                                                minHeight: 44,
                                                border: "2px dashed #FFD600",
                                                borderRadius: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                bgcolor: snapshot.isDraggingOver ? "#FFF9C4" : "#FAFAFA",
                                                fontSize: 12,
                                                color: "text.secondary",
                                              }}
                                            >
                                              {routeGroupUi.actions.dropToAdd}
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      {provided.placeholder}
                                    </TableBody>
                                  )}
                                </Droppable>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </DragDropContext>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Confirm changes dialog */}
        <Dialog
          open={dialogs.confirm}
          onClose={() => setDialogs((d) => ({ ...d, confirm: false }))}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{routeGroupUi.dialogs.confirmTitle}</DialogTitle>
          <DialogContent>
            <Typography>{routeGroupUi.dialogs.confirmBody}</Typography>
            <Typography>
              <br />
            </Typography>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%", ...BODY_CELL_SX }}>
              <EqualColGroup cols={3} />
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TwoLineHeaderWithTooltip jp={routeGroupUi.table.headers.routeId} en="route_id" level="sub" />
                  </TableCell>
                  <TableCell>
                    <TwoLineHeaderWithTooltip jp={routeGroupUi.table.headers.oldGroup} en="" level="sub" />
                  </TableCell>
                  <TableCell>
                    <TwoLineHeaderWithTooltip jp={routeGroupUi.table.headers.newGroup} en="" level="sub" />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingMoves.map((m) => (
                  <TableRow key={m.route_id}>
                    <EllipsizedCell title={m.route_id}>{m.route_id}</EllipsizedCell>
                    <EllipsizedCell title={m.old_group_label}>{m.old_group_label}</EllipsizedCell>
                    <EllipsizedCell title={m.new_group_label}>{m.new_group_label}</EllipsizedCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogs((d) => ({ ...d, confirm: false }))}>
              {GTFS.common.actions.cancel}
            </Button>
            <Button variant="contained" onClick={handleConfirmSave}>
              {GTFS.common.actions.update}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Map dialog - CHANGED to RoutePatternMap */}
        <RoutePatternMap
          open={dialogs.map}
          onClose={() => {
            setDialogs((d) => ({ ...d, map: false }));
            setSelectedPattern(null);
            setSelectedRoute(null);
          }}
          shape={selectedPattern?.shape || []}
          routeData={selectedRoute}
          routeColor={selectedRouteColor}
        />

        {/* Create group dialog */}
        <Dialog
          open={dialogs.newGroup}
          onClose={() => setDialogs((d) => ({ ...d, newGroup: false }))}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{routeGroupUi.dialogs.newGroupTitle}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label={routeGroupUi.dialogs.groupNameLabel}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                size="small"
                fullWidth
                autoFocus
                required
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: 0.5,
                    border: "1px solid #ccc",
                    bgcolor: newGroupColor,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {newGroupColor}
                </Typography>
              </Stack>
              <HexColorPicker color={newGroupColor} onChange={setNewGroupColor} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogs((d) => ({ ...d, newGroup: false }))}>
              {GTFS.common.actions.cancel}
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                const keyword = newGroupName.trim();
                const keyword_color = newGroupColor.replace("#", "");
                const payload = { keyword: keyword, color: keyword_color };
                await onCreateGroup(payload);
              }}
              disabled={!newGroupName.trim()}
            >
              {GTFS.common.actions.create}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete group confirm dialog */}
        <Dialog
          open={Boolean(dialogs.delete && deleteTarget)}
          onClose={() => setDialogs((d) => ({ ...d, delete: false }))}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{routeGroupUi.dialogs.deleteTitle}</DialogTitle>
          <DialogContent dividers>
            <Typography>
              {routeGroupUi.dialogs.deleteBodyTemplate.replace(
                "{groupName}",
                deleteTarget?.label ?? ""
              )}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogs((d) => ({ ...d, delete: false }))}>
              {GTFS.common.actions.cancel}
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                const payload = { keyword: deleteTarget.key };
                await onDeleteGroup(payload);
              }}
            >
              {GTFS.common.actions.delete}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating multi-group map toggle */}
        {!mapOpen && (
          <Fab
            color="primary"
            aria-label="Show Map"
            onClick={() => setMapOpen(true)}
            sx={{ position: "fixed", bottom: 32, right: 32, zIndex: 1500 }}
          >
            <span className="material-symbols-outlined outlined">map</span>
          </Fab>
        )}
        {mapOpen && (
          <FloatingMapTool
            open={mapOpen}
            onClose={() => setMapOpen(false)}
            routeGroups={dDisplayedGroups}
            stopGroupsGeojson={stopGroupsGeojson}
            checkedGroups={checkedGroups}
            checkedRoutes={checkedRoutes}
            mapProps={mergedMapProps}
          />
        )}
      </Box>
    </>
  );
}
