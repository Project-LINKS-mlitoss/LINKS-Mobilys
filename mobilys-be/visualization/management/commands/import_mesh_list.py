import csv
from pathlib import Path
from django.core.management.base import BaseCommand
from visualization.models import MeshLocation
from data.prefecture_map import PREFECTURE_MAP

CSV_DIR = Path("data/mesh_lists")

class Command(BaseCommand):
    help = "Import full 9-digit meshcode + M-mesh code to prefecture/city mapping"

    def add_arguments(self, parser):
        parser.add_argument(
            '--prefecture',
            type=str,
            required=True,
            help="Name of the prefecture to import (e.g., 富山県)"
        )

    def handle(self, *args, **options):
        target_prefecture = options["prefecture"]
        total = 0

        files = list(CSV_DIR.glob("*.csv"))
        matched = False

        for file in files:
            pref_code = file.stem.zfill(2)
            prefecture_name = PREFECTURE_MAP.get(pref_code, "不明")

            if prefecture_name != target_prefecture:
                continue  # skip unrelated prefectures

            matched = True
            self.stdout.write(self.style.NOTICE(f"[IMPORTING] {file.name} as {prefecture_name}"))

            with open(file, encoding="cp932", errors="ignore") as f:
                reader = csv.DictReader(f)
                self.stdout.write(self.style.NOTICE(f"[HEADERS] {reader.fieldnames}"))

                for row in reader:
                    try:
                        # Full 9-digit meshcode (used as unique)
                        full_meshcode = row["基準メッシュ・コード"].strip()
                        # 4-digit M-mesh code for grouping
                        mcode = "M" + full_meshcode[0:4]

                        city_name = row["市区町村名"].strip()
                        city_code = row["都道府県市区町村コード"].strip()

                        MeshLocation.objects.update_or_create(
                            meshcode=full_meshcode,   # unique 9-digit meshcode
                            defaults={
                                "mcode": mcode,  # Save the M-mesh code in its own column
                                "prefecture_name": prefecture_name,
                                "city_name": city_name,
                                "city_code": city_code,
                            },
                        )
                        total += 1
                    except Exception as e:
                        self.stderr.write(self.style.ERROR(f"[ERROR] {file.name} row failed: {e}"))

        if not matched:
            self.stdout.write(self.style.WARNING(f"[WARNING] No file matched for prefecture: {target_prefecture}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"[DONE] Imported {total} mesh locations for {target_prefecture}"))
