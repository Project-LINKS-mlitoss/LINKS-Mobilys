// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useState, useEffect } from "react";
import FileUploader from "../FileUploader";
import { FILE_STATUS } from "../../constant/file.js";
import {
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Button,
} from "@mui/material";
import { postGTFSDataImportLocal } from "../../services/importService";
import { getUserScenarios } from "../../services/scenarioService.js";
import { useSnackbarStore } from "../../state/snackbarStore";
import InputModal from "../InputModal";
import { GTFS } from "../../strings/domains/gtfs";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0,
    n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function GTFSImportLocal() {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const ui = GTFS.import.local;

  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(FILE_STATUS.IDLE);

  const [scenarioOpen, setScenarioOpen] = useState(false);

  // Modal error internal (row-level)
  const [_errorModalOpen, setErrorModalOpen] = useState(false);
  const [_errorModalRows, setErrorModalRows] = useState([]);
  const [_errorModalMessage, setErrorModalMessage] = useState("");
  const [_errorModalTimestamp, setErrorModalTimestamp] = useState(null); // Add timestamp state

  // Validate scenario names
  const [scenarioNamesLoading, setScenarioNamesLoading] = useState(false);
  const [existingNames, setExistingNames] = useState(() => new Set());

  const handleSelectFiles = (selected, error) => {
    if (error) return;
    const arr = Array.isArray(selected) ? selected : [selected];
    setFiles(arr);
  };

  const handleRemoveAt = (idx) => {
    const next = files.slice();
    next.splice(idx, 1);
    setFiles(next);
  };

  const handleImportClick = () => {
    if (!files.length) return;
    setScenarioOpen(true);
  };

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

  // Helpers normalize/pick errors
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
    if (!v) return ui.validation.required;

    if (existingNames.has(v.toLowerCase()))
      return ui.validation.duplicateScenarioName;
    return null;
  };

  const handleConfirmScenario = async (scenarioName) => {
    setScenarioOpen(false);
    if (!files.length) return;

    try {
      // Step 1: Start import immediately without initial validation (fire and forget)
      postGTFSDataImportLocal(files[0], { scenarioName }).catch((error) => {
        // Only handle immediate errors (validation, network, etc)
        const resp = error?.response?.data || {};
        const msg = resp?.message || ui.errors.importFailed;
        const errs = normalizeErrors(resp?.error);
        const internalRows = pickInternalRowErrors(errs);

        if (internalRows.length > 0) {
          setErrorModalRows(internalRows);
          setErrorModalMessage(msg);
          setErrorModalTimestamp(new Date().toISOString()); // Set current timestamp
          setErrorModalOpen(true);
        } else {
          const isInternal = errs[0]?.source === "internal";
          showSnackbar({
            title: isInternal
              ? ui.errors.internalError
              : ui.errors.externalError,
            detail: errs[0]?.message || msg,
            severity: "error",
          });
        }
      });

      // Immediately clear form and show feedback
      setFiles([]);
      setStatus(FILE_STATUS.IDLE);
      
       showSnackbar({
        title: ui.snackbar.startedTitle,
        detail: ui.snackbar.startedDetailTemplate.replace("{scenarioName}", scenarioName),
        severity: "info",
      });

      // Backend will send notification when complete/failed
    } catch (error) {
      // Validation failed - show error modal
      const resp = error?.response?.data || {};
      const msg = resp?.message || ui.errors.validationFailed;
      const errs = normalizeErrors(resp?.error);
      const internalRows = pickInternalRowErrors(errs);

      if (internalRows.length > 0) {
        setErrorModalRows(internalRows);
        setErrorModalMessage(msg);
        setErrorModalTimestamp(new Date().toISOString()); // Set current timestamp
        setErrorModalOpen(true);
      } else {
        const isInternal = errs[0]?.source === "internal";
        showSnackbar({
          title: isInternal
            ? ui.errors.internalError
            : ui.errors.externalError,
          detail: errs[0]?.message || msg,
          severity: "error",
        });
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: "55vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}>
      <Box sx={{ width: "100%", maxWidth: 720 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          {ui.title}
        </Typography>

        {files.length === 0 ? (
            <FileUploader
              status={status}
              filename={undefined}
              onFileUpload={handleSelectFiles}
              disabled={false}
              multiple={false}
              fileExtensionAllowed={[".zip"]}
              emptyText={ui.uploader.emptyText}
              acceptLabel={ui.uploader.acceptLabel}
            />
        ) : (
          <>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 2, height: 240, p: 1, overflow: "auto" }}>
              <List dense disablePadding>
                {files.map((f, idx) => (
                  <Box key={`${f.name}-${f.size}`}>
                    <ListItem>
                      <ListItemText primary={f.name} />
                      <ListItemText primary={formatBytes(f.size)} />
                      <IconButton
                        edge="end"
                        aria-label="remove"
                        onClick={() => handleRemoveAt(idx)}>
                        <Typography sx={{ fontSize: 18, lineHeight: 1 }}>
                          {ui.removeIcon}
                        </Typography>
                      </IconButton>
                    </ListItem>
                    {idx < files.length - 1 && <Divider component="li" />}
                  </Box>
                ))}
              </List>
            </Paper>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleImportClick}
                disabled={status === FILE_STATUS.UPLOADING}
                sx={{ textTransform: "none", minWidth: 120 }}>
                {ui.actions.import}
              </Button>
            </Box>
          </>
        )}
      </Box>

      <InputModal
        open={scenarioOpen}
        title={ui.scenarioInput.title}
        label={ui.scenarioInput.label}
        onClose={() => setScenarioOpen(false)}
        onConfirm={handleConfirmScenario}
        confirmLabel={ui.scenarioInput.confirmLabel}
        cancelLabel={ui.scenarioInput.cancelLabel}
        validate={validateScenarioName}
        confirmDisabled={scenarioNamesLoading}
      />
    </Box>
  );
}
