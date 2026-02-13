// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { post, get } from "./middleware";

/**
 * Trigger GTFS validation for a scenario
 * @param {string} scenarioId - UUID of the scenario
 * @returns {Promise} - { message, validation_id, notice_count }
 */
export const postValidation = (scenarioId) => {
    return post(
        "/gtfs/data/validation/",
        {
            scenario_id: scenarioId,
        },
        {}
    );
};

/**
 * Get GTFS validation result for a scenario
 * @param {string} scenarioId - UUID of the scenario
 * @param {object} options - Optional filters
 * @param {string} options.lang - Language for titles ("ja" | "en"), default "ja"
 * @param {string} options.severity - Filter by severity ("ERROR" | "WARNING" | "INFO")
 * @param {string} options.code - Filter by specific notice code
 * @returns {Promise} - { scenario_id, scenario_name, validated_at, validator_version, total_notice_groups, notices }
 */
export const getValidationData = (scenarioId, options = {}) => {
    const params = new URLSearchParams({
        scenario_id: scenarioId,
        lang: options.lang || "ja",
    });

    if (options.severity) {
        params.append("severity", options.severity);
    }

    if (options.code) {
        params.append("code", options.code);
    }

    return get(`/gtfs/data/validation/?${params.toString()}`, {});
};
