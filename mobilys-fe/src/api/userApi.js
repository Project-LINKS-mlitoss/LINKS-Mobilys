import { data } from "react-router-dom";
import { post, get, put, del} from "./middleware";

const USERS_BASE_URL = import.meta.env.VITE_API_USERS_BASE_URL;

export const loginUser = (credentials) =>
  post("/user/login/", credentials, {}, USERS_BASE_URL);

export const logoutUser = (data) =>
  post("/user/logout/", data, {}, USERS_BASE_URL);

export const fetchMapListData = () =>
  get(`/gtfs/data/maps/`);

export const updateUserMaps = ( data) => {
  return put(`/gtfs/data/user/map/`, data);
};

// Project APIs
export const fetchProjectApi = () =>
  get(`/user/projects/`);

export const createProjectApi = (data) =>
  post("/user/projects/", data);

export const editProjectApi = (projectId, data) =>
  put(`/user/projects/${projectId}/`, data);

export const deleteProjectApi = (projectId) =>
  del(`/user/projects/${projectId}/`, {});

export const addUserToProjectApi = (projectId, data) =>
  post(`/user/projects/${projectId}/assign-users/`, data);

export const removeUserFromProjectApi = (projectId, userId) =>
  del(`/user/projects/${projectId}/unassign-user/${userId}/`);

export const fetchUserProjectApi = (projectId) =>
  get(`/user/projects/${projectId}/users/`);

export const addOrganizationToProjectApi = (projectId, data) =>
  post(`/user/projects/${projectId}/assign-organization-users/`, data);

export const removeOrganizationFromProjectApi = (projectId, data) =>
  post(`/user/projects/${projectId}/remove-organization-users/`, data);

export const toggleProjectApi = (projectId) =>
  post(`/user/projects/${projectId}/toggle_active/`, {});

// Organization APIs
export const fetchOrganizationApi = () =>
  get(`/user/organizations/`);

export const createOrganizationApi = (data) =>
  post("/user/organizations/", data);

export const editOrganizationApi = (organizationId, data) =>
  put(`/user/organizations/${organizationId}/`, data);

export const deleteOrganizationApi = (organizationId) =>
  del(`/user/organizations/${organizationId}/`, {});

export const toggleOrganizationApi = (organizationId) =>
  post(`/user/organizations/${organizationId}/toggle_active/`, {});

// User APIs
export const fetchUserApi = () =>
  get(`/user/users/`);

export const createUserApi = (data) =>
  post("/user/users/create/", data);

export const editUserApi = (userId, data) =>
  put(`/user/users/${userId}/update/`, data);

export const deleteUserApi = (userId) =>
  del(`/user/users/${userId}/delete/`, {});

export const toggleUserApi = (userId) =>
  post(`/user/users/${userId}/toggle-active/`, {});

export const passwordChangeApi = (userId, data) =>
  post(`/user/users/${userId}/change-password/`, data);

// Role APIs
export const fetchRoleApi = () =>
  get(`/user/roles/`);

export const fetchDetailRoleApi = (roleId) =>
	get(`/user/roles/${roleId}/`);

export const createRoleApi = (data) =>
  post("/user/roles/", data);

export const editRoleApi = (roleId, data) =>
  put(`/user/roles/${roleId}/`, data);

export const deleteRoleApi = (roleId) =>
  del(`/user/roles/${roleId}/`, {});

// Access APIs
export const fetchAccessApi = () =>
  get(`/user/accesses/`);