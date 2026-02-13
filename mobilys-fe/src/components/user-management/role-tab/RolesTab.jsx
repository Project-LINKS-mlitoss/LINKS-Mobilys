// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  Stack,
  TextField,
  CircularProgress,
  MenuItem,
  Chip,
} from "@mui/material";
import { Autocomplete } from "@mui/material";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { UI } from "../../../constant/ui";
import { USER } from "../../../strings/domains/user";

export default function RolesTab({
  roles = [],
  onRefresh,
  loading = false,
  createRole,
  updateRole,
  removeRole,
  fetchAccessListApi,
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [form, setForm] = useState({
    role_name: "",
    level: "",
    description: "",
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Access picker state
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessOptions, setAccessOptions] = useState([]); 
  const [selectedAccessIds, setSelectedAccessIds] = useState([]); 

  // Access detail modal (from action buttons)
  const [accessDetail, setAccessDetail] = useState({ open: false, role: null, items: [] });

  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const ui = USER.userManagement.rolesTab;
  const common = USER.userManagement.common;

  const LEVEL_OPTIONS = [
    { value: "super_user", label: "Super User" },
    { value: "organizer", label: "Organizer" },
    { value: "user", label: "User" },
  ];

  const formatDateTime = (s) => {
    if (!s) return UI.userManagement.fallbackDash;
    try {
      const d = new Date(s);
      return d.toLocaleString();
    } catch {
      return s;
    }
  };

  const accessById = useMemo(() => {
    const m = new Map();
    accessOptions.forEach((a) => m.set(a.id, a));
    return m;
  }, [accessOptions]);

  const selectedAccessObjects = useMemo(() => {
    const list = [];
    selectedAccessIds.forEach((id) => {
      const found = accessById.get(id);
      if (found) list.push(found);
      else list.push({ id, access_name: id, access_code: "" });
    });
    return list;
  }, [selectedAccessIds, accessById]);

  const openCreate = () => {
    setTarget(null);
    setForm({ role_name: "", level: "", description: "", active: true });
    setSelectedAccessIds([]);
    setOpenDialog(true);
  };

  const openEdit = (r) => {
    setTarget(r);
    setForm({
      role_name: r.role_name ?? "",
      level: r.level ?? "",
      description: r.description ?? "",
      active: !!r.active,
    });

    const preset =
      r.access_ids ??
      (Array.isArray(r.accesses) ? r.accesses.map((a) => a.id) : []) ??
      [];
    setSelectedAccessIds(preset);

    setOpenDialog(true);
  };

  // Load access list when the dialog or the detail modal opens
  useEffect(() => {
    if (!openDialog && !accessDetail.open) return;
    let ignore = false;
    (async () => {
      try {
        setAccessLoading(true);
        const list = await fetchAccessListApi(); 
        if (!ignore) setAccessOptions(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!ignore) {
          setAccessOptions([]);
          showSnackbar({ title: ui.snackbar.accessListFailed, severity: "error" });
        }
      } finally {
        if (!ignore) setAccessLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [openDialog, accessDetail.open, showSnackbar]);

  const onSave = async () => {
    if (!form.role_name?.trim()) {
      showSnackbar({ title: ui.validation.roleNameRequired, severity: "warning" });
      return;
    }
    if (!form.level) {
      showSnackbar({ title: ui.validation.roleLevelRequired, severity: "warning" });
      return;
    }

    const payload = {
      role_name: form.role_name.trim(),
      level: form.level,
      description: form.description?.trim() || "",
      active: !!form.active,
      access_ids: selectedAccessIds,
    };

    setSaving(true);
    try {
      if (target?.id) {
        await updateRole(target.id, payload);
        showSnackbar({ title: ui.snackbar.updated, severity: "success" });
      } else {
        await createRole(payload);
        showSnackbar({ title: ui.snackbar.created, severity: "success" });
      }
      setOpenDialog(false);
      await onRefresh?.();
    } catch (err) {
      showSnackbar({
        title: err?.message || ui.snackbar.saveFailed,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r) => {
    setTarget(r);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!target?.id) return;
    setDeleting(true);
    try {
      await removeRole(target.id);
      showSnackbar({ title: ui.snackbar.deleted, severity: "success" });
      setDeleteOpen(false);
      setTarget(null);
      await onRefresh?.();
    } catch (err) {
      showSnackbar({
        title: err?.message || ui.snackbar.deleteFailed,
        severity: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openAccessDetail = (role) => {
    const ids =
      role.access_ids ??
      (Array.isArray(role.accesses) ? role.accesses.map((a) => a.id) : []) ??
      [];

    const items = ids.map((id) => {
      const a = accessById.get(id) || role.accesses?.find?.((x) => x.id === id) || null;
      return {
        id,
        access_name: a?.access_name || id,
        access_code: a?.access_code || "",
        created_datetime: a?.created_datetime || "",
        roles_count: a?.roles_count ?? null,
      };
    });

    setAccessDetail({ open: true, role, items });
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={openCreate}>
          {ui.actions.create}
        </Button>
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.roleName}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.roleLevel}</TableCell>
              <TableCell sx={{ width: UI.userManagement.rolesTab.createdAtColWidthPx }}>{ui.table.headers.createdAt}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((r) => (
              <TableRow hover key={r.id}>
                <TableCell>{r.role_name}</TableCell>
                <TableCell>
                  {LEVEL_OPTIONS.find((opt) => opt.value === r.level)?.label || r.level}
                </TableCell>
                <TableCell>{formatDateTime(r.created_datetime)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openAccessDetail(r)}
                    >
                      {ui.actions.viewAccess}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => openEdit(r)}>
                      {common.actions.edit}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleDelete(r)}>
                      <span className="material-symbols-outlined outlined">
                        delete
                      </span>
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">{ui.table.empty}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{target ? ui.dialog.title.edit : ui.dialog.title.create}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={ui.dialog.fields.roleName}
              value={form.role_name}
              onChange={(e) => setForm({ ...form, role_name: e.target.value })}
              required
            />

            <TextField
              select
              label={ui.dialog.fields.roleLevel}
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              required
            >
              {LEVEL_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            {/* Access: Autocomplete multiple (chips) */}
            <Autocomplete
              multiple
              filterSelectedOptions
              options={accessOptions}
              value={selectedAccessObjects}
              loading={accessLoading}
              onChange={(_, newValues) => {
                setSelectedAccessIds(newValues.map((v) => v.id));
              }}
              getOptionLabel={(o) => o.access_name || o.access_code || ""}
              isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={ui.dialog.fields.access}
                  placeholder={accessLoading ? ui.dialog.accessPicker.placeholderLoading : ui.dialog.accessPicker.placeholder}
                />
              )}
              renderTags={(tagValue, getTagProps) =>
                tagValue.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.access_name || option.access_code || option.id}
                  />
                ))
              }
            />

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">{common.status.active}</Typography>
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>{common.actions.cancel}</Button>
          <Button variant="contained" onClick={onSave} disabled={saving}>
            {saving ? common.actions.saving : common.actions.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{ui.deleteDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{ui.deleteDialog.messageTemplate.replace("{roleName}", target?.role_name ?? "")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{common.actions.cancel}</Button>
          <Button variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? common.actions.deleting : common.actions.delete}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Access Detail Modal */}
      <Dialog
        open={accessDetail.open}
        onClose={() => setAccessDetail({ open: false, role: null, items: [] })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {ui.accessDetail.title}
          {accessDetail.role ? ` ${UI.userManagement.fallbackDash} ${accessDetail.role.role_name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{ui.accessDetail.table.headers.name}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{ui.accessDetail.table.headers.code}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accessDetail.items.length > 0 ? (
                accessDetail.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.access_name}</TableCell>
                    <TableCell>
                      {a.access_code}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">{ui.accessDetail.table.empty}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessDetail({ open: false, role: null, items: [] })}>
            {common.actions.close}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
