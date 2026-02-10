import React from "react";
import { useAuthStore } from "../../../state/authStore";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { USER } from "../../../strings";
import { fetchUserListSvc, passwordChangeSvc } from "../../../services/userManagementService";

const MIN_PASSWORD_LEN = 8;

const formatDateTime = (s) => {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s;
  }
};

export function usePasswordChange() {
  const ui = USER.passwordChange;
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const roleLevel = useAuthStore((s) => s.roleLevel);
  const userId = useAuthStore((s) => s.userId);
  const username = useAuthStore((s) => s.username);
  const email = useAuthStore((s) => s.email);

  const isSuper = roleLevel === "super_user";

  // data
  const [users, setUsers] = React.useState([]);
  const [loadingUsers, setLoadingUsers] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  // modal state
  const [openDialog, setOpenDialog] = React.useState(false);
  const [target, setTarget] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [newPw, setNewPw] = React.useState("");
  const [newPw2, setNewPw2] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [showPw2, setShowPw2] = React.useState(false);
  const [pwError, setPwError] = React.useState("");
  const [pw2Error, setPw2Error] = React.useState("");

  const loadUsers = React.useCallback(async () => {
    setLoadingUsers(true);
    setLoadError("");
    try {
      const list = await fetchUserListSvc();
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg = err?.message || "";
      setLoadError(msg);
      showSnackbar?.({ title: msg, severity: "error" });
    } finally {
      setLoadingUsers(false);
    }
  }, [showSnackbar]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const visibleUsers = React.useMemo(() => {
    if (isSuper) return users;

    if (userId != null) {
      const meById = users.filter((u) => String(u.id) === String(userId));
      if (meById.length) return meById;
    }

    if (username) {
      const meByName = users.filter((u) => (u.username ?? "").toLowerCase() === username.toLowerCase());
      if (meByName.length) return meByName;
    }

    if (email) {
      const meByEmail = users.filter((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
      if (meByEmail.length) return meByEmail;
    }

    return [];
  }, [email, isSuper, userId, username, users]);

  const openChangeDialog = React.useCallback((user) => {
    setTarget(user);
    setNewPw("");
    setNewPw2("");
    setPwError("");
    setPw2Error("");
    setShowPw(false);
    setShowPw2(false);
    setOpenDialog(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    if (saving) return;
    setOpenDialog(false);
  }, [saving]);

  const validate = React.useCallback(() => {
    let ok = true;

    if (!newPw?.trim()) {
      setPwError(ui.validation.enterNewPassword);
      ok = false;
    } else if (newPw.trim().length < MIN_PASSWORD_LEN) {
      setPwError(ui.validation.passwordMinLength);
      ok = false;
    } else {
      setPwError("");
    }

    if (!newPw2?.trim()) {
      setPw2Error(ui.validation.enterConfirmPassword);
      ok = false;
    } else if (newPw.trim() !== newPw2.trim()) {
      setPw2Error(ui.validation.passwordMismatch);
      ok = false;
    } else {
      setPw2Error("");
    }

    return ok;
  }, [newPw, newPw2, ui.validation]);

  const handleConfirm = React.useCallback(async () => {
    if (!target?.id) return;
    if (!validate()) {
      showSnackbar?.({ title: ui.validation.checkInput, severity: "warning" });
      return;
    }
    setSaving(true);
    try {
      await passwordChangeSvc(target.id, { new_password: newPw.trim() });
      showSnackbar?.({ title: ui.snackbar.changed, severity: "success" });
      setOpenDialog(false);
      setTarget(null);
    } catch (err) {
      const msg = err?.message || "";
      showSnackbar?.({ title: msg || ui.snackbar.failed, severity: "error" });
    } finally {
      setSaving(false);
    }
  }, [newPw, showSnackbar, target?.id, ui.snackbar, ui.validation.checkInput, validate]);

  const handleNewPasswordChange = React.useCallback(
    (value) => {
      setNewPw(value);
      if (!value || value.length < MIN_PASSWORD_LEN) setPwError(ui.validation.passwordMinLength);
      else setPwError("");
      if (newPw2 && value !== newPw2) setPw2Error(ui.validation.passwordMismatch);
      else setPw2Error("");
    },
    [newPw2, ui.validation.passwordMinLength, ui.validation.passwordMismatch]
  );

  const handleConfirmPasswordChange = React.useCallback(
    (value) => {
      setNewPw2(value);
      if (newPw && value !== newPw) setPw2Error(ui.validation.passwordMismatch);
      else setPw2Error("");
    },
    [newPw, ui.validation.passwordMismatch]
  );

  return {
    ui,
    formatDateTime,
    users,
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
  };
}

