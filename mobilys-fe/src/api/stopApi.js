import { get, post, put, del, patch } from "./middleware";

export const fetchStopGroupsApi = (scenarioId) =>
  get(`/gtfs/data/stops/grouping/${scenarioId}/`);

export const createNewStopParentApi = (data) =>
  post(`/gtfs/data/edit/stop/groups/`, data);

export const createNewStopChildApi = (data) =>
  post(`/gtfs/data/edit/stops/`, data);

export const updateStopApi = (scenarioId, stopId, data) =>
  put(`/gtfs/data/edit/stops/${scenarioId}/${stopId}/`, data);

export const deleteStopApi = (scenarioId, stopId) =>
  del(`/gtfs/data/edit/stops/${scenarioId}/${stopId}/`, {});

export const fetchStopsApi = (scenarioId) =>
  get(`/gtfs/data/stops/?scenario_id=${scenarioId}`);

export const patchStopGroupNameApi = (stop_group_id, data) =>
  patch(`/gtfs/data/edit/stop-name-keywords/${stop_group_id}/`, data);

export const patchStopGroupIdApi = (stop_group_id, data) =>
  patch(`/gtfs/data/edit/stop-id-keywords/${stop_group_id}/`, data);