from ..models import Stops, Scenario, StopIdKeyword, StopIdKeywordMap, StopNameKeywords, StopNameKeywordMap
from django.db import transaction
from .stop_data_utils import StopDataUtils
from collections import defaultdict


class StopDataStandardizer:
    @staticmethod
    def process_grouping_stop_id_data(scenario_id):
        scenario = Scenario.objects.get(id=scenario_id)


        # Step 1: get all stops for the scenario
        stops = list(Stops.objects.filter(scenario=scenario).values("id", "stop_id", "stop_name"))

        # Step 2: extract prefixes and map to first stop_name
        prefix_to_first_stop_name = {}
        stop_id_to_prefix = {}
        for s in stops:
            stop_id = s["stop_id"]
            stop_name = s.get("stop_name")
            if stop_id and "_" in stop_id:
                prefix = stop_id.split("_")[0]
                stop_id_to_prefix[stop_id] = prefix
                if prefix not in prefix_to_first_stop_name and stop_name:
                    prefix_to_first_stop_name[prefix] = stop_name

        # Step 3: Create StopIdKeyword entries (1 per prefix)
        # Optional: delete old data for this scenario
        StopIdKeyword.objects.filter(scenario=scenario).delete()

        keyword_objs = [
            StopIdKeyword(
                stop_id_keyword=prefix,
                scenario=scenario,
                stop_group_name_label=prefix_to_first_stop_name.get(prefix, "")
            )
            for prefix in sorted(prefix_to_first_stop_name.keys())
        ]
        stop_id_keywords = StopIdKeyword.objects.bulk_create(keyword_objs)

        # Mapping prefix → keyword instance
        prefix_to_keyword = {
            k.stop_id_keyword: k for k in stop_id_keywords
        }
            

        # Step 4: Create StopIdKeywordMap
        # Optional: delete old data for this scenario
        StopIdKeywordMap.objects.filter(scenario=scenario).delete()

        map_objs = []
        for s in stops:
            stop_id = s["stop_id"]

            prefix = stop_id_to_prefix.get(stop_id)
            if prefix and prefix in prefix_to_keyword:
                keyword = prefix_to_keyword[prefix]
                map_objs.append(StopIdKeywordMap(
                    stop_id=stop_id,
                    stop_id_group_id=keyword.stop_group_id,
                    scenario=scenario
                ))

        StopIdKeywordMap.objects.bulk_create(map_objs)

        StopDataStandardizer.bulk_update_stop_id_centroids(scenario)



    @staticmethod
    def process_grouping_stop_id_data_edit(scenario_id):
        scenario = Scenario.objects.get(id=scenario_id)

        # Exclude stops that cannot be automatically updated
        stop_ids_exclude = StopIdKeywordMap.objects.filter(
            scenario=scenario, can_automatically_update=False
        ).values_list("stop_id", flat=True)
        stop_keywords_exclude = StopIdKeywordMap.objects.filter(
            scenario=scenario, can_automatically_update=False
        )
        stop_keyword_ids_exclude = set(stop_keywords_exclude.values_list("stop_id_group_id", flat=True))
        stop_keywords_exclude_prefixes = set(
            StopIdKeyword.objects.filter(stop_group_id__in=stop_keyword_ids_exclude).values_list("stop_id_keyword", flat=True)
        )

        # Step 1: get all stops for the scenario excluding those in StopIdKeywordMap with can_automatically_update=False
        stops = Stops.objects.filter(scenario=scenario).exclude(stop_id__in=stop_ids_exclude).values("stop_id")
        prefix_set = set()
        stop_id_to_prefix = {}

        for s in stops:
            stop_id = s["stop_id"]
            if stop_id and "_" in stop_id:
                prefix = stop_id.split("_")[0]
                if prefix not in stop_keywords_exclude_prefixes:
                    stop_id_to_prefix[stop_id] = prefix
                    prefix_set.add(prefix)

        # Step 2: Create StopIdKeyword entries (1 per prefix)
        # Only delete keywords that can be automatically updated
        StopIdKeyword.objects.filter(scenario=scenario).exclude(stop_group_id__in=stop_keyword_ids_exclude).delete()

        keyword_objs = [
            StopIdKeyword(stop_id_keyword=prefix, scenario=scenario)
            for prefix in sorted(prefix_set)
        ]
        stop_id_keywords = StopIdKeyword.objects.bulk_create(keyword_objs)

        # Mapping prefix → keyword instance
        prefix_to_keyword = {
            k.stop_id_keyword: k for k in stop_id_keywords
        }

        # Step 3: Create StopIdKeywordMap
        # Only delete mappings that can be automatically updated
        StopIdKeywordMap.objects.filter(scenario=scenario, can_automatically_update=True).delete()

        map_objs = []
        for s in stops:
            stop_id = s["stop_id"]
            prefix = stop_id_to_prefix.get(stop_id)
            if prefix and prefix in prefix_to_keyword:
                keyword = prefix_to_keyword[prefix]
                map_objs.append(StopIdKeywordMap(
                    stop_id=stop_id,
                    stop_id_group_id=keyword.stop_group_id,
                    scenario=scenario
                ))

        StopIdKeywordMap.objects.bulk_create(map_objs)

        StopDataStandardizer.bulk_update_stop_id_centroids(scenario)



    @staticmethod
    def bulk_update_stop_name_centroids(scenario):
        maps = list(
            StopNameKeywordMap.objects
            .filter(scenario=scenario)
            .values_list("stop_name_group_id", "stop_id")
        )
        if not maps:
            return

        coords_qs = (
            Stops.objects
            .filter(scenario=scenario, stop_lat__isnull=False, stop_lon__isnull=False)
            .exclude(stop_lat=0, stop_lon=0)
            .values_list("stop_id", "stop_lat", "stop_lon")
        )
        stop_coords = {sid: (lat, lon) for sid, lat, lon in coords_qs}

        acc = defaultdict(lambda: [0.0, 0.0, 0])  # sum_lat, sum_lon, cnt
        for raw_gid, stop_id in maps:
            try:
                gid = int(raw_gid)
            except (TypeError, ValueError):
                continue

            coord = stop_coords.get(stop_id)
            if not coord:
                continue
            lat, lon = coord
            a = acc[gid]
            a[0] += float(lat)
            a[1] += float(lon)
            a[2] += 1

        if not acc:
            return

        group_ids = list(acc.keys())
        kws = list(
            StopNameKeywords.objects.filter(
                scenario=scenario,
                stop_group_id__in=group_ids
            )
        )
        by_id = {kw.stop_group_id: kw for kw in kws}

        to_update = []
        for gid, (sum_lat, sum_lon, cnt) in acc.items():
            if cnt <= 0:
                continue
            kw = by_id.get(gid)  
            if not kw:
                continue
            kw.stop_names_lat = sum_lat / cnt
            kw.stop_names_long = sum_lon / cnt
            to_update.append(kw)

        if to_update:
            StopNameKeywords.objects.bulk_update(
                to_update,
                ["stop_names_lat", "stop_names_long"],
                batch_size=5000
            )
            
    @staticmethod
    def process_grouping_stop_name_data(scenario_id):

        scenario = Scenario.objects.get(id=scenario_id)  

        # Step 1: get all stops for the scenario
        stops = Stops.objects.filter(scenario=scenario).values("stop_id", "stop_name")
        stop_name_set = set(s["stop_name"] for s in stops if s["stop_name"])

        # Step 2: Create entries in StopNameKeywords
        # Optional: delete old data for this scenario
        StopNameKeywords.objects.filter(scenario=scenario).delete()


        keyword_objs = []
        for idx, stop_name in enumerate(sorted(stop_name_set)):
            label = f"SG{idx+1:05d}"
            keyword_objs.append(StopNameKeywords(
                stop_name_keyword=stop_name,
                scenario=scenario,
                stop_group_id_label=label
            ))

        stop_name_keywords = StopNameKeywords.objects.bulk_create(keyword_objs)

        # Get the results for mapping
        keyword_lookup = {
            kw.stop_name_keyword: kw
            for kw in stop_name_keywords
        }
            

        # Step 3: Create StopNameKeywordMap for each stop
        # Optional: delete old data for this scenario
        StopNameKeywordMap.objects.filter(scenario=scenario).delete()

        mapping_objs = []
        for s in stops:
            stop_id = s["stop_id"]
            stop_name = s["stop_name"]
            if stop_name in keyword_lookup:
                keyword = keyword_lookup[stop_name]
                stops = Stops.objects.get(scenario=scenario, stop_id=stop_id)
                mapping_objs.append(StopNameKeywordMap(
                    stop_id=stops.stop_id,
                    stop_name_group_id=keyword.stop_group_id,
                    scenario=scenario
                ))

        StopNameKeywordMap.objects.bulk_create(mapping_objs)

        StopDataStandardizer.bulk_update_stop_name_centroids(scenario)


    @staticmethod
    def bulk_update_stop_id_centroids(scenario):
        maps = list(
            StopIdKeywordMap.objects
            .filter(scenario=scenario)
            .values_list("stop_id_group_id", "stop_id")
        )
        if not maps:
            return

        coords_qs = Stops.objects.filter(scenario=scenario)\
                        .values_list("stop_id", "stop_lat", "stop_lon")
        stop_coords = {sid: (lat, lon) for sid, lat, lon in coords_qs}

        acc = defaultdict(lambda: [0.0, 0.0, 0])
        for group_id, stop_id in maps:
            coord = stop_coords.get(stop_id)
            if not coord:
                continue
            lat, lon = coord
            if lat is None or lon is None:
                continue
            a = acc[group_id]
            a[0] += float(lat)
            a[1] += float(lon)
            a[2] += 1

        if not acc:
            return

        kws = list(
            StopIdKeyword.objects.filter(
                scenario=scenario,
                stop_group_id__in=acc.keys()
            )
        )
        by_id = {kw.stop_group_id: kw for kw in kws}

        to_update = []
        for gid, (sum_lat, sum_lon, cnt) in acc.items():
            kw = by_id.get(gid)
            if kw and cnt:
                kw.stop_id_lat = sum_lat / cnt
                kw.stop_id_long = sum_lon / cnt
                to_update.append(kw)

        if to_update:
            StopIdKeyword.objects.bulk_update(
                to_update,
                ["stop_id_lat", "stop_id_long"],
                batch_size=5000
            )

    @staticmethod
    def process_grouping_stop_name_data_edit(scenario_id):

        scenario = Scenario.objects.get(id=scenario_id)  

        stop_ids_exclude = StopNameKeywordMap.objects.filter(scenario=scenario, can_automatically_update=False).values_list("stop_id", flat=True)
        stop_keywords_exclude = StopNameKeywordMap.objects.filter(scenario=scenario, can_automatically_update=False)
        stop_keyword_ids_exclude = set(stop_keywords_exclude.values_list("stop_name_group_id", flat=True))
        stop_keywords_exclude_names = set(stop_keywords_exclude.values_list("stop_name", flat=True))

        # Step 1: get all stops for the scenario excluding those in StopIdKeywordMap with can_automatically_update=False
        stops = Stops.objects.filter(scenario=scenario).exclude(stop_id__in=stop_ids_exclude).values("stop_id", "stop_name")
        stop_name_set = set(
            s["stop_name"]
            for s in stops
            if s["stop_name"] and s["stop_name"] not in stop_keywords_exclude_names
        )

        # Step 2: Create entries in StopNameKeywords
        # Optional: delete old data for this scenario
        StopNameKeywords.objects.filter(scenario=scenario).exclude(stop_name_group_id__in=stop_keyword_ids_exclude).delete()

        keyword_objs = []
        for stop_name in sorted(stop_name_set):  # sort to keep IDs consistent
            keyword_objs.append(StopNameKeywords(
                stop_name_keyword=stop_name,
                scenario=scenario
            ))

        stop_name_keywords = StopNameKeywords.objects.bulk_create(keyword_objs)

        # Get the results for mapping
        keyword_lookup = {
            kw.stop_name_keyword: kw
            for kw in stop_name_keywords
        }
            

        # Step 3: Create StopNameKeywordMap for each stop
        # Optional: delete old data for this scenario that can be automatically updated
        # This will remove any existing mappings that can be automatically updated
        StopNameKeywordMap.objects.filter(scenario=scenario, can_automatically_update=True).delete()

        mapping_objs = []
        for s in stops:
            stop_id = s["stop_id"]
            stop_name = s["stop_name"]
            if stop_name in keyword_lookup:
                keyword = keyword_lookup[stop_name]
                stops = Stops.objects.get(scenario=scenario, stop_id=stop_id)
                mapping_objs.append(StopNameKeywordMap(
                    stop_id=stops.stop_id,
                    stop_name_group_id=keyword.stop_group_id,
                    scenario=scenario
                ))

        StopNameKeywordMap.objects.bulk_create(mapping_objs)

        StopDataStandardizer.bulk_update_stop_name_centroids(scenario)
