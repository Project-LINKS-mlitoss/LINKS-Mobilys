# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from django.contrib.gis.geos import GEOSGeometry
from django.contrib.gis.geos import Polygon
import json
from shapely.geometry import mapping

from visualization.models import PopulationMesh


class PopulationMeshSerializer(serializers.ModelSerializer):
    class Meta:
        model = PopulationMesh
        fields = ["meshcode", "mcode", "age_0_14", "age_15_64", "age_65_up", "total"]

    def to_representation(self, instance):
        """
        Override to emit GeoJSON Feature format
        """
        rep = super().to_representation(instance)

        return {
            "meshcode": rep["meshcode"],
            "mcode": rep["mcode"],
            "age_0_14": rep["age_0_14"],
            "age_15_64": rep["age_15_64"],
            "age_65_up": rep["age_65_up"],
            "total": rep["total"],
            "geometry": json.loads(instance.geom.geojson),
        }
