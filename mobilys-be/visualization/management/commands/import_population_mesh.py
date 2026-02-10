import requests
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Polygon
from django.conf import settings

from visualization.models import PopulationMesh, MeshLocation


class Command(BaseCommand):
    help = "Import population mesh data from e-Stat API and save with geometry"

    def add_arguments(self, parser):
        parser.add_argument(
            '--prefecture',
            type=str,
            required=True,
            help="Name of the prefecture to fetch population mesh data for"
        )

    def handle(self, *args, **options):
        prefecture = options["prefecture"]
        self.stdout.write(self.style.NOTICE(f"Fetching mesh data for prefecture: {prefecture}"))

        # Load prefecture mesh codes
        mcode_list = (
            MeshLocation.objects
            .filter(prefecture_name=prefecture)
            .values_list("mcode", flat=True)
            .distinct()
        )
        meshcode_list = (
            MeshLocation.objects
            .filter(prefecture_name=prefecture)
            .values_list("meshcode", flat=True)
            .distinct()
        )

        if not mcode_list:
            self.stderr.write(self.style.ERROR(f"No M-mesh codes found for {prefecture}"))
            return

        mcode_set = set(mcode_list)
        meshcode_set = set(meshcode_list)

        # Step 1: Get dataset IDs (statsDataId list)
        list_api = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList"
        list_resp = requests.get(list_api, params={
            "appId": settings.ESTAT_API_KEY,
            "lang": "J",
            "searchKind": 2,
            "surveyYears": "2020",
            "searchWord": "人口及び世帯 AND 500Mメッシュ",
        })
        list_resp.raise_for_status()

        stats_list = (
            list_resp.json()
            .get("GET_STATS_LIST", {})
            .get("DATALIST_INF", {})
            .get("TABLE_INF", [])
        )

        matched_ids = [
            item["@id"] for item in stats_list
            if item.get("TITLE_SPEC", {}).get("TABLE_SUB_CATEGORY2") in mcode_set
        ]

        self.stdout.write(self.style.NOTICE(f"Found {len(matched_ids)} matching dataset IDs"))

        # Step 2: Fetch population data for each dataset ID (PAGINATED)

        for stats_id in matched_ids:
            self.stdout.write(self.style.NOTICE(f"Processing statsDataId={stats_id} ..."))

            try:
                start_pos = 1
                mesh_data = {}  # aggregate across ALL pages for this stats_id

                while True:
                    data_resp = requests.get(settings.ESTAT_API_URL, params={
                        "appId": settings.ESTAT_API_KEY,
                        "lang": "J",
                        "statsDataId": stats_id,
                        "limit": 100000,
                        "startPosition": start_pos,
                    })
                    data_resp.raise_for_status()

                    js = data_resp.json()
                    stat = js.get("GET_STATS_DATA", {}).get("STATISTICAL_DATA", {})
                    result_inf = stat.get("RESULT_INF", {})

                    from_no = result_inf.get("FROM_NUMBER")
                    to_no = result_inf.get("TO_NUMBER")
                    total_no = result_inf.get("TOTAL_NUMBER")
                    next_key = result_inf.get("NEXT_KEY")

                    # Guard: detect if API ignored startPosition (common bug cause)
                    if from_no is not None and int(from_no) != int(start_pos):
                        raise RuntimeError(
                            f"startPosition seems ignored: requested {start_pos} but FROM_NUMBER={from_no}"
                        )

                    rows = stat.get("DATA_INF", {}).get("VALUE", [])
                    self.stdout.write(
                        self.style.NOTICE(
                            f"  Fetched rows {from_no}-{to_no} / total={total_no} "
                            f"(rows_in_response={len(rows)})"
                        )
                    )

                    # Process rows
                    for row in rows:
                        meshcode9 = row.get("@area")
                        if not meshcode9:
                            continue

                        meshcode8 = meshcode9[:8]
                        if meshcode8 not in meshcode_set:
                            continue

                        if meshcode9 not in mesh_data:
                            mesh_data[meshcode9] = {
                                "age_0_14": 0,
                                "age_15_64": 0,
                                "age_65_up": 0,
                            }

                        cat_code = row.get("@cat01")
                        try:
                            val = int(row.get("$", 0))
                        except (TypeError, ValueError):
                            val = 0

                        if cat_code == "0040":
                            mesh_data[meshcode9]["age_0_14"] += val
                        elif cat_code == "0100":
                            mesh_data[meshcode9]["age_15_64"] += val
                        elif cat_code == "0190":
                            mesh_data[meshcode9]["age_65_up"] += val

                    # Pagination stop condition
                    if not next_key:
                        break
                    start_pos = int(next_key)

                # Step 3: Save to DB (after all pages aggregated)
                for meshcode9, data in mesh_data.items():
                    geom = self.meshcode_to_geom(meshcode9)
                    total_population = data["age_0_14"] + data["age_15_64"] + data["age_65_up"]

                    PopulationMesh.objects.update_or_create(
                        meshcode=meshcode9,
                        defaults={
                            "mcode": "M" + meshcode9[0:4],
                            "age_0_14": data["age_0_14"],
                            "age_15_64": data["age_15_64"],
                            "age_65_up": data["age_65_up"],
                            "total": total_population,
                            "geom": geom,
                        }
                    )

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[ERROR] Failed for statsDataId={stats_id}: {e}"))

    def meshcode_to_geom(self, meshcode9):
        """
        Convert a 9-digit Japanese 500m mesh code to a GEOS Polygon.
        """
        p = int(meshcode9)

        # --- First-level mesh (80km) ---
        lat = (p // 10000000) * 2 / 3
        lon = ((p // 100000) % 100) + 100

        # --- Second-level mesh (10km) ---
        lat += ((p // 10000) % 10) * (5 / 60.0)
        lon += ((p // 1000) % 10) * (7.5 / 60.0)

        # --- Third-level mesh (1km) ---
        lat += ((p // 100) % 10) * (30 / 3600.0)
        lon += ((p // 10) % 10) * (45 / 3600.0)

        # --- Last digit (500m quadrant) ---
        lat_size_1km = 30 / 3600.0
        lon_size_1km = 45 / 3600.0
        last = p % 10

        if last == 1:  # SW
            lat -= lat_size_1km / 2
        elif last == 2:  # SE
            lon += lon_size_1km / 2
            lat -= lat_size_1km / 2
        elif last == 3:  # NW
            pass
        elif last == 4:  # NE
            lon += lon_size_1km / 2

        # --- Mesh size (500m) ---
        lat_size = lat_size_1km / 2
        lon_size = lon_size_1km / 2

        return Polygon.from_bbox((lon, lat - lat_size, lon + lon_size, lat))
