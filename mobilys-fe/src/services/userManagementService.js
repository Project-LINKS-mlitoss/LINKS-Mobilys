import {
  fetchOrganizationApi,
  fetchProjectApi,
  fetchRoleApi,
  fetchUserApi,
  passwordChangeApi,
} from "../api/userApi";
import { ERRORS as ERROR_MESSAGES } from "../constant";
import { ApiError } from "../utils/errors/ApiError.js";

function assertHasData(response) {
  if (!response || !response.data) {
    throw new ApiError("No data received from server", {
      statusCode: 500,
      errorCode: "NO_DATA",
    });
  }
}

export async function fetchUserListSvc() {
  try {
    const response = await fetchUserApi();
    assertHasData(response);
    return response.data?.data ?? [];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.users);
  }
}

export async function fetchRoleListSvc() {
  try {
    const response = await fetchRoleApi();
    assertHasData(response);
    return response.data?.data ?? [];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.roles);
  }
}

export async function fetchOrganizationListSvc() {
  try {
    const response = await fetchOrganizationApi();
    assertHasData(response);
    return response.data?.data ?? [];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.organizations);
  }
}

export async function fetchProjectListSvc() {
  try {
    const response = await fetchProjectApi();
    assertHasData(response);
    return response.data?.data ?? [];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.projects);
  }
}

export async function passwordChangeSvc(userId, data) {
  if (!userId || !data) {
    throw new ApiError(ERROR_MESSAGES.user.passwordChange, { errorCode: "INVALID_PARAMS" });
  }

  try {
    const response = await passwordChangeApi(userId, data);
    assertHasData(response);
    return response.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.user.passwordChange);
  }
}
