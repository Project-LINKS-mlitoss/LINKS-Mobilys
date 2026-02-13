// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
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
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { UI } from "../../../constant/ui";
import { USER } from "../../../strings/domains/user";

const normalizeId = (v) => (v === null || v === undefined ? "" : String(v));

export default function OrganizationTab({
  orgs = [],
  users = [],
  onRefresh,
  loading,
  createOrganization,
  updateOrganization,
  removeOrganization,
  toggleOrganizationActive,
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());

  const [form, setForm] = useState({
    organization_name: "",
    description: "",
    section: "",
    active: true,
    organizer_id: "",
  });

  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const ui = USER.userManagement.organizationTab;
  const common = USER.userManagement.common;

  // --- Helpers ---
  const formatDateTime = (s) => {
    if (!s) return UI.userManagement.fallbackDash;
    try {
      const d = new Date(s);
      return d.toLocaleString();
    } catch {
      return s;
    }
  };

  // --- Dialog Handlers ---
  const openCreate = () => {
    setTarget(null);
    setForm({
      organization_name: "",
      description: "",
      section: "",
      active: true,
      organizer_id: "",
    });
    setOpenDialog(true);
  };

  const openEdit = (org) => {

    const guessOrganizerId = () => {
      // 1) Find an organizer in organization_users (by role)
      const orgUser = org.organization_users?.find(
        (ou) =>
          ou.role_level === "organizer" ||
          (ou.role_name && String(ou.role_name).toLowerCase() === "organizer")
      );
      if (orgUser?.id != null) {
        const match =
          users.find((u) => String(u.id) === String(orgUser.id)) ||
          users.find((u) => u.username === orgUser.username) ||
          users.find((u) => u.email === orgUser.email);
        if (match) return normalizeId(match.id);
      }

      // 2) From organizer_name string
      if (org.organizer_name) {
        const byUsername = users.find((u) => u.username === org.organizer_name);
        if (byUsername) return normalizeId(byUsername.id);

        const byFullName = users.find(
          (u) =>
            `${u.first_name || ""}${u.last_name || ""}`.trim() ===
            String(org.organizer_name).trim()
        );
        if (byFullName) return normalizeId(byFullName.id);
      }

      // 3) Fallback: no organizer
      return "";
    };

    setTarget(org);
    setForm({
      organization_name: org.organization_name ?? "",
      description: org.description ?? "",
      section: org.section ?? "",
      active: !!org.active,
      organizer_id: guessOrganizerId(),
    });
    setOpenDialog(true);
  };

  const toPayload = () => ({
    organization_name: form.organization_name?.trim(),
    description: form.description?.trim() || "",
    section: form.section?.trim() || "",
    active: !!form.active,
    organizer_id: form.organizer_id ? normalizeId(form.organizer_id) : null,
  });

  const saveOrganization = async () => {
    const payload = toPayload();
    if (!payload.organization_name) {
      showSnackbar({ title: ui.validation.nameRequired, severity: "warning" });
      return;
    }

    setSaving(true);
    try {
      if (target?.id) {
        await updateOrganization(target.id, payload);
        showSnackbar({ title: ui.snackbar.updated, severity: "success" });
      } else {
        await createOrganization(payload);
        showSnackbar({ title: ui.snackbar.created, severity: "success" });
      }
      setOpenDialog(false);
      if (onRefresh) await onRefresh();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.saveFailed, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (org) => {
    setTarget(org);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!target?.id) return;
    setDeleting(true);
    try {
      await removeOrganization(target.id);
      showSnackbar({ title: ui.snackbar.deleted, severity: "success" });
      setDeleteOpen(false);
      setTarget(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.deleteFailed, severity: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button variant="outlined"  onClick={openCreate}>
          {ui.actions.create}
        </Button>
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.name}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.section}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.organizer}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.createdAt}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                {ui.table.headers.active}
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">

              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orgs.map((o) => {
              const organizerLabel = o.organizer_name || UI.userManagement.fallbackDash;
              return (
                <TableRow hover key={o.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">{o.organization_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{o.section || UI.userManagement.fallbackDash}</TableCell>
                  <TableCell>{organizerLabel}</TableCell>
                  <TableCell>{formatDateTime(o.created_datetime)}</TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={!!o.active}
                      disabled={togglingIds.has(o.id)}
                      onChange={async () => {
                        setTogglingIds((prev) => {
                          const next = new Set(prev);
                          next.add(o.id);
                          return next;
                        });

                        try {
                          await toggleOrganizationActive(o.id); 
                          showSnackbar({ title: ui.snackbar.toggled, severity: "success" });
                          if (onRefresh) await onRefresh();
                        } catch (err) {
                          showSnackbar({
                            title: err?.message || ui.snackbar.updateFailed,
                            severity: "error",
                          });
                        } finally {
                          setTogglingIds((prev) => {
                            const next = new Set(prev);
                            next.delete(o.id);
                            return next;
                          });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => openEdit(o)}>
                        {common.actions.edit}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleDelete(o)}
                      >
                      <span className="material-symbols-outlined outlined">
                          delete
                      </span>
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{target ? ui.dialog.title.edit : ui.dialog.title.create}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={ui.dialog.fields.name}
              required
              value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
            />
            <TextField
              label={ui.dialog.fields.section}
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              placeholder={ui.dialog.placeholders.sectionExample}
            />

            {/* Organizer dropdown */}
            <FormControl fullWidth>
              <InputLabel id="organizer-select-label" shrink>
                {ui.dialog.fields.organizer}
              </InputLabel>
              <Select
                labelId="organizer-select-label"
                label={ui.dialog.fields.organizer}
                value={normalizeId(form.organizer_id)}
                onChange={(e) =>
                  setForm({ ...form, organizer_id: normalizeId(e.target.value) })
                }
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) {
                    return (
                      <span style={{ color: "rgba(0,0,0,0.6)" }}>
                        {common.placeholders.none}
                      </span>
                    );
                  }
                  const u = users.find((x) => String(x.id) === String(selected));
                  return u?.username ?? u?.email ?? String(selected);
                }}
              >
                <MenuItem value="">
                  <em>{common.placeholders.none}</em>
                </MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={String(u.id)}>
                    {u.username ?? u.email ?? u.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">{ui.dialog.fields.active}</Typography>
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>{common.actions.cancel}</Button>
          <Button variant="contained" onClick={saveOrganization} disabled={saving}>
            {saving ? common.actions.saving : common.actions.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{ui.deleteDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>
            {ui.deleteDialog.messageTemplate.replace("{organizationName}", target?.organization_name ?? "")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{common.actions.cancel}</Button>
          <Button variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? common.actions.deleting : common.actions.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
