// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import {
  addOrganization,
  addOrganizationToProject,
  addProject,
  addRole,
  addUser,
  addUserToProject,
  deleteOrganization,
  deleteProject,
  deleteRole,
  deleteUser,
  editOrganization,
  editProject,
  editRole,
  editUser,
  fetchAccessList,
  fetchUserProject,
  removeOrganizationFromProject,
  removeUserFromProject,
  toggleOrganization,
  toggleProjectActive,
  toggleUser,
} from "../../../services/userService";
import {
  fetchOrganizationListSvc,
  fetchProjectListSvc,
  fetchRoleListSvc,
  fetchUserListSvc,
} from "../../../services/userManagementService";

export function useUserManagement() {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [tab, setTab] = React.useState(0);

  // data
  const [users, setUsers] = React.useState([]);
  const [roles, setRoles] = React.useState([]);
  const [orgs, setOrgs] = React.useState([]);
  const [projects, setProjects] = React.useState([]);

  // loading / error
  const [loadingAll, setLoadingAll] = React.useState(true);
  const [error, setError] = React.useState("");
  const [loadingProjects, setLoadingProjects] = React.useState(false);
  const [loadingOrgs, setLoadingOrgs] = React.useState(false);

  const fetchUsers = React.useCallback(async () => {
    try {
      setError("");
      const list = await fetchUserListSvc();
      setUsers(Array.isArray(list) ? list : []);
      return true;
    } catch (err) {
      const msg = err?.message || "";
      setError(msg);
      showSnackbar?.({ title: msg, severity: "error" });
      return false;
    }
  }, [showSnackbar]);

  const fetchRoles = React.useCallback(async () => {
    try {
      setError("");
      const list = await fetchRoleListSvc();
      setRoles(Array.isArray(list) ? list : []);
      return true;
    } catch (err) {
      const msg = err?.message || "";
      setError(msg);
      showSnackbar?.({ title: msg, severity: "error" });
      return false;
    }
  }, [showSnackbar]);

  const fetchOrganizations = React.useCallback(async () => {
    try {
      setError("");
      setLoadingOrgs(true);
      const list = await fetchOrganizationListSvc();
      setOrgs(Array.isArray(list) ? list : []);
      return true;
    } catch (err) {
      const msg = err?.message || "";
      setError(msg);
      showSnackbar?.({ title: msg, severity: "error" });
      return false;
    } finally {
      setLoadingOrgs(false);
    }
  }, [showSnackbar]);

  const fetchProjects = React.useCallback(async () => {
    try {
      setError("");
      setLoadingProjects(true);
      const list = await fetchProjectListSvc();
      setProjects(Array.isArray(list) ? list : []);
      return true;
    } catch (err) {
      const msg = err?.message || "";
      setError(msg);
      showSnackbar?.({ title: msg, severity: "error" });
      return false;
    } finally {
      setLoadingProjects(false);
    }
  }, [showSnackbar]);

  const refreshAll = React.useCallback(async () => {
    setError("");
    await Promise.all([fetchUsers(), fetchRoles(), fetchOrganizations(), fetchProjects()]);
  }, [fetchOrganizations, fetchProjects, fetchRoles, fetchUsers]);

  // ---- Mutations (passed down to tab components) ----
  const createUser = React.useCallback(async (payload) => addUser(payload), []);
  const updateUser = React.useCallback(async (userId, payload) => editUser(userId, payload), []);
  const removeUser = React.useCallback(async (userId) => deleteUser(userId), []);
  const toggleUserActive = React.useCallback(async (userId) => toggleUser(userId), []);

  const createRole = React.useCallback(async (payload) => addRole(payload), []);
  const updateRole = React.useCallback(async (roleId, payload) => editRole(roleId, payload), []);
  const removeRole = React.useCallback(async (roleId) => deleteRole(roleId), []);
  const fetchAccessListApi = React.useCallback(async () => fetchAccessList(), []);

  const createOrganization = React.useCallback(async (payload) => addOrganization(payload), []);
  const updateOrganization = React.useCallback(async (orgId, payload) => editOrganization(orgId, payload), []);
  const removeOrganization = React.useCallback(async (orgId) => deleteOrganization(orgId), []);
  const toggleOrganizationActive = React.useCallback(async (orgId) => toggleOrganization(orgId), []);

  const createProject = React.useCallback(async (payload) => addProject(payload), []);
  const updateProject = React.useCallback(async (projectId, payload) => editProject(projectId, payload), []);
  const removeProject = React.useCallback(async (projectId) => deleteProject(projectId), []);
  const toggleProjectActiveApi = React.useCallback(async (projectId) => toggleProjectActive(projectId), []);
  const fetchUserProjectApi = React.useCallback(async (projectId) => fetchUserProject(projectId), []);
  const addUserToProjectApi = React.useCallback(async (projectId, payload) => addUserToProject(projectId, payload), []);
  const addOrganizationToProjectApi = React.useCallback(
    async (projectId, payload) => addOrganizationToProject(projectId, payload),
    []
  );
  const removeUserFromProjectApi = React.useCallback(async (projectId, userId) => removeUserFromProject(projectId, userId), []);
  const removeOrganizationFromProjectApi = React.useCallback(
    async (projectId, payload) => removeOrganizationFromProject(projectId, payload),
    []
  );

  React.useEffect(() => {
    (async () => {
      setLoadingAll(true);
      await refreshAll();
      setLoadingAll(false);
    })();
  }, [refreshAll]);

  return {
    tab,
    setTab,
    users,
    roles,
    orgs,
    projects,
    loadingAll,
    error,
    loadingProjects,
    loadingOrgs,
    refreshAll,
    // actions
    createUser,
    updateUser,
    removeUser,
    toggleUserActive,
    createRole,
    updateRole,
    removeRole,
    fetchAccessListApi,
    createOrganization,
    updateOrganization,
    removeOrganization,
    toggleOrganizationActive,
    createProject,
    updateProject,
    removeProject,
    toggleProjectActiveApi,
    fetchUserProjectApi,
    addUserToProjectApi,
    addOrganizationToProjectApi,
    removeUserFromProjectApi,
    removeOrganizationFromProjectApi,
  };
}
