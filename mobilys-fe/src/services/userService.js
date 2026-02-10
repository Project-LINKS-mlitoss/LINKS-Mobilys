import { create } from "zustand";
import 
{ loginUser, 
  logoutUser, 
  fetchMapListData, 
  updateUserMaps, 
  createProjectApi, 
  editProjectApi, 
  deleteProjectApi, 
  createOrganizationApi, 
  editOrganizationApi, 
  deleteOrganizationApi,
  createUserApi,
  editUserApi,
  deleteUserApi,
  toggleUserApi,
  toggleOrganizationApi,
  addUserToProjectApi,
  fetchUserProjectApi,
  addOrganizationToProjectApi,
  createRoleApi,
  editRoleApi,
  deleteRoleApi,
  removeUserFromProjectApi,
  removeOrganizationFromProjectApi,
  toggleProjectApi,
  fetchAccessApi,
  fetchDetailRoleApi
} from "../api/userApi";
import {
  fetchOrganizationListSvc,
  fetchProjectListSvc,
  fetchRoleListSvc,
  fetchUserListSvc,
  passwordChangeSvc,
} from "./userManagementService";

// userService.js

export const login = async (username, password, extra = {}) => {
  const normalizedExtra =
    typeof extra === 'string'
      ? { project_id: extra }
      : (extra || {});

  const body = {
    username,
    password,
    ...normalizedExtra,
  };

  const response = await loginUser(body); // <-- must forward the WHOLE body
  return response.data;
};


export const logout = async (refreshToken) => {
  const response = await logoutUser({ refresh: refreshToken });
  return response.data;
};

export const fetchMapList = async () => {
  const response = await fetchMapListData();
  return response.data;
}

export const updateUserMap = async (mapData) => {
  const response = await updateUserMaps(mapData);
  if (response.status !== 200) {
    throw new Error('Failed to update user maps');
  }

  return response.data.data;
};

// Project Services
export const fetchProjectList = async () => {
  return fetchProjectListSvc();
};

export const addProject = async (data) => {
  if (!data) {
    throw new Error("Data is required.");
  }
  const response = await createProjectApi(data);
  if (!response || !response.data) {
    throw new Error("Failed to create new project.");
  }

  return response.data.data;
};

export const editProject = async (projectId, data) => {
  try {
    const response = await editProjectApi(projectId, data);
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error("プロジェクト編集に失敗しました。");
    }
  } catch (err) {
    throw new Error(
      err.response?.data?.message || "プロジェクト編集に失敗しました。"
    );
  }
};

export const deleteProject = async (projectId) => {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }
  const response = await deleteProjectApi(projectId);
  if (!response) {
    throw new Error("Failed to delete project.");
  }

  return response;
};

export const addUserToProject = async (projectId, data) => {
  if (!projectId || !data) {
    throw new Error("Project ID and data are required.");
  }
  const response = await addUserToProjectApi(projectId, data);
  if (!response || !response.data) {
    throw new Error("Failed to add user to project.");
  }

  return response.data.data;
};

export const removeUserFromProject = async (projectId, userId) => {
  if (!projectId || !userId) {
    throw new Error("Project ID and User ID are required.");
  }
  const response = await removeUserFromProjectApi(projectId, userId);
  if (!response) {
    throw new Error("Failed to remove user from project.");
  }

  return response;
};

export const fetchUserProject = async (projectId) => {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }
  const response = await fetchUserProjectApi(projectId);
  if (!response || !response.data) {
    throw new Error("Failed to fetch user project.");
  }

  return response.data.data;
};

export const addOrganizationToProject = async (projectId, data) => {
  if (!projectId || !data) {
    throw new Error("Project ID and data are required.");
  }
  const response = await addOrganizationToProjectApi(projectId, data);
  if (!response || !response.data) {
    throw new Error("Failed to add organization to project.");
  }

  return response.data.data;
};

export const removeOrganizationFromProject = async (projectId, data) => {
  if (!projectId || !data) {
    throw new Error("Project ID and data are required.");
  }
  const response = await removeOrganizationFromProjectApi(projectId, data);
  if (!response || !response.data) {
    throw new Error("Failed to remove organization from project.");
  }

  return response.data.data;
};

export const toggleProjectActive = async (projectId) => {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }
  const response = await toggleProjectApi(projectId);
  if (!response || !response.data) {
    throw new Error("Failed to toggle project.");
  }

  return response.data.data;
};

// Organization Services
export const fetchOrganizationList = async () => {
  return fetchOrganizationListSvc();
};

export const addOrganization = async (data) => {
  if (!data) {
    throw new Error("Data is required.");
  }
  const response = await createOrganizationApi(data);
  if (!response || !response.data) {
    throw new Error("Failed to create new organization.");
  }

  return response.data.data;
};

export const editOrganization = async (organizationId, data) => {
  try {
    const response = await editOrganizationApi(organizationId, data);
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error("組織編集に失敗しました。");
    }
  } catch (err) {
    throw new Error(
      err.response?.data?.message || "組織編集に失敗しました。"
    );
  }
};

export const deleteOrganization = async (organizationId) => {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }
  const response = await deleteOrganizationApi(organizationId);
  if (!response) {
    throw new Error("Failed to delete organization.");
  }

  return response;
};

export const toggleOrganization = async (organizationId) => {
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }
  const response = await toggleOrganizationApi(organizationId);
  if (!response) {
    throw new Error("Failed to toggle organization.");
  }

  return response;
};

// User Services
export const fetchUserList = async () => {
  return fetchUserListSvc();
};

export const addUser = async (data) => {
  if (!data) {
    throw new Error("Data is required.");
  }
  const response = await createUserApi(data);
  if (!response || !response.data) {
    throw new Error("Failed to create new user.");
  }

  return response.data.data;
};

export const editUser = async (userId, data) => {
  try {
    const response = await editUserApi(userId, data);
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error("ユーザー編集に失敗しました。");
    }
  } catch (err) {
    throw new Error(
      err.response?.data?.message || "ユーザー編集に失敗しました。"
    );
  }
};

export const deleteUser = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  const response = await deleteUserApi(userId);
  if (!response) {
    throw new Error("Failed to delete user.");
  }

  return response;
};

export const toggleUser = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  const response = await toggleUserApi(userId);
  if (!response) {
    throw new Error("Failed to toggle user.");
  }

  return response;
};

export const passwordChange = async (userId, data) => {
  return passwordChangeSvc(userId, data);
};

// Role Services
export const fetchRoleList = async () => {
  return fetchRoleListSvc();
};

export const fetchRoleDetail = async (roleId) => {
  const response = await fetchDetailRoleApi(roleId);
  return response.data.data;
};

export const addRole = async (data) => {
  if (!data) {
    throw new Error("Data is required.");
  }
  const response = await createRoleApi(data);
  if (!response || !response.data) {
    throw new Error("Failed to create new role.");
  }

  return response.data.data;
};

export const editRole = async (roleId, data) => {
  try {
    const response = await editRoleApi(roleId, data);
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error("ロール編集に失敗しました。");
    }
  } catch (err) {
    throw new Error(
      err.response?.data?.message || "ロール編集に失敗しました。"
    );
  }
};

export const deleteRole = async (roleId) => {
  if (!roleId) {
    throw new Error("Role ID is required.");
  }
  const response = await deleteRoleApi(roleId);
  if (!response) {
    throw new Error("Failed to delete role.");
  }

  return response;
};

// Access Services
export const fetchAccessList = async () => {
  const response = await fetchAccessApi();
  return response.data.data;
};
