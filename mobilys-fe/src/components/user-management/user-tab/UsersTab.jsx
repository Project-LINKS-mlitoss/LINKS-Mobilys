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
  Tooltip,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { UI, VALIDATION } from "../../../constant";
import { USER } from "../../../strings";

export default function UsersTab({
  users = [],
  roles = [],
  organizations = [],
  onRefresh,
  createUser,
  updateUser,
  removeUser,
  toggleUserActive,
}) {
  const ui = USER.userManagement.usersTab;
  const common = USER.userManagement.common;
  const minUsernameLen = VALIDATION.userManagement.minUsernameLen;
  const minPasswordLen = VALIDATION.userManagement.minPasswordLen;

  const [openDialog, setOpenDialog] = useState(false);
  const [target, setTarget] = useState(null); 
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());

  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [password2Error, setPassword2Error] = useState("");

  const [form, setForm] = useState({
    username: "",
    password: "", 
    password2: "", 
    role: "",
    organization: "",
    is_active: false,
  });

  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const formatDateTime = (s) => {
    if (!s) return UI.userManagement.fallbackDash;
    try {
      const d = new Date(s);
      return d.toLocaleString();
    } catch {
      return s;
    }
  };

  const openCreate = () => {
    setTarget(null);
    setUsernameError("");
    setPasswordError("");
    setPassword2Error("");
    setShowPassword(false);
    setShowPassword2(false);
    setForm({
      username: "",
      password: "",
      password2: "",
      role: "",
      organization: "",
      is_active: true,
    });
    setTimeout(() => setOpenDialog(true), 0);
  };

  const openEdit = (u) => {
    setTarget(u);
    setForm({
      username: u.username || "",
      password: "",   
      password2: "", 
      role: u.user_detail?.role || "",
      organization: u.user_detail?.organization || "",
      is_active: u.is_active ?? true,
    });
    setUsernameError("");
    setPasswordError("");
    setPassword2Error("");
    setOpenDialog(true);
  };

  const handleUsernameChange = (value) => {
    const exists = users.some(
      (usr) =>
        usr.username.toLowerCase() === value.toLowerCase() &&
        (!target || usr.id !== target.id)
    );

    let err = "";
    if (value.trim().length < minUsernameLen) {
      err = ui.validation.usernameMinTemplate.replace("{min}", String(minUsernameLen));
    } else if (exists) {
      err = ui.validation.duplicateUsername;
    }

    setForm((p) => ({ ...p, username: value }));
    setUsernameError(err);
  };

  const validatePasswordsIfCreate = () => {
    if (target) return true; 
    if (!form.password) {
      setPasswordError(ui.validation.passwordRequired);
      return false;
    }
    if (form.password.length < minPasswordLen) {
      setPasswordError(ui.validation.passwordMinTemplate.replace("{min}", String(minPasswordLen)));
      return false;
    }
    setPasswordError("");

    if (!form.password2) {
      setPassword2Error(ui.validation.passwordConfirmRequired);
      return false;
    }
    if (form.password !== form.password2) {
      setPassword2Error(ui.validation.passwordMismatch);
      return false;
    }
    setPassword2Error("");
    return true;
  };

  const onSave = async () => {
    const duplicate = users.some(
      (usr) =>
        usr.username.toLowerCase() === form.username.toLowerCase() &&
        (!target || usr.id !== target.id)
    );
    if (duplicate) {
      showSnackbar({ title: ui.validation.duplicateUsername, severity: "warning" });
      return;
    }

    if (!form.username?.trim() || !form.role || (!target && !form.password?.trim())) {
      showSnackbar({
        title: ui.validation.requiredFields,
        severity: "warning",
      });
      return;
    }

    if (form.username.trim().length < minUsernameLen) {
      const msg = ui.validation.usernameMinTemplate.replace("{min}", String(minUsernameLen));
      setUsernameError(msg);
      showSnackbar({ title: msg, severity: "warning" });
      return;
    }

    if (!validatePasswordsIfCreate()) {
      showSnackbar({ title: ui.validation.checkInput, severity: "warning" });
      return;
    }

    const payload = {
      username: form.username.trim(),
      ...(target ? {} : { password: form.password.trim() }),
      role_id: form.role,
      organization_id: form.organization || null,
      is_active: !!form.is_active, 
    };

    setSaving(true);
    try {
      if (target) {
        await updateUser(target.id, payload);
        showSnackbar({ title: ui.snackbar.updated, severity: "success" });
      } else {
        const res = await createUser(payload);
        showSnackbar({ title: ui.snackbar.created, severity: "success" });

        try {
          const newId = res?.data?.id ?? res?.data?.data?.id ?? res?.id;
          if (newId && form.is_active === false) {
            await toggleUserActive(newId);
          }
        } catch {
        }
      }
      setOpenDialog(false);
      onRefresh?.();
    } catch (err) {
      showSnackbar({
        title: err?.message || ui.snackbar.saveFailed,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (u) => {
    setTarget(u);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!target?.id) return;
    setDeleting(true);
    try {
      await removeUser(target.id);
      showSnackbar({ title: ui.snackbar.deleted, severity: "success" });
      setDeleteOpen(false);
      setTarget(null);
      onRefresh?.();
    } catch (err) {
      showSnackbar({
        title: err?.message || ui.snackbar.deleteFailed,
        severity: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!users.length && !roles.length && !organizations.length) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={openCreate}>
          {ui.actions.create}
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.username}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.role}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.organization}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.createdAt}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                {ui.table.headers.active}
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
                <TableRow hover key={u.id}>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.user_detail?.role_name ?? UI.userManagement.fallbackDash}</TableCell>
                  <TableCell>{u.user_detail?.organization_name || UI.userManagement.fallbackDash}</TableCell>
                  <TableCell>{formatDateTime(u.user_detail?.created_date)}</TableCell>
                  <TableCell align="center">
                  <Switch
                    checked={!!u.is_active}
                    disabled={togglingIds.has(u.id)}
                    onChange={async () => {
                      // mark in-flight
                      setTogglingIds((prev) => {
                        const next = new Set(prev);
                        next.add(u.id);
                        return next;
                      });
                      try {
                        await toggleUserActive(u.id);
                        showSnackbar({ title: ui.snackbar.toggled, severity: "success" });
                        onRefresh?.();
                      } catch (err) {
                        showSnackbar({ title: err?.message || ui.snackbar.toggleFailed, severity: "error" });
                      } finally {
                        setTogglingIds((prev) => {
                          const next = new Set(prev);
                          next.delete(u.id);
                          return next;
                        });
                      }
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => openEdit(u)}>
                      {common.actions.edit}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleDelete(u)}>
                      <span className="material-symbols-outlined outlined">
                        delete
                      </span>
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" align="center">
                    {ui.table.empty}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        key={target ? `edit-${target.id}` : `create`}
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ component: "form", autoComplete: "off" }}
      >
        <DialogTitle>{target ? ui.dialog.title.edit : ui.dialog.title.create}</DialogTitle>
        <DialogContent>
          <input
            type="text"
            name="fake-username"
            autoComplete="username"
            style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
            tabIndex={-1}
          />
          <input
            type="password"
            name="fake-password"
            autoComplete="new-password"
            style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
            tabIndex={-1}
          />

            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label={ui.dialog.fields.username}
                value={form.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                autoComplete={target ? "username" : "new-username"}
                name={target ? "edit-username" : "create-username"}
                error={!!usernameError}
                helperText={
                  usernameError || ui.dialog.helperText.usernameMinTemplate.replace("{min}", String(minUsernameLen))
                }
              />

            {/* CREATE MODE: password + confirm */}
            {!target && (
              <>
                <TextField
                  label={ui.dialog.fields.password}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => ({ ...p, password: value }));

                    // live check for length
                    if (value && value.length < minPasswordLen) {
                      setPasswordError(ui.validation.passwordMinTemplate.replace("{min}", String(minPasswordLen)));
                    } else {
                      setPasswordError("");
                    }

                    // live check for match
                    if (form.password2 && value !== form.password2) {
                      setPassword2Error(ui.validation.passwordMismatch);
                    } else {
                      setPassword2Error("");
                    }
                  }}
                  required
                  autoComplete="new-password"
                  name="create-password"
                  error={!!passwordError}
                  helperText={passwordError || ui.dialog.helperText.passwordHint}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showPassword ? ui.dialog.tooltips.hide : ui.dialog.tooltips.show}>
                          <IconButton
                            aria-label={
                              showPassword ? ui.dialog.tooltips.ariaHidePassword : ui.dialog.tooltips.ariaShowPassword
                            }
                            onClick={() => setShowPassword((v) => !v)}
                            onMouseDown={(e) => e.preventDefault()}
                            edge="end"
                          >
                            {showPassword ? <Visibility /> : <VisibilityOff />}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label={ui.dialog.fields.passwordConfirm}
                  type={showPassword2 ? "text" : "password"}
                  value={form.password2}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => ({ ...p, password2: value }));

                    // live check for match
                    if (form.password && value !== form.password) {
                      setPassword2Error(ui.validation.passwordMismatch);
                    } else {
                      setPassword2Error("");
                    }
                  }}
                  required
                  autoComplete="new-password"
                  name="create-password2"
                  error={!!password2Error}
                  helperText={password2Error || ui.dialog.helperText.passwordConfirmHint}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showPassword2 ? ui.dialog.tooltips.hide : ui.dialog.tooltips.show}>
                          <IconButton
                            aria-label={
                              showPassword2 ? ui.dialog.tooltips.ariaHidePassword : ui.dialog.tooltips.ariaShowPassword
                            }
                            onClick={() => setShowPassword2((v) => !v)}
                            onMouseDown={(e) => e.preventDefault()}
                            edge="end"
                          >
                            {showPassword2 ? <Visibility /> : <VisibilityOff />}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </>
            )}
            <FormControl fullWidth required>
              <InputLabel>{ui.dialog.fields.role}</InputLabel>
              <Select
                value={form.role}
                label={ui.dialog.fields.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.role_name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{ui.dialog.fields.organization}</InputLabel>
              <Select
                value={form.organization}
                label={ui.dialog.fields.organization}
                onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
              >
                <MenuItem value="">{common.placeholders.none}</MenuItem>
                {organizations.map((o) => (
                  <MenuItem key={o.id} value={o.id}>{o.organization_name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">{ui.dialog.fields.active}</Typography>
              <Switch
                checked={!!form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                inputProps={{ 'aria-label': 'active-switch' }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>{common.actions.cancel}</Button>
          <Button variant="contained" onClick={onSave} disabled={saving} type="button">
            {saving ? common.actions.saving : common.actions.save}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{ui.deleteDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{ui.deleteDialog.messageTemplate.replace("{username}", target?.username ?? "")}</Typography>
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
