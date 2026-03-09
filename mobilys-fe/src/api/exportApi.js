// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { post } from "./middleware";

/**
 * GTFS Export API
 * @param {string} scenarioId
 * @param {object} params  Export options:
 * - start_date: string (YYYY-MM-DD)
 * - end_date: string (YYYY-MM-DD)
 * - files: string[]
 * @param {object} config
 * @returns {Promise<Blob>}
 */

export const postGTFSExportApi = (scenarioId, params, config = {}) => {
    return post(
        `/gtfs/data/import/${scenarioId}/export_gtfs/`,
        params,
        {
            responseType: "blob",
            ...config,
        }
    );
};