# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import os
import requests
from pathlib import Path
from django.core.management.base import BaseCommand

SAVE_DIR = "data/mesh_lists"
BASE_URL = "https://www.stat.go.jp/data/mesh/csv/{:02}.csv"

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

class Command(BaseCommand):
    help = "Download all 47 prefecture mesh code mapping CSVs from e-Stat"

    def handle(self, *args, **options):
        ensure_dir(SAVE_DIR)
        for code in range(1, 48):  # Prefecture codes 01 to 47
            url = BASE_URL.format(code)
            file_path = Path(SAVE_DIR) / f"{code:02}.csv"
            self.stdout.write(f"[DOWNLOADING] {url}")
            try:
                response = requests.get(url)
                response.raise_for_status()
                with open(file_path, "wb") as f:
                    f.write(response.content)
                self.stdout.write(self.style.SUCCESS(f"[SAVED] {file_path}"))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[ERROR] Failed to download {url}: {e}"))
