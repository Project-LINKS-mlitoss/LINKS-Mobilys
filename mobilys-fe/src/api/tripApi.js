// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get, post, put } from "./middleware";

export const getTripFrequencyApi = (scenarioId) =>
	get(`/gtfs/data/edit/trip/frequency/${scenarioId}`);

export const postTripFrequencyApi = (data) =>
	post(`/gtfs/data/edit/trip/frequency/`, data);

export const getDetailTripFrequencyApi = (scenarioId, route_id, service_id, trip_headsign, shape_id, direction_id, pattern_hash) =>
	get(`/gtfs/data/edit/trip/frequency-trip-detail?scenario_id=${scenarioId}&route_id=${route_id}&service_id=${service_id}&trip_headsign=${trip_headsign}&shape_id=${shape_id}&direction_id=${direction_id}&pattern_hash=${pattern_hash}`);

export const getDetailMapFrequencyApi = (scenarioId, shape_id) =>
	get(`/gtfs/data/edit/trip/frequency-trip-map?scenario_id=${scenarioId}&shape_id=${shape_id}`);

export const bulkDeleteTripApi = (scenarioId, tripIds) =>
	post(`/gtfs/data/edit/trips/bulk-delete/`, {
		scenario_id: scenarioId,
		trip_ids: tripIds,
	});

export const getTripApi = (scenarioId) =>
	get(`/gtfs/data/edit/trips/?scenario_id=${scenarioId}`);

export const getDetailTripApi = (scenarioId, tripId) =>
	get(`/gtfs/data/edit/trips/${scenarioId}/${tripId}`);

export const createTripApi = (data) =>
	post(`/gtfs/data/edit/trips/`, data);

export const editTripApi = (scenarioId, tripId,  data) =>
	put(`/gtfs/data/edit/trips/${scenarioId}/${tripId}/`, {
		data,
	});