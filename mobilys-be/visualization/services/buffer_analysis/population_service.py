import json

from django.contrib.gis.geos import GEOSGeometry

from visualization.models import PopulationMesh


def get_population_within_buffer(isochrone_geojson, max_travel_time):
    """
    Calculate population stats within buffer polygons.

    Parameters:
    - isochrone_geojson (dict): FeatureCollection of buffer polygons.
    - max_travel_time (str|float): Max travel time in minutes.

    Returns:
    - list[dict]: Population stats by age groups.
    """
    results = []
    for feature in sorted(isochrone_geojson.get("features", []), key=lambda f: f["properties"].get("time", 0)):
        geom = GEOSGeometry(json.dumps(feature["geometry"]), srid=4326)
        if not geom.valid:
            geom = geom.buffer(0)
        age_0_14_sum = age_15_64_sum = age_65_up_sum = total_pop = 0
        for pm in PopulationMesh.objects.filter(geom__intersects=geom):
            if geom.contains(pm.geom):
                age_0_14_sum += pm.age_0_14
                age_15_64_sum += pm.age_15_64
                age_65_up_sum += pm.age_65_up
                total_pop += pm.total
            else:
                intersection = pm.geom.intersection(geom)
                if not intersection.empty:
                    ratio = intersection.area / pm.geom.area
                    age_0_14_sum += pm.age_0_14 * ratio
                    age_15_64_sum += pm.age_15_64 * ratio
                    age_65_up_sum += pm.age_65_up * ratio
                    total_pop += pm.total * ratio
        results.append({
            "cutoff_time": max_travel_time,
            "age_0_14": round(age_0_14_sum),
            "age_15_64": round(age_15_64_sum),
            "age_65_up": round(age_65_up_sum),
            "total_population": round(total_pop),
        })
    return results
