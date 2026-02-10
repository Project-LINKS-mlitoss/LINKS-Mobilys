#!/usr/bin/env python3
"""
Bootstrap script that imports the static mesh and population datasets.
"""

import os
import sys
from pathlib import Path

import django
from django.conf import settings
from django.core.management import call_command

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from data.prefecture_map import PREFECTURE_MAP


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mobilys_BE.settings")


TARGET_PREFECTURE_CODES = ["16"]  # Toyama


def _prefecture_names() -> list[str]:
    # Limit to Toyama (prefecture code "16") so imports run quickly.
    return [
        PREFECTURE_MAP.get(pref_code)
        for pref_code in TARGET_PREFECTURE_CODES
        if PREFECTURE_MAP.get(pref_code)
    ]


def _run_command(command: str, prefecture: str) -> None:
    print(f"[bootstrap] Running `{command}` for prefecture: {prefecture}")
    call_command(command, prefecture=prefecture)


def main() -> None:
    django.setup()

    prefectures = _prefecture_names()
    print(f"[bootstrap] Preparing to import mesh data for {len(prefectures)} prefectures")

    for prefecture in prefectures:
        try:
            _run_command("import_mesh_list", prefecture)
        except Exception as exc:
            print(f"[bootstrap] Mesh import failed for {prefecture}: {exc}")
            raise

    estat_key = getattr(settings, "ESTAT_API_KEY", None)
    if not estat_key:
        print("[bootstrap] ESTAT_API_KEY not configured; skipping population import")
        return

    for prefecture in prefectures:
        try:
            _run_command("import_population_mesh", prefecture)
        except Exception as exc:
            print(f"[bootstrap] Population import failed for {prefecture}: {exc}")
            raise


if __name__ == "__main__":
    main()
