// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { post, put } from "./middleware";


export const bulkUpdateShape = (scenarioId, data) =>
    put(`/gtfs/data/edit/shapes/${scenarioId}/bulk-update/`, data);

export const addNewShapeAndApplyToPatterns = (data) =>
    post(`/gtfs/data/edit/shapes/from-trip-patterns/`, data);

// SHAPE GENERATOR (NO DB ACCESS)
export const generateShapeFromStops = (data) =>
    post(`/gtfs/data/generate/shape/from-stops/`, data);

export const generateShapeFromCoordinatesOnly = (data) =>
    post(`/gtfs/data/generate/shape/from-coordinates/`, data);
