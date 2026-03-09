// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { post, get} from "./middleware";

export const getCalendarApi = (scenarioId) =>
    get(`/gtfs/data/calendar/?scenario_id=${scenarioId}`);

export const previewShapeApi = (data) =>
    post(`/gtfs/data/preview-shape/`, data);