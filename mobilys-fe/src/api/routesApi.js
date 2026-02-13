// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get, put, post, del } from "./middleware";

export const fetchRouteGroupsApi = (scenarioId) =>
  get(`/gtfs/data/routes/grouping/${scenarioId}/`);

export const updateRouteGroupsApi = (scenarioId, data) => {
  return put(`/gtfs/data/routes/grouping/${scenarioId}/`, data);
};

export const updateRouteGroupsApiColor = (routeGroupKeywordId, color) => {
  return put(`/gtfs/data/routes/grouping/color/${routeGroupKeywordId}/`, {
    color,
  });
};

export const updateRouteGroupNameApi = (routeGroupKeywordId, keyword) => {
  return put(
    `/gtfs/data/routes/keyword/grouping/rename/${routeGroupKeywordId}/`,
    { keyword }
  );
};

export const createRouteGroupApi = (data) => {
  return post(`/gtfs/data/routes/keyword/grouping/`, data);
};

export const fetchRoutePatternApi = (scenarioId) =>
  get(`/gtfs/data/edit/route/new/pattern/${scenarioId}/`);

export const createRoutePatternApi = (data) => {
  return post(`/gtfs/data/edit/route/new/pattern/`, data);
};

export const createExistingRoutePatternApi = (data) => {
  return post(`/gtfs/data/edit/route/existing/pattern/`, data);
};

export const deleteRoutePatternApi = (scenarioId, data) => {
  return del(`/gtfs/data/edit/route/new/pattern/${scenarioId}/`, data);
};

export const deleteRouteGroupApi = (scenarioId, data) => {
  return del(`/gtfs/data/routes/keyword/grouping/${scenarioId}/`, data);
};

export const updateRoutePatternApi = (scenarioId, data) => {
  return put(`/gtfs/data/edit/route/new/pattern/${scenarioId}/`, data);
};
