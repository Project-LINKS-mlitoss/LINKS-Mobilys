// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get,put } from "./middleware";

export const fetchStopGroupsApi = (scenarioId) =>
  get(`/gtfs/data/stops/grouping/${scenarioId}/`);

export const updateStopGroupsApi = (scenarioId, data) => {
  return put(`/gtfs/data/stops/grouping/${scenarioId}/`, data);
};

export const updateStopGroupingMethodApi = (scenarioId, data) => {
  return put(`/gtfs/data/stops/grouping/method/${scenarioId}/`, data);
};
