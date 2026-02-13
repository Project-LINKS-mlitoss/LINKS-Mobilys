// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { postValidation, getValidationData } from "../api/gtfsValidatorApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

const SEVERITY_ORDER = ["ERROR", "WARNING", "INFO"];

export function getSeverityMeta(severity) {
    const upper = (severity || "").toUpperCase();

    switch (upper) {
        case "ERROR":
            return { label: "エラー", icon: "🔴", color: "error" };
        case "WARNING":
            return { label: "警告", icon: "🟠", color: "warning" };
        case "INFO":
        default:
            return { label: "情報", icon: "⚪", color: "default" };
    }
}

/**
 * Normalize raw validation response from backend into UI-friendly shape.
 * - Ensures notices array always exists.
 * - Calculates severity counts and total notices.
 * - Adds sampleFields for dynamic table headers.
 * - Sorts notices by severity and code.
 */
export function normalizeValidationReport(raw) {
    if (!raw) return null;

    const notices = Array.isArray(raw.notices) ? raw.notices : [];

    const severityCounts = {
        ERROR: 0,
        WARNING: 0,
        INFO: 0,
    };

    let totalNotices = 0;

    const enhancedNotices = notices.map((n) => {
        const severity = (n.severity || "INFO").toUpperCase();
        const count = Number(n.totalNotices || 0);

        if (severityCounts[severity] != null) {
            severityCounts[severity] += count;
        }

        totalNotices += count;

        const rawSamples = Array.isArray(n.sampleNotices)
            ? n.sampleNotices
            : [];
        const samples = rawSamples.slice(0, 50); // limit to 50 rows per notice

        // Collect unique sample fields across all sampleNotices for this notice code
        const fieldSet = new Set();
        samples.forEach((s) => {
            Object.keys(s || {}).forEach((k) => fieldSet.add(k));
        });

        const sampleFields = Array.from(fieldSet);

        return {
            ...n,
            severity,
            totalNotices: count,
            sampleNotices: samples,
            sampleFields,
        };
    });

    // Sort notices by severity (ERROR first) then by code
    enhancedNotices.sort((a, b) => {
        const sA = SEVERITY_ORDER.indexOf(a.severity);
        const sB = SEVERITY_ORDER.indexOf(b.severity);
        if (sA !== sB) return sA - sB;
        return (a.code || "").localeCompare(b.code || "");
    });

    return {
        ...raw,
        notices: enhancedNotices,
        severityCounts,
        totalNotices,
    };
}

/**
 * Trigger GTFS validation for a scenario.
 * Thin wrapper around API, but keeps feature layer clean
 * so feature knows nothing about middleware/post/etc.
 */
export async function triggerGtfsValidation(scenarioId) {
    if (!scenarioId) {
        throw new ApiError(ERROR_MESSAGES.gtfs.validationRun, {
            errorCode: "NO_SCENARIO",
        });
    }

    // This returns whatever your backend returns:
    // { message, validation_id, notice_count }
    try {
        const res = await postValidation(scenarioId);
        return res?.data ?? res;
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.gtfs.validationRun);
    }
}

/**
 * Fetch validation data and return normalized result for UI.
 * Feature/component should just call this function.
 *
 * @param {string} scenarioId
 * @param {object} options - same as getValidationData options
 * @returns {Promise<NormalizedReport|null>}
 */
export async function fetchNormalizedValidationReport(
    scenarioId,
    options = {}
) {
    if (!scenarioId) {
        throw new ApiError(ERROR_MESSAGES.fetch.gtfsValidationReport, {
            errorCode: "NO_SCENARIO",
        });
    }

    let raw;
    try {
        raw = await getValidationData(scenarioId, options);
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.gtfsValidationReport);
    }

    // Normalize to UI-friendly shape
    return normalizeValidationReport(raw.data);
}
