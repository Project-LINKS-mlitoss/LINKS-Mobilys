// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import Papa from "papaparse";
import { VISUALIZATION } from "@/strings";

export const LS_RG_PREFIX = "joukou-rg";

export const REQUIRED_FIELDS_JYOUKOU = [
    "date",
    "agency_id",
    "route_id",
    "trip_id",
    "stop_id",
    "stop_sequence",
    "count_geton",
    "count_getoff",
];

export function normalizeHeader(header = "") {
    return String(header)
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase();
}

export function validateHeadersJyoukou(fields = []) {
    const norm = fields.map(normalizeHeader);
    return REQUIRED_FIELDS_JYOUKOU.every((f) => norm.includes(f));
}

export function normalizeGroups(list) {
    return Array.from(
        new Set((list || []).filter(Boolean).map((s) => String(s).trim())),
    );
}

export function inflateRouteGroupData(payload) {
    const data = payload?.data ?? payload ?? {};
    const groups = normalizeGroups(data?.available_route_keywords || []);
    const map = {};
    const keywordTripsMap = {};

    for (const item of data?.keyword_routes || []) {
        const kw = String(item?.keyword || "").trim();
        if (!kw) continue;
        let routes = [];
        if (Array.isArray(item?.routes)) {
            routes = item.routes.map((r) => ({
                route_id: r?.route_id,
                route_name: r?.route_name || r?.route_id,
            }));
            keywordTripsMap[kw] = item.routes.map((r) => ({
                route_id: r?.route_id,
                valid_trip_ids: Array.isArray(r?.valid_trip_ids)
                    ? r.valid_trip_ids
                    : [],
            }));
        } else if (Array.isArray(item?.route_ids)) {
            routes = item.route_ids.map((id) => ({
                route_id: id,
                route_name: id,
            }));
            keywordTripsMap[kw] = item.route_ids.map((id) => ({
                route_id: id,
                valid_trip_ids: [],
            }));
        }
        map[kw] = routes;
    }
    return { groups, map, keywordTripsMap };
}

export async function parseCsvText(text) {
    return await new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => resolve(res.data || []),
            error: reject,
        });
    });
}

export async function parseCsvFile(file) {
    return await new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: normalizeHeader,
            complete: (res) => resolve(res),
            error: (err) => reject(err),
        });
    });
}

export function buildStartEndFromFilter(filter) {
    if (!filter) return { start_time: "", end_time: "" };
    if (Array.isArray(filter.time)) {
        const st = String(filter.time[0]).padStart(2, "0") + ":00:00";
        const et =
            Number(filter.time[1]) === 24
                ? "23:59:59"
                : String(filter.time[1]).padStart(2, "0") + ":00:00";
        return { start_time: st, end_time: et };
    }
    if (filter.time === "all" || !filter.time)
        return { start_time: "", end_time: "" };
    const hh = String(filter.time).padStart(2, "0");
    return { start_time: `${hh}:00:00`, end_time: `${hh}:00:00` };
}

export function createRouteScopeFromFilter(filter) {
    const route_id =
        !filter?.routeId || filter.routeId === VISUALIZATION.common.filters.all
            ? ""
            : String(filter.routeId).trim();

    const route_group =
        !filter?.routeGroup || filter.routeGroup === VISUALIZATION.common.filters.all
            ? ""
            : String(filter.routeGroup).trim();

    const route_groups = route_group ? [route_group] : [];
    return { route_id, route_groups };
}
