# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.core.management.base import BaseCommand

from simulation.management.drm_import import DrmImporter, DrmImportOptions


class Command(BaseCommand):
    help = (
        "Re-import DRM (Shapefile + CSV) for simulation: multi-prefecture, layered join, "
        "pgRouting topology, neighbor imputation, and Excel-like baseline view."
    )

    def add_arguments(self, parser):
        parser.add_argument("--data-dir", required=True, help="Folder containing shapefile & CSV")
        parser.add_argument(
            "--pref-code",
            type=int,
            required=True,
            help="Numeric prefecture code (e.g. 37 for Kagawa)",
        )
        parser.add_argument("--srid", type=int, default=4326)
        parser.add_argument("--tolerance", type=float, default=0.0001)
        parser.add_argument("--encoding-shp", default="auto")
        parser.add_argument("--encoding-csv", default="cp932")
        parser.add_argument("--truncate", action="store_true")
        parser.add_argument("--impute-neighbors", dest="impute", action="store_true", default=True)
        parser.add_argument("--no-impute-neighbors", dest="impute", action="store_false")
        parser.add_argument("--max-impute-hops", type=int, default=1)

    def handle(self, *args, **options):
        opts = DrmImportOptions(
            data_dir=options["data_dir"],
            pref_code=options["pref_code"],
            srid=options["srid"],
            tolerance=options["tolerance"],
            encoding_shp=options["encoding_shp"],
            encoding_csv=options["encoding_csv"],
            truncate=options["truncate"],
            impute_neighbors=options["impute"],
            max_impute_hops=options["max_impute_hops"],
        )
        DrmImporter(stdout=self.stdout, style=self.style).run(opts)

