import { get,put } from "./middleware";

export const fetchStopGroupsApi = (scenarioId) =>
  get(`/gtfs/data/stops/grouping/${scenarioId}/`);

export const updateStopGroupsApi = (scenarioId, data) => {
  return put(`/gtfs/data/stops/grouping/${scenarioId}/`, data);
};

export const updateStopGroupingMethodApi = (scenarioId, data) => {
  return put(`/gtfs/data/stops/grouping/method/${scenarioId}/`, data);
};
