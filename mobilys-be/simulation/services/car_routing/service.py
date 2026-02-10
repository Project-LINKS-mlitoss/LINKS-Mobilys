from collections import defaultdict
from typing import Dict, List, Tuple
from django.db import connection
from django.db.models import Prefetch
from gtfs.models import Routes, Trips, StopTimes, Stops, RouteKeywordMap
from gtfs.utils.trip_data_utils import TripDataUtils
from gtfs.utils.route_data_utils import RouteDataUtils
from simulation.models import (
    Simulation,
    SimulationInput,
    CarRouting,
    CarRoutingSegment,
    DrmLinks,
)
from simulation.services.base import log_service_call
from simulation.utils.number import to_float_or_none
from simulation.constants.colors import ColorConstants

def _pattern_lookup_for_simulation(
    sim: Simulation,
    keys: List[Tuple[str, str, int, str]],
) -> Dict[Tuple[str, str, int, str], str]:
    sim_in = SimulationInput.objects.filter(simulation=sim).first()
    default_service_id = getattr(sim_in, "service_id", None)

    normalized: List[Tuple[str, str, int, str]] = []
    for rid, sid, did, svc in keys:
        rid = rid or ""
        sid = sid or ""
        did = int(did or 0)
        svc = svc or default_service_id or ""
        if rid and sid:
            normalized.append((rid, sid, did, svc))

    if not normalized:
        return {}

    scenario_id = sim.original_scenario_id or sim.scenario_id
    if not scenario_id:
        return {}

    routes_qs = Routes.objects.filter(scenario_id=scenario_id)
    trips_qs = Trips.objects.filter(scenario_id=scenario_id)
    st_qs = StopTimes.objects.filter(scenario_id=scenario_id)
    stop_ids = list(st_qs.values_list("stop_id", flat=True).distinct())
    stops_qs = Stops.objects.filter(stop_id__in=stop_ids)

    patterns = TripDataUtils.build_route_patterns_structure(
        routes=list(routes_qs),
        trips=list(trips_qs),
        stop_times=list(st_qs),
        stops=list(stops_qs),
    )

    lut: Dict[Tuple[str, str, int, str], str] = {}
    for r in patterns:
        rid = r.get("route_id")
        for p in (r.get("route_patterns") or []):
            sid = p.get("shape_id")
            did = int(p.get("direction_id") or 0)
            pid = p.get("pattern_id")
            svc = p.get("service_id") or default_service_id or ""
            if rid and sid and pid is not None:
                lut[(rid, sid, did, svc)] = pid

    for rid, sid, did, svc in normalized:
        key = (rid, sid, did, svc)
        if key not in lut:
            lut[key] = RouteDataUtils.make_pattern_id(rid, sid, did, svc)

    return lut

def _color_and_name(route_id: str, route_id_color_map: Dict[str, str]):
    return {
        "route_name": route_id,
        "route_keyword_color": "#" + route_id_color_map.get(route_id, ColorConstants.DEFAULT_COLOR),
    }

def _gtfs_shapes_map(scenario_id: str, shape_ids: List[str]) -> Dict[str, dict]:
    out = {}
    if not scenario_id or not shape_ids:
        return out
    shape_ids = sorted({s for s in shape_ids if s})

    with connection.cursor() as cur:
        cur.execute(
            """
            WITH pts AS (
              SELECT shape_id,
                     shape_pt_lon AS lon,
                     shape_pt_lat AS lat,
                     shape_pt_sequence AS seq
              FROM shapes
              WHERE scenario_id = %s
                AND shape_id = ANY(%s)
            ),
            lines AS (
              SELECT shape_id,
                     ST_MakeLine(ST_SetSRID(ST_Point(lon,lat),4326) ORDER BY seq) AS geom
              FROM pts
              GROUP BY shape_id
            )
            SELECT shape_id, ST_AsGeoJSON(geom, 6)::json AS gj
            FROM lines;
            """,
            [scenario_id, shape_ids],
        )
        for sid, gj in cur.fetchall():
            out[str(sid)] = {
                "type": "Feature",
                "geometry": gj,
                "properties": {"shape_id": str(sid)},
            }
    return out

class CarRoutingService:
    @staticmethod
    @log_service_call
    def get_routes_detail(sim: Simulation) -> tuple[dict, bool]:
        sim_input = SimulationInput.objects.filter(simulation=sim).first()
        default_service_id = getattr(sim_input, "service_id", None)

        cr_qs = CarRouting.objects.filter(simulation=sim).order_by("route_id", "shape_id")
        if not cr_qs.exists():
            return {"routes": []}, False

        seg_qs = CarRoutingSegment.objects.filter(car_routing__simulation=sim).order_by("car_routing_id", "seq")
        cr_qs = cr_qs.prefetch_related(Prefetch("segments", queryset=seg_qs))

        if not cr_qs.exists():
            return {"routes": []}, False

        keys = []
        for cr in cr_qs:
            did = int(getattr(cr, "direction_id", 0) or 0)
            svc = cr.service_id or default_service_id or ""
            keys.append((cr.route_id, cr.shape_id, did, svc))

        lut = _pattern_lookup_for_simulation(sim, keys)

        scenario_id = sim.original_scenario_id or sim.scenario_id

        route_id_color_map = {}
        mappings = (
            RouteKeywordMap.objects
            .filter(scenario_id=scenario_id)
            .select_related("keyword")
            .order_by("-keyword__updated_datetime", "-keyword__created_datetime")
            .values("route_id", "keyword__keyword_color")
        )
        for m in mappings:
            rid = m.get("route_id")
            color = m.get("keyword__keyword_color")
            if rid and color and rid not in route_id_color_map:
                route_id_color_map[rid] = color

        shape_ids = list(cr_qs.values_list("shape_id", flat=True).distinct())
        shape_map = _gtfs_shapes_map(scenario_id, shape_ids)

        out_routes = []
        by_route: Dict[str, List[CarRouting]] = defaultdict(list)
        for cr in cr_qs:
            by_route[cr.route_id].append(cr)

        service_ids_used = sorted({(cr.service_id or default_service_id or "").strip()
                                   for cr in cr_qs if (cr.service_id or default_service_id)})

        for rid, items in by_route.items():
            meta = _color_and_name(rid, route_id_color_map)
            patterns = []
            for cr in items:
                did = int(getattr(cr, "direction_id", 0) or 0)
                svc = cr.service_id or default_service_id or ""
                pid = lut.get((cr.route_id, cr.shape_id, did, svc)) \
                      or RouteDataUtils.make_pattern_id(cr.route_id, cr.shape_id, did, svc)

                segs = list(cr.segments.all())
                distance_km = sum((to_float_or_none(s.length_m) or 0.0) for s in segs) / 1000.0
                est_time_min = sum((to_float_or_none(s.cost_min) or 0.0) for s in segs)
                summary = {
                    "distance_km": round(distance_km, 3),
                    "est_time_min": round(est_time_min, 2),
                    "edges": len(segs),
                }

                patterns.append({
                    "pattern_id": pid,
                    "shape_id": cr.shape_id,
                    "direction_id": did,
                    "service_id": svc,
                    "gtfs_shape": shape_map.get(cr.shape_id),
                    "start": {"lon": to_float_or_none(cr.start_lon), "lat": to_float_or_none(cr.start_lat)},
                    "end": {"lon": to_float_or_none(cr.end_lon), "lat": to_float_or_none(cr.end_lat)},
                    "car_path": {
                        "summary": summary,
                        "segments": [
                            {
                                "seq": s.seq,
                                "link_id": s.link_id,
                                "section_id": s.section_id,
                                "road_name": s.road_name,
                                "length_m": s.length_m,
                                "lanes": s.lanes,
                                "speed_up_kmh": to_float_or_none(s.speed_up_kmh),
                                "speed_dn_kmh": to_float_or_none(s.speed_dn_kmh),
                                "cost_min": to_float_or_none(s.cost_min),
                                "geometry": s.geometry,
                            } for s in segs
                        ],
                    },
                })

            out_routes.append({
                "route_id": rid,
                "route_name": meta["route_name"],
                "route_keyword_color": meta["route_keyword_color"],
                "route_patterns": patterns,
            })

        payload = {
            "simulation_id": sim.id,
            "scenario_id": scenario_id,
            "service_ids": service_ids_used,
            "routes": out_routes,
        }
        return payload, True

    @staticmethod
    @log_service_call
    def get_car_volume(sim: Simulation) -> tuple[dict, bool]:
        sim_input = SimulationInput.objects.filter(simulation=sim).first()
        default_service_id = getattr(sim_input, "service_id", None)

        cr_qs = CarRouting.objects.filter(simulation=sim).order_by(
            "route_id", "shape_id", "delta_demand_persons_day", "car_share"
        )
        seg_qs = CarRoutingSegment.objects.filter(car_routing__simulation=sim).order_by("car_routing_id", "seq")
        cr_qs = cr_qs.prefetch_related(Prefetch("segments", queryset=seg_qs))

        if not cr_qs.exists():
            return {"car_change_number": 0.0, "routes": []}, False

        keys = []
        for cr in cr_qs:
            did = int(getattr(cr, "direction_id", 0) or 0)
            svc = cr.service_id or default_service_id or ""
            keys.append((cr.route_id, cr.shape_id, did, svc))
        lut = _pattern_lookup_for_simulation(sim, keys)

        service_ids_used = sorted({(cr.service_id or default_service_id or "").strip()
                                   for cr in cr_qs if (cr.service_id or default_service_id)})

        link_ids = list(
            CarRoutingSegment.objects
            .filter(car_routing__simulation=sim)
            .values_list("link_id", flat=True)
            .distinct()
        )
        drm_map = {}
        if link_ids:
            for d in DrmLinks.objects.filter(id__in=link_ids).values(
                "id", "matchcode_shp", "section_code_csv", "road_name", "length_m", "lanes",
                "updown_cd", "speed_code", "access_cd", "toll_cd", "motor_only_cd",
                "travel_speed_model_kmh", "speed_up_kmh", "speed_dn_kmh",
                "vol_up_24h", "vol_dn_24h", "traffic24_total",
                "vol_up_12h", "vol_dn_12h", "traffic12_total",
                "signal_density_per_km", "congestion_index"
            ):
                drm_map[d["id"]] = d

        delta_by_route = {}
        for cr in cr_qs:
            if cr.route_id not in delta_by_route:
                d = to_float_or_none(cr.delta_demand_persons_day) or 0.0
                delta_by_route[cr.route_id] = d
            else:
                d = to_float_or_none(cr.delta_demand_persons_day) or 0.0
                delta_by_route[cr.route_id] += d
        car_change_number = sum(delta_by_route.values())

        scenario_id = sim.original_scenario_id or sim.scenario_id

        route_id_color_map = {}
        mappings = (
            RouteKeywordMap.objects
            .filter(scenario_id=scenario_id)
            .select_related("keyword")
            .order_by("-keyword__updated_datetime", "-keyword__created_datetime")
            .values("route_id", "keyword__keyword_color")
        )
        for m in mappings:
            rid = m.get("route_id")
            color = m.get("keyword__keyword_color")
            if rid and color and rid not in route_id_color_map:
                route_id_color_map[rid] = color

        out_routes = []
        by_route: Dict[str, List[CarRouting]] = defaultdict(list)
        for cr in cr_qs:
            by_route[cr.route_id].append(cr)

        for rid, items in by_route.items():
            meta = _color_and_name(rid, route_id_color_map)
            patterns = []
            for cr in items:
                need = cr.delta_demand_persons_day
                did = int(getattr(cr, "direction_id", 0) or 0)
                svc = cr.service_id or default_service_id or ""
                pid = lut.get((cr.route_id, cr.shape_id, did, svc)) \
                      or RouteDataUtils.make_pattern_id(cr.route_id, cr.shape_id, did, svc)

                seg_rows = []
                for s in cr.segments.all():
                    d = drm_map.get(s.link_id, {})
                    before = to_float_or_none(s.baseline_cars_per_day) or 0.0
                    after = to_float_or_none(s.after_cars_per_day) or before
                    Lm = d.get("length_m", s.length_m or 0) or 0
                    Lkm = (Lm or 0) / 1000.0
                    seg_rows.append({
                        "matchcode_shp": d.get("matchcode_shp"),
                        "section_code_csv": d.get("section_code_csv"),
                        "road_name": d.get("road_name") or s.road_name,
                        "length_m": Lm,
                        "lanes": d.get("lanes", s.lanes),
                        "updown_cd": d.get("updown_cd"),
                        "speed_code": d.get("speed_code"),
                        "access_cd": d.get("access_cd"),
                        "toll_cd": d.get("toll_cd"),
                        "motor_only_cd": d.get("motor_only_cd"),
                        "travel_speed_model_kmh": d.get("travel_speed_model_kmh"),
                        "speed_up_kmh": d.get("speed_up_kmh", to_float_or_none(s.speed_up_kmh)),
                        "speed_dn_kmh": d.get("speed_dn_kmh", to_float_or_none(s.speed_dn_kmh)),
                        "vol_up_24h": d.get("vol_up_24h"),
                        "vol_dn_24h": d.get("vol_dn_24h"),
                        "traffic24_total": d.get("traffic24_total"),
                        "vol_up_12h": d.get("vol_up_12h"),
                        "vol_dn_12h": d.get("vol_dn_12h"),
                        "traffic12_total": d.get("traffic12_total"),
                        "signal_density_per_km": d.get("signal_density_per_km"),
                        "congestion_index": d.get("congestion_index"),
                        "before_cars_per_day": before,
                        "after_cars_per_day": after,
                        "before_vehicle_km_per_day": before * Lkm,
                        "after_vehicle_km_per_day": after * Lkm,
                    })

                patterns.append({
                    "pattern_id": pid,
                    "shape_id": cr.shape_id,
                    "direction_id": did,
                    "service_id": svc,
                    "segments": seg_rows,
                    "need_cars_per_day": need,
                })

            out_routes.append({
                "route_id": rid,
                "route_name": meta["route_name"],
                "route_keyword_color": meta["route_keyword_color"],
                "route_patterns": patterns,
                "car_change": round(delta_by_route.get(rid, 0), 2) * -1,
            })

        payload = {
            "simulation_id": sim.id,
            "services_ids": service_ids_used,
            "car_change_number": car_change_number,
            "routes": out_routes,
        }
        return payload, True


