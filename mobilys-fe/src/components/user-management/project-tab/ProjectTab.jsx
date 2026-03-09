// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useState } from "react";
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
  Collapse,
  IconButton,
  Chip,
  Autocomplete,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { UI } from "../../../constant/ui";
import { USER } from "../../../strings/domains/user";

// ---- Helpers ----
function normalizeId(v) {
  return v === null || v === undefined ? "" : String(v);
}


function userOrgId(u) {
  return normalizeId(u?.user_detail?.organization);
}

export default function ProjectTab({
  projects = [],
  organizations = [],
  users = [],
  onRefresh,
  loading,
  createProject,
  updateProject,
  removeProject,
  toggleProjectActiveApi,
  fetchUserProjectApi,
  addUserToProjectApi,
  addOrganizationToProjectApi,
  removeUserFromProjectApi,
  removeOrganizationFromProjectApi,
}) {
  const formatDateTime = (s) => {
    if (!s) return UI.userManagement.fallbackDash;
    try {
      const d = new Date(s);
      return d.toLocaleString();
    } catch {
      return s;
    }
  };

  const [openDialog, setOpenDialog] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Expand states
  const [expandedProjects, setExpandedProjects] = useState(() => new Set());
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [links, setLinks] = useState({});
  const [projectUsers, setProjectUsers] = useState({});

  // pickers
  const [orgPicker, setOrgPicker] = useState({ open: false, project: null, selected: [] });
  const [userPicker, setUserPicker] = useState({ open: false, project: null, selected: [] });

  const [form, setForm] = useState({ project_name: "", description: "", active: true });

  // Confirm dialogs (org/user removal)
  const [orgConfirm, setOrgConfirm] = useState({ open: false, pid: null, oid: "", name: "" });
  const [userConfirm, setUserConfirm] = useState({ open: false, pid: null, uid: null, name: "" });
  const [removing, setRemoving] = useState(false);

  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const ui = USER.userManagement.projectTab;
  const common = USER.userManagement.common;

  // maps for quick lookup
  const orgMap = useMemo(() => {
    const m = new Map();
    organizations.forEach((o) => m.set(normalizeId(o.id), o));
    return m;
  }, [organizations]);

  const userMap = useMemo(() => {
    const m = new Map();
    users.forEach((u) => m.set(normalizeId(u.id), u));
    return m;
  }, [users]);

  const getProjectLinks = (projectId) =>
    links[projectId] || { orgIds: new Set(), userIds: new Set() };

  const getOrgMemberIds = (orgId, allUsers) =>
    allUsers
      .filter((u) => userOrgId(u) === normalizeId(orgId))
      .map((u) => String(u.id));

  const hasOrgLink = (projectId, orgId) =>
    !!getProjectLinks(projectId).orgIds?.has(normalizeId(orgId));

  const getAssignedUserIds = (projectId) => {
    const setFromLinks = getProjectLinks(projectId).userIds || new Set();
    const fetched = projectUsers[projectId] || [];
    const fetchedIds = new Set(fetched.map((u) => String(u.id)));
    return new Set([...Array.from(setFromLinks), ...Array.from(fetchedIds)]);
  };

  const isOrgSatisfied = (projectId, orgId, allUsers) => {
    const assigned = getAssignedUserIds(projectId);
    const members = getOrgMemberIds(orgId, allUsers);
    // Condition: org is linked AND all members are already in the project
    if (!hasOrgLink(projectId, orgId)) return false;
    if (members.length === 0) return true; // if no members, linked is enough
    return members.every((id) => assigned.has(id));
  };

  const openCreate = () => {
    setTarget(null);
    setForm({ project_name: "", description: "", active: true });
    setOpenDialog(true);
  };

  const openEdit = (p) => {
    setTarget(p);
    setForm({
      project_name: p.project_name || "",
      description: p.description || "",
      active: !!p.active,
    });
    setOpenDialog(true);
  };

  const saveProject = async () => {
    const payload = {
      project_name: form.project_name?.trim(),
      description: form.description?.trim(),
      active: !!form.active,
    };
    if (!payload.project_name) {
      showSnackbar({ title: ui.validation.nameRequired, severity: "warning" });
      return;
    }
    setSaving(true);
    try {
      if (target) {
        await updateProject(target.id, payload);
        showSnackbar({ title: ui.snackbar.updated, severity: "success" });
      } else {
        const res = await createProject(payload);
        if (!res) throw new Error(ui.snackbar.createdFailed);
        showSnackbar({ title: ui.snackbar.created, severity: "success" });
      }
      setOpenDialog(false);
      await onRefresh?.();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.saveFailed, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p) => {
    setTarget(p);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!target?.id) return;
    setDeleting(true);
    try {
      await removeProject(target.id);
      showSnackbar({ title: ui.snackbar.deleted, severity: "success" });
      setDeleteOpen(false);
      setTarget(null);
      await onRefresh?.();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.deleteFailed, severity: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // ---- Expand Handlers ----
  const ensureOrgSet = (pid) => {
    setExpandedOrgs((prev) => {
      if (prev[pid]) return prev;
      return { ...prev, [pid]: new Set() };
    });
  };

  const toggleProjectExpand = async (pid) => {
    const willOpen = !expandedProjects.has(pid);
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
    ensureOrgSet(pid);
    if (willOpen && !projectUsers[pid]) {
      try {
        const res = await fetchUserProjectApi(pid);
        const fetched = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setProjectUsers((prev) => ({ ...prev, [pid]: fetched }));
        const fetchedUserIds = new Set(fetched.map((u) => String(u.id)));
        const fetchedOrgIds = new Set(
          fetched.map((u) => userOrgId(u)).filter(Boolean)
        );
        setLinks((prev) => {
          const cur = prev[pid] || { orgIds: new Set(), userIds: new Set() };
          const nextOrgs = new Set(cur.orgIds);
          const nextUsers = new Set(cur.userIds);
          fetchedOrgIds.forEach((id) => nextOrgs.add(id));
          fetchedUserIds.forEach((id) => nextUsers.add(id));
          return { ...prev, [pid]: { orgIds: nextOrgs, userIds: nextUsers } };
        });
      } catch (err) {
        showSnackbar({
          title: err?.message || ui.snackbar.fetchUsersFailed,
          severity: "error",
        });
      }
    }
  };

  const toggleOrgExpand = (pid, orgId) => {
    ensureOrgSet(pid);
    setExpandedOrgs((prev) => {
      const setForPid = new Set(prev[pid]);
      if (setForPid.has(orgId)) setForPid.delete(orgId);
      else setForPid.add(orgId);
      return { ...prev, [pid]: setForPid };
    });
  };

  // ---- Add/Remove Organizations ----
  const openOrgPicker = (project) => {
    setOrgPicker({ open: true, project, selected: [] });
  };

  const confirmAddOrganizations = async () => {
    const project = orgPicker.project;
    if (!project) return;

    const pid = project.id;
    const selectedOrgIds = orgPicker.selected.map(normalizeId);

    const assignedUserIds = getAssignedUserIds(pid);
    const linkedOrgIds = new Set(Array.from(getProjectLinks(pid).orgIds || []));
    const orgIdsNeedingLink = [];
    const missingUserIdsAll = new Set();

    for (const oid of selectedOrgIds) {
      const needLink = !linkedOrgIds.has(oid);
      if (needLink) orgIdsNeedingLink.push(oid);

      // All members of this org
      const memberIds = getOrgMemberIds(oid, users);
      // Only those not yet assigned to the project
      memberIds.forEach((uid) => {
        if (!assignedUserIds.has(uid)) missingUserIdsAll.add(uid);
      });
    }

    try {
      // 1) Link orgs that aren't linked yet
      if (orgIdsNeedingLink.length > 0) {
        await Promise.all(
          orgIdsNeedingLink.map((orgId) =>
            addOrganizationToProjectApi(pid, { organization_id: orgId })
          )
        );
      }

      // 2) Add missing org members (override behavior: only add what's missing)
      if (missingUserIdsAll.size > 0) {
        await addUserToProjectApi(pid, { user_ids: Array.from(missingUserIdsAll) });
      }

      // Optimistic UI updates
      setLinks((prev) => {
        const cur = prev[pid] || { orgIds: new Set(), userIds: new Set() };
        const nextOrgs = new Set(cur.orgIds);
        const nextUsers = new Set(cur.userIds);
        selectedOrgIds.forEach((oid) => nextOrgs.add(oid));
        Array.from(missingUserIdsAll).forEach((uid) => nextUsers.add(uid));
        return { ...prev, [pid]: { orgIds: nextOrgs, userIds: nextUsers } };
      });

      setProjectUsers((prev) => {
        const cur = prev[pid];
        if (!cur) return prev;
        const nextUsersArr = [...cur];
        const needToPush = new Set(Array.from(missingUserIdsAll));
        users.forEach((u) => {
          const idStr = String(u.id);
          if (needToPush.has(idStr)) {
            if (!nextUsersArr.find((x) => String(x.id) === idStr)) nextUsersArr.push(u);
          }
        });
        return { ...prev, [pid]: nextUsersArr };
      });

      showSnackbar({ title: ui.snackbar.linksUpdated, severity: "success" });
      await onRefresh?.();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.addOrgFailed, severity: "error" });
    } finally {
      setOrgPicker({ open: false, project: null, selected: [] });
    }
  };

  const removeOrgFromProject = async (pid, oid) => {
    try {
      const orgId = normalizeId(oid);
      // collect current members of this org in the project (for optimistic removal)
      const membersInProject = (projectUsers[pid] || [])
        .filter((u) => userOrgId(u) === orgId)
        .map((u) => String(u.id));

      await removeOrganizationFromProjectApi(pid, { organization_id: orgId });

      // Optimistic unlink org and its members
      setLinks((prev) => {
        const cur = prev[pid] || { orgIds: new Set(), userIds: new Set() };
        const nextOrgs = new Set(cur.orgIds);
        const nextUsers = new Set(cur.userIds);
        nextOrgs.delete(orgId);
        membersInProject.forEach((uid) => nextUsers.delete(uid));
        return { ...prev, [pid]: { orgIds: nextOrgs, userIds: nextUsers } };
      });

      setProjectUsers((prev) => {
        const cur = prev[pid];
        if (!cur) return prev;
        const next = cur.filter((u) => !(userOrgId(u) === orgId));
        return { ...prev, [pid]: next };
      });

      setExpandedOrgs((prev) => {
        const setForPid = new Set(prev[pid] || []);
        setForPid.delete(orgId);
        return { ...prev, [pid]: setForPid };
      });

      showSnackbar({ title: ui.snackbar.removedOrg, severity: "success" });
      await onRefresh?.();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.removeOrgFailed, severity: "error" });
    }
  };

  // ---- Add/Remove Users ----
  const openUserPicker = (project) => {
    setUserPicker({ open: true, project, selected: [] });
  };

  const confirmAddUsers = async () => {
    const project = userPicker.project;
    if (!project) return;
    const selectedIds = userPicker.selected.map(String);
    const already = getAssignedUserIds(project.id);
    const toAdd = selectedIds.filter((id) => !already.has(id));

    if (toAdd.length === 0) {
      setUserPicker({ open: false, project: null, selected: [] });
      return;
    }

    try {
      await addUserToProjectApi(project.id, { user_ids: toAdd });

      setLinks((prev) => {
        const cur = prev[project.id] || { orgIds: new Set(), userIds: new Set() };
        const nextUsers = new Set(cur.userIds);
        const nextOrgs = new Set(cur.orgIds);
        toAdd.forEach((uid) => {
          nextUsers.add(uid);
          const u =
            (projectUsers[project.id] || users).find((x) => String(x.id) === uid) ||
            users.find((x) => String(x.id) === uid);
          const oid = userOrgId(u);
          if (oid) nextOrgs.add(oid);
        });
        return { ...prev, [project.id]: { orgIds: nextOrgs, userIds: nextUsers } };
      });

      setProjectUsers((prev) => {
        const cur = prev[project.id];
        if (!cur) return prev;
        const next = [...cur];
        toAdd.forEach((uid) => {
          const found = users.find((u) => String(u.id) === uid);
          if (found && !next.find((x) => String(x.id) === uid)) next.push(found);
        });
        return { ...prev, [project.id]: next };
      });

      showSnackbar({ title: ui.snackbar.addedUser, severity: "success" });
      await onRefresh?.();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.addUserFailed, severity: "error" });
    } finally {
      setUserPicker({ open: false, project: null, selected: [] });
    }
  };

  const removeUser = async (pid, uid) => {
    try {
      await removeUserFromProjectApi(pid, uid);

      setLinks((prev) => {
        const cur = prev[pid] || { orgIds: new Set(), userIds: new Set() };
        const nextUsers = new Set(cur.userIds);
        nextUsers.delete(String(uid));
        return { ...prev, [pid]: { ...cur, userIds: nextUsers } };
      });

      setProjectUsers((prev) => {
        const cur = prev[pid];
        if (!cur) return prev;
        const next = cur.filter((u) => String(u.id) !== String(uid));
        return { ...prev, [pid]: next };
      });

      showSnackbar({ title: ui.snackbar.removedUser, severity: "success" });
      await onRefresh?.();
    } catch (err) {
      showSnackbar({ title: err?.message || ui.snackbar.removeUserFailed, severity: "error" });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!projects) return null;

  return (
    <Box>
      {/* Top actions */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button variant="outlined"  onClick={openCreate}>
          {ui.actions.create}
        </Button>
      </Stack>

      {/* ===== LEVEL 1: PROJECTS ===== */}
      <TableContainer component={Paper} variant="outlined">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width={UI.userManagement.projectTab.iconColWidthPx} />
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.projectName}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.description}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.createdAt}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                {ui.table.headers.active}
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                 
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((p) => {
              const isOpen = expandedProjects.has(p.id);

              // choose data source for users: fetched (preferred) or link userIds -> userMap
              const projUsers = projectUsers[p.id]
                ? projectUsers[p.id]
                : Array.from(getProjectLinks(p.id).userIds || [])
                    .map((id) => userMap.get(id))
                    .filter(Boolean);

              // group users by org id ("" for none)
              const usersByOrg = new Map();
              projUsers.forEach((u) => {
                const oid = userOrgId(u); // "" if none
                if (!usersByOrg.has(oid)) usersByOrg.set(oid, []);
                usersByOrg.get(oid).push(u);
              });

              // orgs explicitly linked (from links)
              const explicitOrgIds = Array.from(getProjectLinks(p.id).orgIds || []);

              // union: explicit orgs + orgs inferred by users
              const unifiedOrgIds = [
                ...new Set([...explicitOrgIds, ...Array.from(usersByOrg.keys())]),
              ].filter((oid) => (usersByOrg.get(oid) || []).length > 0);

              // sort: real orgs first (alpha by name), then "" (no-org) last
              const sortedOrgIds = unifiedOrgIds.slice().sort((a, b) => {
                if (a === "" && b !== "") return 1;
                if (b === "" && a !== "") return -1;
                const aName =
                  orgMap.get(a)?.organization_name ||
                  usersByOrg.get(a)?.[0]?.user_detail?.organization_name ||
                  "";
                const bName =
                  orgMap.get(b)?.organization_name ||
                  usersByOrg.get(b)?.[0]?.user_detail?.organization_name ||
                  "";
                return aName.localeCompare(bName, "ja");
              });

              return (
                <React.Fragment key={p.id}>
                  <TableRow hover>
                    <TableCell width={UI.userManagement.projectTab.iconColWidthPx}>
                      <IconButton size="small" onClick={() => toggleProjectExpand(p.id)}>
                        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{p.project_name}</TableCell>
                    <TableCell>{p.description}</TableCell>
                    <TableCell>{formatDateTime(p.created_datetime || p.created_date)}</TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={!!p.active}
                        disabled={togglingIds.has(p.id)}
                        onChange={async () => {
                          // mark as in-flight
                          setTogglingIds((prev) => {
                            const next = new Set(prev);
                            next.add(p.id);
                            return next;
                          });

                          try {
                            await toggleProjectActiveApi(p.id);
                            showSnackbar({ title: ui.snackbar.toggleSuccess, severity: "success" });
                            await onRefresh?.(); 
                          } catch (err) {
                            showSnackbar({
                              title: err?.message || ui.snackbar.toggleFailed,
                              severity: "error",
                            });
                          } finally {
                            // clear in-flight flag
                            setTogglingIds((prev) => {
                              const next = new Set(prev);
                              next.delete(p.id);
                              return next;
                            });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openOrgPicker(p)}
                        >
                          {ui.actions.addOrganization}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openUserPicker(p)}
                        >
                          {ui.actions.addUser}
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => openEdit(p)}>
                          {common.actions.edit}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleDelete(p)}
                        >
                          <span className="material-symbols-outlined outlined">
                            delete
                          </span>
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>

                  {/* ===== LEVEL 2: ORGANIZATIONS (nested) ===== */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1, pl: UI.userManagement.projectTab.indentPerLevelPx }}>
                          <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                            <colgroup>
                              <col style={{ width: UI.userManagement.projectTab.iconColWidthPx }} />
                              <col />
                              <col style={{ width: 160 }} />
                              <col style={{ width: 160 }} />
                            </colgroup>
                            <TableHead>
                              <TableRow>
                                <TableCell />
                                <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.organizationName}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.userCount}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sortedOrgIds.map((oid) => {
                                const orgObj = oid ? orgMap.get(oid) : null;
                                const groupUsers = (usersByOrg.get(oid) || []).filter(Boolean);
                                const fallbackOrgName =
                                  groupUsers.find((u) => u?.user_detail?.organization_name)
                                    ?.user_detail?.organization_name || null;
                                const title =
                                  oid === ""
                                    ? ui.dialog.placeholders.noOrganization
                                    : orgObj?.organization_name || fallbackOrgName || ui.dialog.placeholders.organizationUnknown;
                                const orgIsOpen =
                                  (expandedOrgs[p.id] && expandedOrgs[p.id].has(oid)) || false;

                                return (
                                  <React.Fragment key={oid || "no-org"}>
                                    <TableRow hover>
                                      <TableCell>
                                        <IconButton size="small" onClick={() => toggleOrgExpand(p.id, oid)}>
                                          {orgIsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                      </TableCell>
                                      <TableCell>{title}</TableCell>
                                      <TableCell>{groupUsers.length}</TableCell>
                                      <TableCell>
                                        {oid && (
                                          <Tooltip title={ui.tooltips.removeOrganization}>
                                            <span>
                                              <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() =>
                                                  setOrgConfirm({
                                                    open: true,
                                                    pid: p.id,
                                                    oid,
                                                    name: title,
                                                  })
                                                }
                                              >
                                                {common.actions.remove}
                                              </Button>
                                            </span>
                                          </Tooltip>
                                        )}
                                      </TableCell>
                                    </TableRow>

                                    {/* ===== LEVEL 3: USERS (nested under org) ===== */}
                                    <TableRow>
                                      <TableCell
                                        colSpan={4}
                                        sx={{ p: 0, pl: UI.userManagement.projectTab.indentPerLevelPx }}
                                      >
                                        <Collapse in={orgIsOpen} timeout="auto" unmountOnExit>
                                          <Box sx={{ py: 1 }}>
                                            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                                              <colgroup>
                                                <col />
                                                <col style={{ width: 220 }} />
                                                <col style={{ width: 120 }} />
                                                <col style={{ width: 120 }} />
                                              </colgroup>
                                              <TableHead>
                                                <TableRow>
                                                  <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.username}</TableCell>
                                                  <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.role}</TableCell>
                                                  <TableCell sx={{ fontWeight: 600 }}>{ui.table.headers.enabled}</TableCell>
                                                  <TableCell sx={{ fontWeight: 600 }}></TableCell>
                                                </TableRow>
                                              </TableHead>
                                              <TableBody>
                                                {groupUsers.length === 0 ? (
                                                  <TableRow>
                                                    <TableCell colSpan={4}>
                                                      <Typography color="text.secondary">{ui.table.empty.users}</Typography>
                                                    </TableCell>
                                                  </TableRow>
                                                ) : (
                                                  groupUsers.map((u) => (
                                                    <TableRow key={u.id}>
                                                      <TableCell>{u.username || u.email || u.id}</TableCell>
                                                      <TableCell>{u.user_detail?.role_name || UI.userManagement.fallbackDash}</TableCell>
                                                      <TableCell>{u.is_active ? common.status.active : common.status.inactive}</TableCell>
                                                      <TableCell>
                                                        <Tooltip title={ui.tooltips.removeUser}>
                                                          <span>
                                                            <Button
                                                              variant="outlined"
                                                              size="small"
                                                              onClick={() =>
                                                                setUserConfirm({
                                                                  open: true,
                                                                  pid: p.id,
                                                                  uid: u.id,
                                                                  name: u.username || u.email || String(u.id),
                                                                })
                                                              }
                                                            >
                                                              {common.actions.remove}
                                                            </Button>
                                                          </span>
                                                        </Tooltip>
                                                      </TableCell>
                                                    </TableRow>
                                                  ))
                                                )}
                                              </TableBody>
                                            </Table>
                                          </Box>
                                        </Collapse>
                                      </TableCell>
                                    </TableRow>
                                  </React.Fragment>
                                );
                              })}
                              {sortedOrgIds.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4}>
                                    <Typography color="text.secondary">{common.placeholders.noData}</Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">{ui.table.empty.projects}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ===== Create/Edit Dialog ===== */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{target ? ui.dialog.title.edit : ui.dialog.title.create}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={ui.dialog.fields.projectName}
              value={form.project_name}
              onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              required
            />
            <TextField
              label={ui.dialog.fields.description}
              multiline
              minRows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
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
          <Button variant="contained" onClick={saveProject} disabled={saving}>
            {saving ? common.actions.saving : common.actions.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Delete Project Dialog ===== */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{ui.dialog.title.deleteConfirm}</DialogTitle>
        <DialogContent>
          <Typography>{ui.confirm.deleteProjectTemplate.replace("{projectName}", target?.project_name ?? "")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{common.actions.cancel}</Button>
          <Button
            variant="contained"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? common.actions.deleting : common.actions.delete}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Add Organizations Modal ===== */}
      <Dialog
        open={orgPicker.open}
        onClose={() => setOrgPicker({ open: false, project: null, selected: [] })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{ui.dialog.title.addOrganization}</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={(() => {
              const pid = orgPicker.project?.id;
              if (!pid) return [];
              return organizations.filter((o) => {
                const oid = normalizeId(o.id);
                const satisfied = isOrgSatisfied(pid, oid, users);
                const alreadySelected = orgPicker.selected.includes(oid);
                return !satisfied && !alreadySelected;
              });
            })()}
            getOptionLabel={(o) => o.organization_name || ""}
            value={organizations.filter((o) => orgPicker.selected.includes(normalizeId(o.id)))}
            onChange={(_, newValue) => {
              setOrgPicker((p) => ({
                ...p,
                selected: newValue.map((o) => normalizeId(o.id)),
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ui.dialog.fields.selectOrganization}
                placeholder={ui.dialog.placeholders.searchOrganization}
              />
            )}
          />
          <Typography variant="caption" color="text.secondary">
            {ui.dialog.helperText.orgAddedAutoLink}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrgPicker({ open: false, project: null, selected: [] })}>
            {common.actions.cancel}
          </Button>
          <Button variant="contained" onClick={confirmAddOrganizations} disabled={!orgPicker.project}>
            {common.actions.add}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Add Users Modal ===== */}
      <Dialog
        open={userPicker.open}
        onClose={() => setUserPicker({ open: false, project: null, selected: [] })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{ui.dialog.title.addUser}</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={users.filter((u) => {
              const pid = userPicker.project?.id;
              if (!pid) return false;
              const assigned = getAssignedUserIds(pid);
              const idStr = String(u.id);
              return !assigned.has(idStr) && !userPicker.selected.includes(idStr);
            })}
            getOptionLabel={(u) => u.username || u.email || ""}
            value={users.filter((u) => userPicker.selected.includes(String(u.id)))}
            onChange={(_, newValue) => {
              setUserPicker((p) => ({
                ...p,
                selected: newValue.map((u) => String(u.id)),
              }));
            }}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>{option.username || option.email}</Typography>
                  {option.user_detail?.organization_name && (
                    <Chip size="small" label={option.user_detail.organization_name} />
                  )}
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ui.dialog.fields.selectUser}
                placeholder={ui.dialog.placeholders.searchUser}
              />
            )}
          />
          <Typography variant="caption" color="text.secondary">
            {ui.dialog.helperText.userAddedAutoOrg}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserPicker({ open: false, project: null, selected: [] })}>
            {common.actions.cancel}
          </Button>
          <Button variant="contained" onClick={confirmAddUsers} disabled={!userPicker.project}>
            {common.actions.add}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Remove Organization Confirm ===== */}
      <Dialog
        open={orgConfirm.open}
        onClose={() => setOrgConfirm({ open: false, pid: null, oid: "", name: "" })}
      >
        <DialogTitle>{ui.dialog.title.removeOrganization}</DialogTitle>
        <DialogContent>
          <Typography>
            {ui.confirm.removeOrganizationTemplate.replace(
              "{organizationName}",
              orgConfirm.name || ui.dialog.placeholders.unknownOrganization
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrgConfirm({ open: false, pid: null, oid: "", name: "" })}>
            {common.actions.cancel}
          </Button>
          <Button
            variant="contained"
            disabled={removing}
            onClick={async () => {
              setRemoving(true);
              try {
                await removeOrgFromProject(orgConfirm.pid, orgConfirm.oid);
                setOrgConfirm({ open: false, pid: null, oid: "", name: "" });
              } finally {
                setRemoving(false);
              }
            }}
          >
            {removing ? common.actions.removing : common.actions.remove}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Remove User Confirm ===== */}
      <Dialog
        open={userConfirm.open}
        onClose={() => setUserConfirm({ open: false, pid: null, uid: null, name: "" })}
      >
        <DialogTitle>{ui.dialog.title.removeUser}</DialogTitle>
        <DialogContent>
          <Typography>
            {ui.confirm.removeUserTemplate.replace(
              "{username}",
              userConfirm.name || ui.dialog.placeholders.unknownUser
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserConfirm({ open: false, pid: null, uid: null, name: "" })}>
            {common.actions.cancel}
          </Button>
          <Button
            variant="contained"
            disabled={removing}
            onClick={async () => {
              setRemoving(true);
              try {
                await removeUser(userConfirm.pid, userConfirm.uid);
                setUserConfirm({ open: false, pid: null, uid: null, name: "" });
              } finally {
                setRemoving(false);
              }
            }}
          >
            {removing ? common.actions.removing : common.actions.remove}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
