// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { BUTTONS } from "../strings/index.js";

export default function InputModal({
  open,
  title,
  label,
  onClose,
  onConfirm,
  confirmLabel = BUTTONS.common.ok,
  cancelLabel = BUTTONS.common.cancel,
  validate,
  confirmDisabled = false,
  initialValue = "",
}) {
  const [value, setValue] = useState(initialValue);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setValue(initialValue || "");
      setErr("");
    }
  }, [open, initialValue]);

  const onChange = (e) => {
    const v = e.target.value;
    setValue(v);
    if (typeof validate === "function") {
      const msg = validate(v);
      setErr(msg || "");
    }
  };

  const handleConfirm = () => {
    const msg = typeof validate === "function" ? validate(value) : "";
    if (msg) {
      setErr(msg);
      return;
    }
    onConfirm?.(value.trim());
  };

  const disabled = confirmDisabled || !!err || !value.trim();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          autoFocus
          label={label}
          value={value}
          onChange={onChange}
          error={!!err}
          helperText={err || " "}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={disabled}
          sx={{ textTransform: "none" }}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
