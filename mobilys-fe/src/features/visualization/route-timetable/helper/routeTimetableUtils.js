// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
const ensureArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

export function toServiceId(service) {
  if (!service) return "";
  if (typeof service === "string") return service;
  return service.value || service.id || service.label || service.service_id || "";
}

export function toRouteGroupId(group) {
  return group?.route_group_id || group?.id || group?.value || "";
}

export function normalizeChildStopDetail(raw) {
  if (!raw) return null;
  const stop_id = String(raw.stop_id ?? raw.id ?? "");
  const stop_name = String(raw.stop_name ?? raw.name ?? "");
  const route_groups = ensureArray(raw.route_groups).map((g) => ({
    route_group_id: g.route_group_id ?? g.id ?? "",
    route_group_name: g.route_group_name ?? g.name ?? "",
    routes: ensureArray(g.routes).map((r) => ({
      route_id: r.route_id ?? r.id ?? "",
      route_short_name: r.route_short_name ?? "",
      route_long_name: r.route_long_name ?? "",
      route_type: r.route_type,
      agency_id: r.agency_id ?? "",
      route_patterns: ensureArray(r.route_patterns).map((p) => ({
        pattern_id: p.pattern_id ?? "",
        route_id: p.route_id ?? r.route_id ?? "",
        shape_id: p.shape_id ?? "",
        direction_id: Number(p.direction_id ?? 0),
        service_id: String(p.service_id ?? ""),
        segment: p.segment ?? "",
        trips: ensureArray(p.trips).map((t) => ({
          trip_id: String(t.trip_id ?? ""),
          departure_time: String(t.departure_time ?? ""),
          direction_id: Number(t.direction_id ?? p.direction_id ?? 0),
          service_id: String(t.service_id ?? p.service_id ?? ""),
        })),
        trip_count: Number.isFinite(p.trip_count) ? p.trip_count : ensureArray(p.trips).length,
      })),
    })),
  }));
  return { stop_id, stop_name, route_groups };
}

export function normalizeParentStopDetail(raw) {
  if (!raw) return null;
  return {
    stop_group_name: String(raw.stop_group_name ?? raw.parent_stop_name ?? ""),
    stops: ensureArray(raw.stops).map(normalizeChildStopDetail),
  };
}

