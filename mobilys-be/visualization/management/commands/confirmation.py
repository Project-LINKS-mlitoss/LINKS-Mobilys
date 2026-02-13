# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import os

import requests
from django.core.management.base import BaseCommand, CommandError


# This command confirms category codes for population age groups from e-Stat API.
class Command(BaseCommand):
    url = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"

    def handle(self, *args, **options):
        estat_api_key = os.getenv("ESTAT_API_KEY")
        if not estat_api_key:
            raise CommandError("ESTAT_API_KEY is not set.")

        params = {
            "appId": estat_api_key,
            "lang": "J",
            "statsDataId": "8003007464",
            "metaGetFlg": "Y",
            "cntGetFlg": "N",
            "explanationGetFlg": "N",
            "annotationGetFlg": "N",
            "limit": 1,
        }

        response = requests.get(self.url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        class_objs = data["GET_STATS_DATA"]["STATISTICAL_DATA"]["CLASS_INF"]["CLASS_OBJ"]

        for obj in class_objs:
            if obj["@id"] not in ("cat01", "cat02"):
                continue

            classes = obj.get("CLASS", [])
            if isinstance(classes, dict):
                classes = [classes]

            for class_item in classes:
                code = class_item.get("@code")
                label = class_item.get("$") or class_item.get("@name") or ""
                self.stdout.write(f"{obj['@id']}: {code} - {label}")

