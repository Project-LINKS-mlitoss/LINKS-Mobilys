// components/gtfs/ImportDetailStopGroupTab.jsx
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
  memo,
  Suspense,
  lazy,
} from "react";
import {
  Box,
  Typography,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
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
  Stack,
  TextField,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { groupingMethodMap, groupingMethodOptions } from "../../constant/gtfs";
import { EqualColGroup, cellTextSx } from "../TableCols";
import { GTFS } from "../../strings/domains/gtfs";

const StopGroupMap = lazy(() => import("./StopGroupMap"));

const ICON_COL_WIDTH = 48;
const INDENT_PER_LEVEL = 10;

const stopGroupUi = GTFS.import.detail.stopGroupTab;

function fmt6(n) {
  if (n === null || n === undefined) return "";
  const num = Number(n);
  return Number.isFinite(num) ? num.toFixed(6) : "";
}

function TwoLineHeader({ jp, en, level = "parent" }) {
  const theme = useTheme();
  const hasEn = !!en && en.trim().length > 0;
  const SUB_JP_COLOR = "#616161";
  const SUB_EN_COLOR = "#9e9e9e";
  const jpColor = level === "parent" ? theme.palette.text.primary : SUB_JP_COLOR;
  const enColor = level === "parent" ? theme.palette.text.secondary : SUB_EN_COLOR;

  return (
    <Box>
      <Typography
        fontWeight="bold"
        fontSize={14}
        noWrap
        sx={{ color: jpColor, overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {jp}
      </Typography>
      <Typography
        fontWeight="bold"
        fontSize={12}
        sx={{
          color: enColor,
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

function EllipsizedCell({ title, children, sx }) {
  return (
    <TableCell
      sx={{
        ...cellTextSx,
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
          {children}
        </Box>
      </Tooltip>
    </TableCell>
  );
}

const gKey = (g) => g.stop_name_group || g.stop_id_group;
const gIdKey = (g) => (g.stop_name_group ? "group_id" : "stop_id_group_id");

const StopRow = memo(({ stop, index }) => (
  <Draggable draggableId={`${stop.stop_id}-${index}`} index={index}>
    {(p) => (
      <TableRow ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
        <EllipsizedCell title={stop.stop_id}>{stop.stop_id}</EllipsizedCell>
        <EllipsizedCell title={stop.stop_name}>{stop.stop_name}</EllipsizedCell>
        <EllipsizedCell title={fmt6(stop.stop_lat)}>{fmt6(stop.stop_lat)}</EllipsizedCell>
        <EllipsizedCell title={fmt6(stop.stop_lon)}>{fmt6(stop.stop_lon)}</EllipsizedCell>
        <EllipsizedCell title={stop.stop_code || ""}>{stop.stop_code || ""}</EllipsizedCell>
        <EllipsizedCell title={String(stop.location_type ?? "")}>
          {stop.location_type ?? ""}
        </EllipsizedCell>
      </TableRow>
    )}
  </Draggable>
));

function StopGroupTab({
  stopGroupsByName = [],
  stopGroupsById = [],
  onSave,
  onGroupTypeChange,
  stopGroupingMethod,
  loading: externalLoading = false,
  onLeaveGuardReady,
  onPatchGroupName,
  onPatchGroupId,
}) {
  const [groupTypeCommitted, setGroupTypeCommitted] = useState(stopGroupingMethod);
  const [groupTypeDraft, setGroupTypeDraft] = useState(stopGroupingMethod);
  const [groups, setGroups] = useState([]);
  
  const originalCommittedRef = useRef([]);
  const originalDraftRef = useRef([]);

  const [dirty, setDirty] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [dialogs, setDialogs] = useState({ map: false, confirm: false, leave: false });
  const [pending, setPending] = useState({ moves: [], nextAction: null });
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editing, setEditing] = useState(null);

  // Sync committed state with prop
  useEffect(() => {
    if (stopGroupingMethod && stopGroupingMethod !== groupTypeCommitted) {
      setGroupTypeCommitted(stopGroupingMethod);
      setGroupTypeDraft(stopGroupingMethod);
    }
  }, [stopGroupingMethod, groupTypeCommitted]);

  // Load groups from props (stable via useMemo)
  const currentGroups = useMemo(() => {
    const method = groupTypeDraft;
    if (method === groupingMethodMap.GROUPING_BY_NAME) {
      return Array.isArray(stopGroupsByName) ? stopGroupsByName : [];
    } else {
      return Array.isArray(stopGroupsById) ? stopGroupsById : [];
    }
  }, [groupTypeDraft, stopGroupsByName, stopGroupsById]);

  // Update groups when currentGroups changes
  useEffect(() => {
    if (currentGroups.length > 0 || groups.length === 0) {
      setGroups(currentGroups);
      
      // Update baseline sesuai dengan status committed/draft
      if (groupTypeDraft === groupTypeCommitted) {
        originalCommittedRef.current = JSON.parse(JSON.stringify(currentGroups));
      } else {
        originalDraftRef.current = JSON.parse(JSON.stringify(currentGroups));
      }
    }
  }, [currentGroups, groupTypeDraft, groupTypeCommitted]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirty || isDragging) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty, isDragging]);

  const toggleRow = (key) => setExpandedRows((p) => ({ ...p, [key]: !p[key] }));

  const attemptLeave = useCallback(
    (action) => {
      if (dirty || isDragging) {
        setPending((p) => ({ ...p, nextAction: action || null }));
        setDialogs((d) => ({ ...d, leave: true }));
      } else {
        action?.();
      }
    },
    [dirty, isDragging]
  );

  useEffect(() => {
    onLeaveGuardReady?.(attemptLeave);
  }, [attemptLeave, onLeaveGuardReady]);

  const handleDragEnd = useCallback(
    (res) => {
      setIsDragging(false);
      const { source, destination } = res;
      if (!destination) return;
      const sIdx = +source.droppableId;
      const dIdx = +destination.droppableId;
      if (Number.isNaN(sIdx) || Number.isNaN(dIdx)) return;

      startTransition(() => {
        setGroups((prev) => {
          const next = [...prev];
          const sStops = [...next[sIdx].stops];
          const [mv] = sStops.splice(source.index, 1);

          if (sIdx === dIdx) {
            sStops.splice(destination.index, 0, mv);
            next[sIdx] = { ...next[sIdx], stops: sStops };
          } else {
            const dStops = [...next[dIdx].stops];
            dStops.splice(destination.index, 0, mv);
            next[sIdx] = { ...next[sIdx], stops: sStops };
            next[dIdx] = { ...next[dIdx], stops: dStops };
          }
          return next;
        });
        setDirty(true);
      });
    },
    [startTransition]
  );

  const computeMoves = useCallback(() => {
    const baseline =
      groupTypeDraft === groupTypeCommitted
        ? originalCommittedRef.current
        : originalDraftRef.current;

    if (!Array.isArray(baseline) || baseline.length === 0) return [];

    const before = {};
    baseline.forEach((g) =>
      g?.stops?.forEach((s) => {
        before[s.stop_id] = g[gIdKey(g)];
      })
    );

    const moves = [];
    groups.forEach((g) =>
      g?.stops?.forEach((s) => {
        const gidNow = g[gIdKey(g)];
        if (before[s.stop_id] !== gidNow) {
          const oldGroupKey = before[s.stop_id];
          const oldGObj = baseline.find((og) => og[gIdKey(og)] === oldGroupKey);
          moves.push({
            stop_id: s.stop_id,
            old_group: oldGroupKey,
            old_group_label: oldGObj ? gKey(oldGObj) : "",
            new_group: gidNow,
            new_group_label: gKey(g),
          });
        }
      })
    );
    return moves;
  }, [groups, groupTypeDraft, groupTypeCommitted]);

  const handleResetEdits = useCallback(() => {
    const restored = JSON.parse(JSON.stringify(originalCommittedRef.current || []));
    setGroups(restored);
    setExpandedRows({});
    setIsDragging(false);
    setGroupTypeDraft(groupTypeCommitted);
    setDirty(false);
  }, [groupTypeCommitted]);

  const hasGroupTypeChange = groupTypeDraft !== groupTypeCommitted;
  const groupOptionLabel = hasGroupTypeChange
    ? stopGroupUi.groupOptions.pendingApplyLabel
    : stopGroupUi.groupOptions.label;
  const effectiveGroupType = groupTypeDraft;

  const startInlineEdit = (key, field, currentValue) => {
    setEditing({ key, field, draft: currentValue ?? "" });
  };

  const cancelInlineEdit = () => setEditing(null);

  const saveInlineEdit = async (groupObj) => {
    if (!editing) return;
    const { field, draft } = editing;
    const trimmed = (draft || "").trim();

    const currentIdValue =
      effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME
        ? (groupObj?.stop_group_id_label ?? groupObj?.group_id ?? "")
        : (groupObj?.stop_id_group ?? "");

    const currentNameValue =
      effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME
        ? (groupObj?.stop_name_group ?? "")
        : (groupObj?.stop_group_name_label ?? "");

    const isNoChange =
      (field === "id" && trimmed === String(currentIdValue)) ||
      (field === "name" && trimmed === String(currentNameValue));

    if (!trimmed || isNoChange) {
      setEditing(null);
      return;
    }

    const groupId = groupObj?.[gIdKey(groupObj)];
    try {
      if (field === "name") {
        if (effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME) {
          await onPatchGroupName?.(groupId, { stop_name_keyword: trimmed });
        } else {
          await onPatchGroupId?.(groupId, { stop_group_name_label: trimmed });
        }
      } else if (field === "id") {
        if (effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME) {
          await onPatchGroupName?.(groupId, { stop_group_id_label: trimmed });
        } else {
          await onPatchGroupId?.(groupId, { stop_id_keyword: trimmed });
        }
      }

      setGroups((prev) =>
        prev.map((g) => {
          if (gKey(g) !== gKey(groupObj)) return g;
          if (field === "name") {
            return effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME
              ? { ...g, stop_name_group: trimmed }
              : { ...g, stop_group_name_label: trimmed };
          } else {
            return effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME
              ? { ...g, stop_group_id_label: trimmed }
              : { ...g, stop_id_group: trimmed };
          }
        })
      );
    } finally {
      setEditing(null);
    }
  };

  // Render validation: ensure data matches selected type
  const shouldRenderTable = useMemo(() => {
    if (loading || externalLoading) return false;
    if (!Array.isArray(groups) || groups.length === 0) return false;
    
    // Cek apakah ada data yang valid untuk current grouping type
    if (effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME) {
      return groups.some((g) => g && g.stop_name_group);
    } else if (effectiveGroupType === groupingMethodMap.GROUPING_BY_ID) {
      return groups.some((g) => g && g.stop_id_group);
    }
    return false;
  }, [groups, effectiveGroupType, loading, externalLoading]);

  return (
    <>
      <Backdrop open={loading || externalLoading} sx={{ zIndex: 2000 }}>
        <CircularProgress />
      </Backdrop>
      <Box sx={{ px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              disabled={!dirty || isPending || loading || externalLoading}
              onClick={() => {
                const moves = computeMoves();
                setPending((p) => ({ ...p, moves }));
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
              {stopGroupUi.groupOptions.help.line1}
              <br />
              {stopGroupUi.groupOptions.help.line2}
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2, flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{groupOptionLabel}</InputLabel>
            <Select
              value={groupTypeDraft}
              label={groupOptionLabel}
              onChange={(e) => {
                const val = e.target.value;
                setGroupTypeDraft(val);
                setDirty((prev) => prev || val !== groupTypeCommitted);
              }}
            >
              {groupingMethodOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.value === groupingMethodMap.GROUPING_BY_NAME ? (
                    <>
                      {stopGroupUi.groupOptions.byName}
                      <span style={{ color: "#9e9e9e" }}>&nbsp;stop_name</span>
                    </>
                  ) : o.value === groupingMethodMap.GROUPING_BY_ID ? (
                    <>
                      {stopGroupUi.groupOptions.byId}
                      <span style={{ color: "#9e9e9e" }}>&nbsp;stop_id</span>
                    </>
                  ) : (
                    o.label
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {shouldRenderTable && (
          <TableContainer component={Paper}>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
              <EqualColGroup cols={6} leadingPx={ICON_COL_WIDTH} trailingAuto />
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <TwoLineHeader jp={stopGroupUi.table.headers.stopId} en="" level="parent" />
                  </TableCell>
                  <TableCell>
                    <TwoLineHeader jp={stopGroupUi.table.headers.stopName} en="" level="parent" />
                  </TableCell>
                  <TableCell>
                    <TwoLineHeader jp={stopGroupUi.table.headers.stopLat} en="" level="parent" />
                  </TableCell>
                  <TableCell>
                    <TwoLineHeader jp={stopGroupUi.table.headers.stopLon} en="" level="parent" />
                  </TableCell>
                  <TableCell>
                    <TwoLineHeader jp="" en="" level="parent" />
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
                  {groups.map((group, idx) => {
                    const key = gKey(group);
                    const isOpen = !!expandedRows[key];
                    if (!group || (!group.stop_name_group && !group.stop_id_group)) return null;

                    const displayId =
                      effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME
                        ? (group?.stop_group_id_label ?? group?.group_id ?? "")
                        : (group?.stop_id_group ?? "");

                    const displayName =
                      effectiveGroupType === groupingMethodMap.GROUPING_BY_NAME
                        ? (group?.stop_name_group ?? "")
                        : (group?.stop_group_name_label ?? "");

                    return (
                      <React.Fragment key={key}>
                        <TableRow hover>
                          <TableCell sx={{ width: ICON_COL_WIDTH }}>
                            <IconButton size="small" onClick={() => toggleRow(key)}>
                              {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                          </TableCell>

                          <EllipsizedCell title={displayId}>
                            {editing?.key === key && editing?.field === "id" ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                                <TextField
                                  size="small"
                                  variant="outlined"
                                  value={editing.draft}
                                  onChange={(e) =>
                                    setEditing((p) => ({ ...p, draft: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveInlineEdit(group);
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
                                  onClick={() => saveInlineEdit(group)}
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
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 360,
                                  }}
                                >
                                  {displayId}
                                </Box>
                                <IconButton
                                  size="small"
                                  aria-label={stopGroupUi.actions.editId}
                                  onClick={() => startInlineEdit(key, "id", String(displayId ?? ""))}
                                >
                                <span className="material-symbols-outlined outlined">edit</span>
                                </IconButton>
                              </Box>
                            )}
                          </EllipsizedCell>

                          <EllipsizedCell title={displayName}>
                            {editing?.key === key && editing?.field === "name" ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                                <TextField
                                  size="small"
                                  variant="outlined"
                                  value={editing.draft}
                                  onChange={(e) =>
                                    setEditing((p) => ({ ...p, draft: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveInlineEdit(group);
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
                                    maxWidth: 360,
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  aria-label={GTFS.common.actions.save}
                                  onClick={() => saveInlineEdit(group)}
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
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 360,
                                  }}
                                >
                                  {displayName}
                                </Box>
                                <IconButton
                                  size="small"
                                  aria-label={stopGroupUi.actions.editName}
                                  onClick={() => startInlineEdit(key, "name", String(displayName ?? ""))}
                                >
                                  <span className="material-symbols-outlined outlined">edit</span>
                                </IconButton>
                              </Box>
                            )}
                          </EllipsizedCell>

                          <EllipsizedCell title={fmt6(group.stop_names_lat ?? group.stop_id_lat)}>
                            {fmt6(group.stop_names_lat ?? group.stop_id_lat)}
                          </EllipsizedCell>
                          <EllipsizedCell title={fmt6(group.stop_names_lon ?? group.stop_id_lon)}>
                            {fmt6(group.stop_names_lon ?? group.stop_id_lon)}
                          </EllipsizedCell>

                          <TableCell>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                setSelectedGroup(group);
                                setDialogs((d) => ({ ...d, map: true }));
                              }}
                            >
                              {stopGroupUi.actions.showMap}
                            </Button>
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell colSpan={6} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 1 }}>
                                <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                                  <EqualColGroup cols={6} />
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>
                                        <TwoLineHeader jp={stopGroupUi.table.headers.poleId} en="stop_id" level="sub" />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader
                                          jp={stopGroupUi.table.headers.poleName}
                                          en="stop_name"
                                          level="sub"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader jp={stopGroupUi.table.headers.poleLat} en="stop_lat" level="sub" />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader jp={stopGroupUi.table.headers.poleLon} en="stop_lon" level="sub" />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader
                                          jp={stopGroupUi.table.headers.poleCode}
                                          en="stop_code"
                                          level="sub"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <TwoLineHeader
                                          jp={stopGroupUi.table.headers.poleLocationType}
                                          en="location_type"
                                          level="sub"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>

                                  <Droppable droppableId={String(idx)}>
                                    {(provided, snapshot) => (
                                      <TableBody
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        sx={{
                                          background: snapshot.isDraggingOver ? "#FFF9C4" : "inherit",
                                          border: snapshot.isDraggingOver ? "2px dashed #FFD600" : "none",
                                          transition: "all 0.18s",
                                        }}
                                      >
                                        {(group.stops ?? []).map((s, i) => (
                                          <StopRow key={`${s.stop_id}-${i}`} stop={s} index={i} />
                                        ))}
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
        )}

        <Dialog
          open={dialogs.confirm}
          onClose={() => setDialogs((d) => ({ ...d, confirm: false }))}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{stopGroupUi.dialogs.confirmTitle}</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>{stopGroupUi.dialogs.confirmBody}</Typography>
            {pending.moves.length > 0 && (
              <Table size="small" sx={{ tableLayout: "fixed", width: "100%", mb: 2 }}>
                <EqualColGroup cols={3} />
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TwoLineHeader jp={stopGroupUi.table.headers.poleId} en="stop_id" level="sub" />
                    </TableCell>
                    <TableCell>
                      <TwoLineHeader jp={stopGroupUi.table.headers.oldGroup} en="" level="sub" />
                    </TableCell>
                    <TableCell>
                      <TwoLineHeader jp={stopGroupUi.table.headers.newGroup} en="" level="sub" />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pending.moves.map((m) => (
                    <TableRow key={m.stop_id}>
                      <EllipsizedCell title={m.stop_id}>{m.stop_id}</EllipsizedCell>
                      <EllipsizedCell title={m.old_group_label}>{m.old_group_label}</EllipsizedCell>
                      <EllipsizedCell title={m.new_group_label}>{m.new_group_label}</EllipsizedCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {hasGroupTypeChange && (
              <Box sx={{ fontSize: 13, color: "text.secondary" }}>
                <b>{stopGroupUi.groupOptions.label}</b>
                <div style={{ marginTop: 6 }}>
                  {groupTypeCommitted === groupingMethodMap.GROUPING_BY_NAME
                    ? stopGroupUi.groupOptions.byName
                    : stopGroupUi.groupOptions.byId}
                  {" -> "}
                  {groupTypeDraft === groupingMethodMap.GROUPING_BY_NAME
                    ? stopGroupUi.groupOptions.byName
                    : stopGroupUi.groupOptions.byId}
                </div>
              </Box>
            )}

            {!hasGroupTypeChange && pending.moves.length === 0 && (
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                {stopGroupUi.dialogs.noChanges}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogs((d) => ({ ...d, confirm: false }))}>
              {GTFS.common.actions.cancel}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                onSave?.(pending.moves, groupTypeDraft);

                if (hasGroupTypeChange) {
                  onGroupTypeChange?.(groupTypeDraft);
                  setGroupTypeCommitted(groupTypeDraft);
                  originalCommittedRef.current = JSON.parse(JSON.stringify(groups));
                } else {
                  originalCommittedRef.current = JSON.parse(JSON.stringify(groups));
                }

                setDirty(false);
                setDialogs((d) => ({ ...d, confirm: false }));
              }}
              disabled={!dirty}
            >
              {GTFS.common.actions.update}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={dialogs.map}
          onClose={() => setDialogs((d) => ({ ...d, map: false }))}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{stopGroupUi.dialogs.mapTitle}</DialogTitle>
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
            <Button onClick={() => setDialogs((d) => ({ ...d, map: false }))}>
              {GTFS.common.actions.close}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={dialogs.leave}
          onClose={() => {
            setDialogs((d) => ({ ...d, leave: false }));
            setPending((p) => ({ ...p, nextAction: null }));
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{stopGroupUi.dialogs.leaveTitle}</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 15 }}>{stopGroupUi.dialogs.leaveBody}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDialogs((d) => ({ ...d, leave: false }));
                setPending((p) => ({ ...p, nextAction: null }));
              }}
            >
              {GTFS.common.actions.cancel}
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                const action = pending.nextAction;
                setDirty(false);
                setDialogs((d) => ({ ...d, leave: false }));
                setPending((p) => ({ ...p, nextAction: null }));
                action?.();
              }}
            >
              {stopGroupUi.dialogs.discardAndLeave}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}

export default memo(StopGroupTab);
