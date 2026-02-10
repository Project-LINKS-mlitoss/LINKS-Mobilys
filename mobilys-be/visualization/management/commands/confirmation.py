import os
import requests
from pathlib import Path
from django.core.management.base import BaseCommand
#This is for confirming category codes for population age groups from e-Stat API
class Command(BaseCommand):
    url = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"
    params = {
        "appId": "1dbfe83ca140c87b6373a1e8a65b7dcf97fa41be",
        "lang": "J",
        "statsDataId": "8003007464",
        "metaGetFlg": "Y",
        "cntGetFlg": "N",
        "explanationGetFlg": "N",
        "annotationGetFlg": "N",
        "limit": 1,
    }

    r = requests.get(url, params=params)
    j = r.json()

    class_objs = j["GET_STATS_DATA"]["STATISTICAL_DATA"]["CLASS_INF"]["CLASS_OBJ"]

    for obj in class_objs:
        if obj["@id"] not in ("cat01", "cat02"):
            continue

        classes = obj.get("CLASS", [])
        if isinstance(classes, dict):
            classes = [classes]

        for c in classes:
            code = c.get("@code")
            label = c.get("$") or c.get("@name") or ""

