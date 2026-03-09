# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.db import connection
from gtfs.models import Stops, Trips, StopTimes, Scenario


class StopDataUtils:

    @staticmethod
    def generateCenterLatLonByStopsData(stops_data, scenario_id):
        """
        Generate center latitude and longitude from a list of stop data using PostGIS centroid.
        """
        if not stops_data:
            return None, None

        stop_ids = [stop.get('stop_id') for stop in stops_data if stop.get('stop_id')]
        if not stop_ids:
            return None, None

        # Query centroid using PostGIS
        sql = """
            SELECT 
                ST_Y(ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)))) AS centroid_lat,
                ST_X(ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)))) AS centroid_lon
            FROM stops
            WHERE stop_id IN %s AND scenario_id = %s
        """

        with connection.cursor() as cursor:
            cursor.execute(sql, [tuple(stop_ids), scenario_id])
            row = cursor.fetchone()
            if row and row[0] is not None and row[1] is not None:
                return float(row[0]), float(row[1])
            else:
                return None, None