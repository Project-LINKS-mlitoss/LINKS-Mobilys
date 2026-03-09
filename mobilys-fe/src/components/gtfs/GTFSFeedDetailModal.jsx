// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/gtfs/GTFSFeedDetailModal.jsx
import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Box,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Backdrop,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { getGTFSFeedDetail } from "../../services/gtfsService";
import InputModal from "../InputModal";
import { postGTFSDataImport, postGTFSDataImportValidationApiService } from "../../services/importService";
import { useSnackbarStore } from "../../state/snackbarStore";
import EmptyState from "../EmptyState";
import emptyDataImage from "../../assets/photos/empty-data.png";
import { getUserScenarios } from "../../services/scenarioService";
import { GTFS } from "../../strings/domains/gtfs";
import { UI } from "../../constant/ui";

export default function GTFSFeedDetailModal({
  open,
  onClose,
  organizationId,
  feedId,
  prefectureMap,
}) {
  const dash = UI.gtfs.fallbackDash;
  const importUi = GTFS.import.local;
  const feedUi = GTFS.feedDetail;

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioTarget, setScenarioTarget] = useState(null);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  // validation loading
  const [validationLoading, setValidationLoading] = useState(false);

  // error detail modal (internal row-level)
  const [_errorModalOpen, setErrorModalOpen] = useState(false);
  const [_errorModalRows, setErrorModalRows] = useState([]);
  const [_errorModalMessage, setErrorModalMessage] = useState("");
  const [_errorModalTimestamp, setErrorModalTimestamp] = useState(null);

  // scenario name validation
  const [scenarioNamesLoading, setScenarioNamesLoading] = useState(false);
  const [existingNames, setExistingNames] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      if (!open || !organizationId || !feedId) return;
      setLoading(true);
      setError(null);
      try {
        const body = await getGTFSFeedDetail(organizationId, feedId, {
          max_prev: 20,
        });
        if (!cancelled) setDetail(body);
      } catch {
        if (!cancelled) setError("failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, feedId]);

  const files = detail?.gtfs_files ?? [];
  const prefName = useMemo(() => {
    const id = String(detail?.feed_pref_id ?? "");
    return prefectureMap?.[id] || dash;
  }, [detail, prefectureMap]);

  const onClickImport = (fileRow) => {
    setScenarioTarget(fileRow);
    setScenarioOpen(true);
  };

  // fetch user scenarios when the scenario input modal opens (for duplicate check)
  useEffect(() => {
    let cancelled = false;
    const loadNames = async () => {
      if (!scenarioOpen) return;
      setScenarioNamesLoading(true);
      try {
        const list = await getUserScenarios(false); // [{ scenario_name, ... }]
        if (!cancelled) {
          const setLower = new Set(
            (list || [])
              .map((x) => (x?.scenario_name || "").trim().toLowerCase())
              .filter(Boolean)
          );
          setExistingNames(setLower);
        }
      } catch {
        if (!cancelled) setExistingNames(new Set());
      } finally {
        if (!cancelled) setScenarioNamesLoading(false);
      }
    };
    loadNames();
    return () => {
      cancelled = true;
    };
  }, [scenarioOpen]);

  // helpers to normalize backend error payload
  const normalizeErrors = (errPayload) => {
    if (!errPayload) return [];
    if (Array.isArray(errPayload)) return errPayload;
    if (typeof errPayload === "string") return [{ message: errPayload }];
    if (typeof errPayload === "object") return [errPayload];
    return [];
  };

  const pickInternalRowErrors = (errors) =>
    errors.filter(
      (e) =>
        e?.source === "internal" &&
        (e?.row !== undefined || e?.file !== undefined)
    );

  const validateScenarioName = (name) => {
    const v = (name || "").trim();
    if (!v) return importUi.validation.required;
    if (existingNames.has(v.toLowerCase()))
      return importUi.validation.duplicateScenarioName;
    return null;
  };

  const onConfirmImport = async (scenarioName) => {
    if (!scenarioTarget) return;
    setScenarioOpen(false);

    try {
      // Step 1: Validate first (WAIT for validation to complete)
      setValidationLoading(true);
      await postGTFSDataImportValidationApiService({
        organization_id: organizationId,
        feed_id: feedId,
        start_date: scenarioTarget.from_date || undefined,
        end_date: scenarioTarget.to_date || undefined,
        scenario_name: scenarioName,
        gtfs_file_uid: scenarioTarget.gtfs_file_uid || undefined,
      });
      setValidationLoading(false);

      // Step 2: If validation passes, start actual import (fire and forget)
      postGTFSDataImport({
        organization_id: organizationId,
        feed_id: feedId,
        start_date: scenarioTarget.from_date || undefined,
        end_date: scenarioTarget.to_date || undefined,
        scenario_name: scenarioName,
        gtfs_file_uid: scenarioTarget.gtfs_file_uid || undefined,
      }).catch((e) => {
        // Only handle immediate errors (validation, network, etc)
        const resp = e?.response?.data || {};
        const message = resp?.message || importUi.errors.importFailed;
        const errors = normalizeErrors(resp?.error);
        const internalRows = pickInternalRowErrors(errors);

        if (internalRows.length > 0) {
          setErrorModalRows(internalRows);
          setErrorModalMessage(message);
          setErrorModalTimestamp(new Date().toISOString());
          setErrorModalOpen(true);
        } else {
          const isInternal = errors[0]?.source === "internal";
          showSnackbar({
            title: isInternal
              ? importUi.errors.internalError
              : importUi.errors.externalError,
            detail: errors[0]?.message || message,
            severity: "error",
          });
        }
      });

      // Immediately show feedback
      showSnackbar({
        title: importUi.snackbar.startedTitle,
        detail: importUi.snackbar.startedDetailTemplate.replace("{scenarioName}", scenarioName),
        severity: "info",
      });

      // Backend will send notification when complete/failed
    } catch (error) {
      // Validation failed - show error modal
      setValidationLoading(false);
      const resp = error?.response?.data || {};
      const message = resp?.message || importUi.errors.validationFailed;
      const errors = normalizeErrors(resp?.error);
      const internalRows = pickInternalRowErrors(errors);

      if (internalRows.length > 0) {
        setErrorModalRows(internalRows);
        setErrorModalMessage(message);
        setErrorModalTimestamp(new Date().toISOString());
        setErrorModalOpen(true);
      } else {
        const isInternal = errors[0]?.source === "internal";
        showSnackbar({
          title: isInternal
            ? importUi.errors.internalError
            : importUi.errors.externalError,
          detail: errors[0]?.message || message,
          severity: "error",
        });
      }
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {prefName !== dash ? `${prefName}: ` : ""}
          {detail?.feed_name || feedUi.titleFallback}
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {/* Loading */}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* ERROR / NO DATA -> Empty state */}
          {!loading && (error || !detail) && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
              <EmptyState image={emptyDataImage} message={feedUi.empty.noData} />
            </Box>
          )}

          {/* OK */}
          {!loading && !error && detail && (
            <Box sx={{ display: "grid", gap: 2 }}>
              {files.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {feedUi.empty.noFiles}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{feedUi.table.headers.generation}</TableCell>
                      <TableCell>{feedUi.table.headers.publishedAt}</TableCell>
                      <TableCell>{feedUi.table.headers.startDate}</TableCell>
                      <TableCell>{feedUi.table.headers.endDate}</TableCell>
                      <TableCell>{feedUi.table.headers.updateInfo}</TableCell>
                      <TableCell>{feedUi.table.headers.updateMemo}</TableCell>
                      <TableCell>{feedUi.table.headers.import}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {files.map((f, i) => {
                      const published = f.published_at || f.created_at;
                      return (
                        <TableRow
                          key={f.gtfs_file_uid || i}
                          hover
                          sx={{
                            "&:nth-of-type(odd)": {
                              backgroundColor: "action.hover",
                            },
                          }}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {i === 0 ? feedUi.table.labels.current : ""}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {published
                              ? new Date(published).toLocaleString()
                              : dash}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {f.from_date || dash}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {f.to_date || dash}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "normal" }}>
                            <UpdateInfoList info={f.update_info} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "normal", maxWidth: 360 }}>
                            {f.memo || dash}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => onClickImport(f)}
                              sx={{ textTransform: "none", minWidth: 88 }}>
                              {importUi.actions.import}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>{GTFS.common.actions.close}</Button>
        </DialogActions>

        {/* Scenario name input */}
        <InputModal
          open={scenarioOpen}
          title={importUi.scenarioInput.title}
          label={importUi.scenarioInput.label}
          onClose={() => setScenarioOpen(false)}
          onConfirm={onConfirmImport}
          confirmLabel={importUi.scenarioInput.confirmLabel}
          cancelLabel={importUi.scenarioInput.cancelLabel}
          validate={validateScenarioName}
          confirmDisabled={scenarioNamesLoading}
        />
      </Dialog>

      {/* Validation Loading Backdrop */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.modal + 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
        open={validationLoading}>
        <CircularProgress color="inherit" size={60} />
        <Typography variant="h6">{feedUi.backdrop.title}</Typography>
        <Typography variant="body2">
          {feedUi.backdrop.detail}
        </Typography>
      </Backdrop>
    </>
  );
}

function UpdateInfoList({ info }) {
  const dash = UI.gtfs.fallbackDash;
  const ui = GTFS.feedDetail;

  if (!info) return <>{dash}</>;
  const items = [];
  if (info.update_timetable) items.push(ui.updateInfo.timetable);
  if (info.update_stops) items.push(ui.updateInfo.stops);
  if (info.update_available_period) items.push(ui.updateInfo.availablePeriod);
  if (info.update_routes) items.push(ui.updateInfo.routes);
  if (info.update_fare) items.push(ui.updateInfo.fare);
  if (info.temporary_timetable) items.push(ui.updateInfo.temporaryTimetable);
  if (info.others) items.push(ui.updateInfo.others);
  if (items.length === 0) return <>{dash}</>;
  return (
    <Box sx={{ pl: 0, m: 0 }}>
      {items.map((t, i) => (
        <div key={i}>
          <Typography variant="body2" component="span">
            {t}
          </Typography>
          <br />
        </div>
      ))}
    </Box>
  );
}
