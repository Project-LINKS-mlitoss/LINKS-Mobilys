import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import KeyIcon from "@mui/icons-material/VpnKey";

import { usePasswordChange } from "./hooks/usePasswordChange";

export default function PasswordChange() {
  const {
    ui,
    formatDateTime,
    visibleUsers,
    loadingUsers,
    loadError,
    openDialog,
    openChangeDialog,
    closeDialog,
    target,
    saving,
    newPw,
    newPw2,
    showPw,
    setShowPw,
    showPw2,
    setShowPw2,
    pwError,
    pw2Error,
    handleConfirm,
    handleNewPasswordChange,
    handleConfirmPasswordChange,
  } = usePasswordChange();

  if (loadingUsers) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>;
  }

  return (
    <Box
      sx={{
        height: "86vh",
        boxSizing: "border-box",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        mt: -4,
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 600, ml: 1, mb: 1 }}>
        {ui.title}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.username}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.role}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.organization}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.createdAt}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                {ui.table.headers.actions}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleUsers.map((u) => (
              <TableRow hover key={u.id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.user_detail?.role_name ?? "—"}</TableCell>
                <TableCell>{u.user_detail?.organization_name || "—"}</TableCell>
                <TableCell>{formatDateTime(u.user_detail?.created_date)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => openChangeDialog(u)} startIcon={<KeyIcon />}>
                      {ui.actions.openDialog}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {visibleUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
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
        key={target ? `pwd-${target.id}` : `pwd`}
        open={openDialog}
        onClose={closeDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{ component: "form", autoComplete: "off" }}
      >
        <DialogTitle>{ui.dialog.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {ui.dialog.targetUserLabel} <strong>{target?.username ?? "—"}</strong>
          </Typography>

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
              label={ui.fields.newPassword}
              type={showPw ? "text" : "password"}
              value={newPw}
              onChange={(e) => handleNewPasswordChange(e.target.value)}
              required
              autoComplete="new-password"
              error={!!pwError}
              helperText={pwError || ui.helperText.passwordMinHint}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={showPw ? ui.tooltips.hide : ui.tooltips.show}>
                      <IconButton
                        aria-label={showPw ? ui.tooltips.ariaHide : ui.tooltips.ariaShow}
                        onClick={() => setShowPw((v) => !v)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPw ? <Visibility /> : <VisibilityOff />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label={ui.fields.newPasswordConfirm}
              type={showPw2 ? "text" : "password"}
              value={newPw2}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              required
              autoComplete="new-password"
              error={!!pw2Error}
              helperText={pw2Error || ui.helperText.passwordConfirmHint}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={showPw2 ? ui.tooltips.hide : ui.tooltips.show}>
                      <IconButton
                        aria-label={showPw2 ? ui.tooltips.ariaHide : ui.tooltips.ariaShow}
                        onClick={() => setShowPw2((v) => !v)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPw2 ? <Visibility /> : <VisibilityOff />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            {ui.dialog.cancel}
          </Button>
          <Button variant="contained" onClick={handleConfirm} disabled={saving}>
            {saving ? ui.dialog.confirming : ui.dialog.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

