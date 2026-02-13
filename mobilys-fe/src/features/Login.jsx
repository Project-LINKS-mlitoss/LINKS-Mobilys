// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useState } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  Collapse,
  CircularProgress,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useFormik } from "formik";
import * as Yup from "yup";
import MobilysLogo from "../assets/logo/MobilysLogo.png";
import { login, fetchRoleDetail } from "../services/userService";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { norm, enforceUserManagementAccess } from "../utils/accessControl";
import { AUTH } from "../strings";
import { API, UI, VALIDATION } from "../constant";

export default function Login() {
  const ui = AUTH.login;
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setAccessCodes = useAuthStore((s) => s.setAccessCodes);

  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Project selection modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]); // [{id, name}]
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [confirmingProject, setConfirmingProject] = useState(false);
  const [allowNoProject, setAllowNoProject] = useState(false);

  /** Fetch and set access codes for the logged-in user's role. */
  const loadRoleAccesses = async (role) => {
    // Put navbar in a loading state immediately
    setAccessCodes(null);

    const roleId = typeof role === "object" ? role?.id : role;
    const roleMeta = typeof role === "object" ? role : null;

    if (!roleId) {
      setAccessCodes([]); // No role ⇒ no gated pages
      return;
    }

    try {
      const detail = await fetchRoleDetail(roleId); // { id, ..., accesses: [...] }
      const codes = Array.isArray(detail?.accesses)
        ? detail.accesses
            .map((a) => (typeof a === "string" ? a : a?.access_code || a?.code))
            .filter(Boolean)
            .map(norm)
        : [];
      const roleInfo = { ...(roleMeta || {}), ...(detail || {}) };
      const enforced = enforceUserManagementAccess(codes, roleInfo);
      setAccessCodes(enforced);
    } catch (e) {
      // Fail closed to avoid permanent spinner; optionally show a toast here.
      const roleInfo = { ...(roleMeta || {}) };
      setAccessCodes(enforceUserManagementAccess([], roleInfo));
    }
  };

  const formik = useFormik({
    initialValues: { username: "", password: "" },
    validationSchema: Yup.object({
      username: Yup.string()
        .required(ui.validation.usernameRequired)
        .trim(ui.validation.usernameNoSpaces)
        .max(VALIDATION.auth.usernameMaxLen, ui.validation.usernameMax),
      password: Yup.string()
        .required(ui.validation.passwordRequired)
        .matches(VALIDATION.auth.passwordNoSpacesRegex, ui.validation.passwordNoSpaces),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      setLoginError("");
      try {
        const data = await login(values.username, values.password);

        // Success with tokens
        if (data?.access && data?.refresh) {
          setTokens({ access: data.access, refresh: data.refresh, project: data.project ?? null, user: data.user ?? null });

          // fetch role accesses and navigate
          await loadRoleAccesses(data?.user?.role);
          navigate("/scenarios");
          return;
        }

        // Project selection required
        if (data?.requires_project_selection) {
          const projects = Array.isArray(data.available_projects) ? data.available_projects : [];

          if (!projects.length && !data?.allow_no_project) {
            setLoginError(ui.errors.noAssignableProjects);
            return;
          }

          setAllowNoProject(Boolean(data.allow_no_project));
          setAvailableProjects(projects);

          // Default selection to avoid empty project_id
          if (data.allow_no_project) setSelectedProjectId(UI.login.noProjectValue);
          else if (projects.length > 0) setSelectedProjectId(projects[0].id);
          else setSelectedProjectId("");

          setProjectModalOpen(true);
          return;
        }

        // Specific backend message
        if (Array.isArray(data?.detail) && data.detail[0] === API.auth.backendDetail.noProjectAssigned) {
          setLoginError(ui.errors.noProjectAssigned);
          return;
        }

        setLoginError(ui.errors.loginFailedTryAgain);
      } catch (error) {
        const detailList = error?.response?.data?.detail;
        const msg = Array.isArray(detailList) ? detailList[0] : null;
        if (msg === API.auth.backendDetail.noProjectAssigned) {
          setLoginError(ui.errors.noProjectAssigned);
        } else if (typeof error?.response?.data?.message === "string") {
          setLoginError(error.response.data.message);
        } else {
          setLoginError(ui.errors.invalidCredentials);
        }
      } finally {
        setLoading(false);
      }
    },
  });

  // 決定 → second-phase login
  const handleConfirmProject = async () => {
    if (!selectedProjectId) return;
    setConfirmingProject(true);
    setLoginError("");
    try {
      const { username, password } = formik.values;

      const payload =
        selectedProjectId === UI.login.noProjectValue ? { login_without_project: true } : { project_id: selectedProjectId };
      const data = await login(username, password, payload);

      if (data?.access && data?.refresh) {
        setTokens({ access: data.access, refresh: data.refresh, project: data.project ?? null, user: data.user ?? null });
        await loadRoleAccesses(data?.user?.role);
        setProjectModalOpen(false);
        navigate("/scenarios");
        return;
      }

      if (Array.isArray(data?.detail)) {
        setLoginError(data.detail[0] || ui.errors.loginFailed);
      } else {
        setLoginError(ui.errors.loginFailedAfterProjectSelection);
      }
    } catch (error) {
      const detailList = error?.response?.data?.detail;
      const msg = Array.isArray(detailList) ? detailList[0] : null;
      setLoginError(msg || error?.response?.data?.message || ui.errors.loginFailedAfterProjectSelection);
    } finally {
      setConfirmingProject(false);
    }
  };

  const submitDisabled =
    loading ||
    !formik.values.username ||
    !formik.values.password ||
    Boolean(formik.errors.username) ||
    Boolean(formik.errors.password);

  return (
    <Box
      sx={{
        minHeight: UI.login.page.minHeight,
        backgroundColor: UI.login.page.backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: UI.login.page.paddingX,
      }}
    >
      <Container maxWidth="xs">
        <form onSubmit={formik.handleSubmit}>
          <Box sx={{ textAlign: "center", mb: UI.login.header.marginBottom }}>
            <img src={MobilysLogo} alt="Mobilys Logo" style={{ width: UI.login.logo.widthPx, height: "auto" }} />
            <Typography variant="h6" sx={{ fontWeight: UI.login.header.titleFontWeight, mt: UI.login.header.titleMarginTop }}>
              {ui.title}
            </Typography>
          </Box>

          <TextField
            fullWidth
            name="username"
            label={ui.fields.username.label}
            placeholder={ui.fields.username.placeholder}
            helperText={
              formik.touched.username && formik.errors.username ? formik.errors.username : ui.fields.username.helperText
            }
            error={formik.touched.username && Boolean(formik.errors.username)}
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            margin="normal"
            autoComplete="username"
          />

          <TextField
            fullWidth
            name="password"
            type={showPassword ? "text" : "password"}
            label={ui.fields.password.label}
            placeholder={ui.fields.password.placeholder}
            helperText={formik.touched.password && formik.errors.password ? formik.errors.password : ""}
            error={formik.touched.password && Boolean(formik.errors.password)}
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            margin="normal"
            autoComplete="current-password"
            onKeyDown={(e) => { if (e.key === "Enter") formik.handleSubmit(); }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label="toggle password visibility" onClick={() => setShowPassword((show) => !show)} edge="end" size="large">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            sx={{ mt: UI.login.button.marginTop }}
            disabled={submitDisabled}
            endIcon={loading ? <CircularProgress size={UI.login.progress.submitSizePx} color="inherit" /> : null}
          >
            {ui.actions.submit}
          </Button>

          <Collapse in={Boolean(loginError)}>
            <Alert severity="error" icon={<ErrorOutlineIcon fontSize="inherit" />} sx={{ mt: UI.login.alert.marginTop }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {ui.errors.title}
              </Typography>
              <Typography variant="body2">{loginError}</Typography>
            </Alert>
          </Collapse>
        </form>

        {/* Project selection modal */}
        <Dialog open={projectModalOpen} onClose={() => setProjectModalOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>{ui.dialogs.projectSelect.title}</DialogTitle>
          <DialogContent>
            <Stack spacing={UI.login.projectSelect.stackSpacing} sx={{ mt: UI.login.projectSelect.stackMarginTop }}>
              <FormControl fullWidth>
                <InputLabel id="project-select-label">{ui.dialogs.projectSelect.fieldLabel}</InputLabel>
                <Select
                  labelId="project-select-label"
                  label={ui.dialogs.projectSelect.fieldLabel}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {availableProjects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                  {allowNoProject && (
                    <MenuItem value={UI.login.noProjectValue}>{ui.actions.loginWithoutProject}</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProjectModalOpen(false)}>{ui.actions.cancel}</Button>
            <Button
              variant="contained"
              onClick={handleConfirmProject}
              disabled={!selectedProjectId || confirmingProject}
              endIcon={confirmingProject ? <CircularProgress size={UI.login.progress.confirmSizePx} color="inherit" /> : null}
            >
              {ui.actions.confirm}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
