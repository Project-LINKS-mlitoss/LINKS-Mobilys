import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { directionMap } from "../../../constant/gtfs";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const makeAffectedPatternKey = (p) => {
  const routeId = String(p?.route_id ?? "");
  const patternId = String(p?.pattern_id ?? "");
  if (routeId && patternId) return `${routeId}::${patternId}`;

  const hash = String(p?.pattern_hash ?? "");
  if (hash) return hash;
  return `${routeId}::${patternId}::${p?.direction_id ?? ""}::${p?.service_id ?? ""}`;
};

function TwoLineHeader({ jp, en }) {
  const hasEn = !!en && String(en).trim().length > 0;
  return (
    <Box>
      <Typography fontWeight="bold" fontSize={14} noWrap color="text.primary">
        {jp}
      </Typography>
      <Typography
        fontWeight="bold"
        fontSize={12}
        color="text.secondary"
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

const ApplyShapeToPatternsDialog = ({
  open,
  onClose,
  onConfirm,
  loading = false,
  shapeId,
  affectedPatterns = [],
  existingShapeIds = [],
}) => {
  const theme = useTheme();
  const [selected, setSelected] = useState({});
  const [newShapeId, setNewShapeId] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialSelected = {};
    (affectedPatterns || []).forEach((p) => {
      const key = makeAffectedPatternKey(p);
      if (key) initialSelected[key] = true;
    });
    setSelected(initialSelected);
    setNewShapeId("");
    setAttempted(false);
  }, [open, affectedPatterns]);

  const selectedList = useMemo(() => {
    return (affectedPatterns || []).filter((p) => !!selected[makeAffectedPatternKey(p)]);
  }, [affectedPatterns, selected]);

  const totalPatterns = (affectedPatterns || []).length;
  const allSelected = totalPatterns > 0 && selectedList.length === totalPatterns;
  const hasUnselected = totalPatterns > 0 && selectedList.length > 0 && selectedList.length < totalPatterns;
  const isEmptySelection = selectedList.length === 0;

  const inputNewId = String(newShapeId || "").trim();

  const isErrorEmpty = inputNewId.length === 0;

  const isErrorDuplicate = useMemo(() => {
    if (inputNewId.length === 0) return false;
    return existingShapeIds.includes(inputNewId);
  }, [inputNewId, existingShapeIds]);

  const isInvalidPartialInput = hasUnselected && (isErrorEmpty || isErrorDuplicate);


  const toggleSelectAll = () => {
    if (!affectedPatterns || affectedPatterns.length === 0) return;
    const nextVal = !allSelected;
    const next = {};
    affectedPatterns.forEach((p) => {
      next[makeAffectedPatternKey(p)] = nextVal;
    });
    setSelected(next);
  };

  const toggleSelectOne = (p) => {
    const key = makeAffectedPatternKey(p);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = async () => {
    if (isEmptySelection) return;
    setAttempted(true);

    if (isInvalidPartialInput) return;

    const mode = allSelected ? "override" : "partial";
    await Promise.resolve(onConfirm?.({ mode, selectedPatterns: selectedList, newShapeId: inputNewId })).catch(
      () => null
    );
  };

  // Helper UI Box
  const getAlertContent = () => {
    if (hasUnselected) {
      return {
        severity: "warning",
        icon: <WarningAmberRoundedIcon fontSize="small" />,
        title: MESSAGES.route.updateOnlySelectedTitle,
        description: MESSAGES.route.updateOnlySelectedDesc,
        colorStyles: {
          borderColor: alpha(theme.palette.warning.main, 0.5),
          bgcolor: alpha(theme.palette.warning.main, 0.08),
          color: theme.palette.warning.main,
        }
      };
    } else {
      return {
        severity: "info",
        icon: <InfoOutlinedIcon fontSize="small" />,
        title: MESSAGES.route.updateAllTitle,
        description: MESSAGES.route.updateAllDesc(shapeId),
        colorStyles: {
          borderColor: alpha(theme.palette.info.main, 0.35),
          bgcolor: alpha(theme.palette.info.main, 0.06),
          color: theme.palette.info.dark,
        }
      };
    }
  };

  const alertConfig = getAlertContent();

  const getHelperText = () => {
    if (!hasUnselected) return " ";

    if (isErrorDuplicate && inputNewId.length > 0) {
      return MESSAGES.validation.sameShapeIdError;
    }

    if (attempted && isErrorEmpty) {
      return MESSAGES.validation.inputShapeId;
    }

    return " ";
  };

  return (
    <Dialog
      open={open}
      onClose={() => !loading && onClose?.()}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        },
      }}
      BackdropProps={{
        sx: { backgroundColor: "rgba(15, 23, 42, 0.35)", backdropFilter: "blur(2px)" },
      }}
    >
      <DialogTitle sx={{ px: 3, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
              {LABELS.route.editShape}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={`${LABELS.common.shapeId}: ${shapeId || "-"}`}
                sx={{
                  fontWeight: 700,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.dark,
                }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={LABELS.common.selectedCount(selectedList.length, totalPatterns)}
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>
          <IconButton onClick={() => !loading && onClose?.()} size="small" sx={{ mt: -0.25 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2.25} sx={{ px: 3, py: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
              {LABELS.route.applyToPattern}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {LABELS.route.applyToPatternHint}
            </Typography>
          </Box>

          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "none",
              boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
              maxHeight: 400,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow
                  sx={{
                    "& th": {
                      bgcolor: alpha(theme.palette.grey[50], 0.98),
                      borderBottom: "none",
                    },
                  }}
                >
                  <TableCell sx={{ width: 48 }} align="center">
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={!allSelected && selectedList.length > 0}
                      onChange={toggleSelectAll}
                      disabled={totalPatterns === 0}
                    />
                  </TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.route.internalPatternId} en="" /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.common.shapeId} en={LABELS.gtfs.shapeId} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.common.section} en="" /></TableCell>
                  <TableCell align="right"><TwoLineHeader jp={LABELS.trip.totalTrips} en="" /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {totalPatterns === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        {MESSAGES.route.noPatterns}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  affectedPatterns.map((p) => {
                    const key = makeAffectedPatternKey(p);
                    const isSelected = !!selected[key];
                    const showAsNewShape = hasUnselected && isSelected;
                    const displayShapeId = showAsNewShape && inputNewId ? inputNewId : (p.shape_id ?? "-");

                    return (
                      <TableRow
                        key={key}
                        hover
                        sx={{
                          cursor: 'pointer',
                          ...(isSelected
                            ? {
                              backgroundColor: alpha(theme.palette.primary.main, 0.05),
                              "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.07) },
                            }
                            : {
                              "&:hover": { backgroundColor: alpha(theme.palette.action.hover, 0.6) },
                            }),
                        }}
                        onClick={() => toggleSelectOne(p)}
                      >
                        <TableCell align="center" padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.pattern_id ?? "-"}</Typography>
                          <Typography variant="caption" color="text.secondary">{p.trip_headsign ?? ""}</Typography>
                        </TableCell>
                        <TableCell>{directionMap?.[p.direction_id] ?? p.direction_id ?? "-"}</TableCell>
                        <TableCell>{p.service_id ?? "-"}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={showAsNewShape ? { color: theme.palette.primary.main, fontWeight: 800 } : undefined}
                          >
                            {displayShapeId}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatSectionLabel(p.segment) ?? "-"}</TableCell>
                        <TableCell align="right">{p.interval ?? "-"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!isEmptySelection && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Alert
                icon={alertConfig.icon}
                severity={alertConfig.severity}
                variant="outlined"
                sx={{ borderRadius: 2, alignItems: "center", ...alertConfig.colorStyles }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {alertConfig.title}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: "pre-line" }}>
                  {alertConfig.description}
                </Typography>
              </Alert>

              {hasUnselected && (
                <TextField
                  label={`${LABELS.common.newShapeId} ${LABELS.gtfs.shapeId}`}
                  size="small"
                  fullWidth
                  value={newShapeId}
                  onChange={(e) => setNewShapeId(e.target.value)}
                  error={(isErrorDuplicate && inputNewId.length > 0) || (attempted && isErrorEmpty)}
                  helperText={getHelperText()}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1.5 }}>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || isEmptySelection || isInvalidPartialInput}
        >
          {BUTTONS.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApplyShapeToPatternsDialog;