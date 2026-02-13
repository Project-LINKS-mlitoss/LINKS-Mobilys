// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
} from "@mui/material";
import { VALIDATION } from "../../constant/validation";
import { GTFS } from "../../strings/domains/gtfs";

/**
 * EditRouteGroupNameModal
 *
 * Presentational modal to rename a route group.
 * - Controlled by parent via `open` and `onClose`.
 * - Calls `onSave(newName)`; no API call inside 
 *
 * Props:
 *   open: boolean
 *   initialName: string            // current group name
 *   onClose: (didSave?: boolean) => void
 *   onSave:  (newName: string) => Promise<void> | void
 */
export default function EditRouteGroupNameModal({
  open,
  initialName = "",
  onClose,
  onSave,
}) {
  const ui = GTFS.routeGroup.editNameModal;
  const common = GTFS.common;
  const maxNameLen = VALIDATION.gtfs.routeGroup.nameMaxLen;
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue(initialName || "");
      setError("");
      setSaving(false);
    }
  }, [open, initialName]);

  const validate = useCallback((name) => {
    const v = (name || "").trim();
    if (!v) return ui.validation.required;
    if (v.length > maxNameLen) {
      return ui.validation.tooLongTemplate.replace("{max}", String(maxNameLen));
    }
    return "";
  }, [maxNameLen, ui.validation.required, ui.validation.tooLongTemplate]);

  const handleSubmit = async () => {
    const msg = validate(value);
    if (msg) {
      setError(msg);
      return;
    }
    try {
      setSaving(true);
      await Promise.resolve(onSave?.(value.trim()));
      onClose?.(true);
    } catch (e) {
      const serverMsg = e?.response?.data?.detail || ui.errors.saveFailed;
      setError(serverMsg);
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose?.(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose?.(false)}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{ui.title}</DialogTitle>
      <DialogContent onKeyDown={handleKeyDown}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label={ui.fields.groupName}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            variant="standard"
            error={!!error}
            helperText={error || " "}
            size="small"
            inputProps={{ maxLength: maxNameLen }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.(false)} disabled={saving}>
          {common.actions.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
        >
          {common.actions.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
