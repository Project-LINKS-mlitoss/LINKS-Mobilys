from rest_framework.views import APIView
from rest_framework.response import Response
from gtfs.models import Scenario
from visualization.models import PopulationMesh, MeshLocation
from visualization.serializers.response.population_mesh_serializers import PopulationMeshSerializer
from django.db.models import Q
from django.db.models.functions import Substr

# Import the M-mesh dictionary
from data.prefecture_map import PREFECTURE_MAP, PREFECTURE_NAME_MAP
from visualization.constants.messages import Messages

class PopulationByPrefectureView(APIView):
    def get(self, request, *args, **kwargs):
        scenario_id = request.query_params.get("scenario_id")
        if not scenario_id:
            return Response({"error": Messages.POP_MESH_SCENARIO_ID_REQUIRED_EN}, status=400)

        scenario = Scenario.objects.filter(id=scenario_id).first()
        if not scenario:
            return Response({"error": Messages.POP_MESH_INVALID_SCENARIO_ID_EN}, status=400)

        # Guard: empty or non-iterable prefecture_info (accept list/tuple/set)
        pref_info = scenario.prefecture_info or []
        if not isinstance(pref_info, (list, tuple, set)) or len(pref_info) == 0:
            return Response({"error": Messages.POP_MESH_NO_PREFECTURE_INFO_EN}, status=404)

        # Convert romaji -> kanji; collect unknowns for diagnostics
        kanji_names = []
        unknown_romaji = []
        for romaji in pref_info:
            kanji = PREFECTURE_NAME_MAP.get(romaji)
            if kanji:
                kanji_names.append(kanji)
            else:
                unknown_romaji.append(romaji)

        if not kanji_names:
            return Response(
                {"error": Messages.POP_MESH_PREF_ROMAJI_TO_KANJI_FAILED_EN, "unknown": unknown_romaji},
                status=404,
            )

        # Get ALL 8-digit mesh prefixes for the prefectures (distinct)
        meshcode8_list = list(
            MeshLocation.objects
            .filter(prefecture_name__in=kanji_names)
            .values_list("meshcode", flat=True)
            .distinct()
        )

        if not meshcode8_list:
            return Response(
                {"error": Messages.POP_MESH_NO_MESH_CODES_FOR_PREF_EN, "prefectures": kanji_names},
                status=404,
            )

        # FAST PATH: annotate 8-char prefix once, then do a single IN filter.
        # This avoids building a huge OR tree of startswith() conditions.
        qs = (
            PopulationMesh.objects
            .annotate(prefix8=Substr("meshcode", 1, 8))
            .filter(prefix8__in=meshcode8_list)
        )

        # You can iterate in chunks to reduce memory if it's huge:
        # for obj in qs.iterator(chunk_size=5000): ...

        # Build GeoJSON FeatureCollection
        features = []
        # If you're using DRF serializer, keep it; otherwise, using .values() is faster.
        # I'll keep your serializer for consistency:
        serializer = PopulationMeshSerializer(qs, many=True)
        for item in serializer.data:
            geometry = item.get("geometry")
            if geometry:
                features.append({
                    "type": "Feature",
                    "geometry": geometry,
                    "properties": {
                        "meshcode": item.get("meshcode"),
                        "mcode": item.get("mcode"),
                        "age_0_14": item.get("age_0_14"),
                        "age_15_64": item.get("age_15_64"),
                        "age_65_up": item.get("age_65_up"),
                        "total": item.get("total"),
                    },
                })

        return Response({
            "type": "FeatureCollection",
            "features": features,
        })
