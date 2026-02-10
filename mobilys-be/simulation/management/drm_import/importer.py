from __future__ import annotations

import csv
import io
import os
from dataclasses import dataclass

from django.core.management.base import CommandError
from django.db import connection, transaction
from django.db import models

from .constants import JP, SHP_LINKS_RAW_MAPPING
from .files import find_drm_files, probe_shapefile_encoding
from .normalize import norm_csv_key, to_num
from . import sql as drm_sql


@dataclass(frozen=True)
class DrmImportOptions:
    data_dir: str
    pref_code: int
    srid: int = 4326
    tolerance: float = 0.0001
    encoding_shp: str = "auto"
    encoding_csv: str = "cp932"
    truncate: bool = False
    impute_neighbors: bool = True
    max_impute_hops: int = 1


class DrmImporter:
    def __init__(self, *, stdout=None, style=None):
        self.stdout = stdout
        self.style = style

    def run(self, options: DrmImportOptions) -> None:
        data_dir = options.data_dir.rstrip("/\\")
        if not os.path.isdir(data_dir):
            raise CommandError(f"Directory not found: {data_dir}")

        shp_path, csv_path = find_drm_files(data_dir)

        enc_shp = options.encoding_shp
        if enc_shp == "auto":
            enc_shp = probe_shapefile_encoding(shp_path) or "utf-8"
            self._notice(f"[encoding] shapefile auto-detected: {enc_shp}")

        self._log_shapefile_info(shp_path=shp_path, encoding=enc_shp)

        self._import_shapefile_links_raw(
            shp_path=shp_path,
            pref_code=options.pref_code,
            srid=options.srid,
            encoding=enc_shp,
            truncate=options.truncate,
        )

        self._import_csv_kasyo_raw(
            csv_path=csv_path,
            pref_code=options.pref_code,
            encoding=options.encoding_csv,
            truncate=options.truncate,
        )

        self._build_links_table(
            tolerance=options.tolerance,
        )

        if options.impute_neighbors:
            hops = max(1, int(options.max_impute_hops or 1))
            self._impute_neighbors(pref_code=options.pref_code, hops=hops)
        else:
            self._notice("[skip] neighbor imputation disabled")

        self._success("[ok] Done: multi-prefecture DRM graph ready")

    def _log_shapefile_info(self, *, shp_path: str, encoding: str | None) -> None:
        DataSource, GDALException, _LayerMapping, _gis_models = _lazy_geodjango()
        try:
            ds = DataSource(shp_path, encoding=encoding) if encoding else DataSource(shp_path)
        except GDALException as exc:
            raise CommandError(f"Failed to open shapefile: {shp_path}") from exc

        lyr = ds[0]
        self._notice(
            f"Layer {lyr.name}, features={len(lyr)}, geom={lyr.geom_type.name}, "
            f"srs={lyr.srs} | fields: {', '.join(lyr.fields)}"
        )

    def _import_shapefile_links_raw(
        self,
        *,
        shp_path: str,
        pref_code: int,
        srid: int,
        encoding: str | None,
        truncate: bool,
    ) -> None:
        _DataSource, _GDALException, LayerMapping, gis_models = _lazy_geodjango()

        with connection.cursor() as cur, transaction.atomic():
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            cur.execute("CREATE EXTENSION IF NOT EXISTS pgrouting;")

            if truncate:
                cur.execute("DROP TABLE IF EXISTS drm_links_raw CASCADE;")
                cur.execute("DROP TABLE IF EXISTS drm_kasyo_raw CASCADE;")
                cur.execute("DROP TABLE IF EXISTS drm_links CASCADE;")

            cur.execute(drm_sql.create_drm_links_raw_sql(srid=srid))
            for stmt in drm_sql.ALTER_DRM_LINKS_RAW_ADD_COLUMNS_SQL:
                cur.execute(stmt)

        class _ShpRaw(models.Model):
            class Meta:
                managed = False
                db_table = "drm_links_raw"

            pref_code = models.IntegerField(null=True)
            survey_unit = models.CharField(max_length=64, null=True)
            matchcode = models.CharField(max_length=64, null=True)
            link_cd = models.BigIntegerField(null=True)
            link_len = models.IntegerField(null=True)
            lanes_cd = models.IntegerField(null=True)
            speed_code = models.IntegerField(null=True)
            access_cd = models.IntegerField(null=True)
            toll_cd = models.IntegerField(null=True)
            motor_only_cd = models.IntegerField(null=True)
            updown_cd = models.IntegerField(null=True)
            traffic12 = models.IntegerField(null=True)
            travel_speed_dkmh = models.IntegerField(null=True)
            w12h = models.IntegerField(null=True)
            w24h = models.IntegerField(null=True)
            h12h = models.IntegerField(null=True)
            h24h = models.IntegerField(null=True)
            geom = gis_models.LineStringField(srid=srid)

        with connection.cursor() as cur:
            cur.execute(drm_sql.SELECT_MAX_ID_DRM_LINKS_RAW_SQL)
            max_id_before = cur.fetchone()[0] or 0

        LayerMapping(
            _ShpRaw,
            shp_path,
            SHP_LINKS_RAW_MAPPING,
            source_srs=srid,
            transform=False,
            encoding=encoding or "utf-8",
        ).save(strict=True, verbose=True)

        with connection.cursor() as cur, transaction.atomic():
            cur.execute(drm_sql.UPDATE_DRM_LINKS_RAW_NORM_SQL, [max_id_before])
            cur.execute(drm_sql.UPDATE_DRM_LINKS_RAW_NULL_NORM_SURVEY_SQL, [max_id_before])
            cur.execute(drm_sql.UPDATE_DRM_LINKS_RAW_NULL_NORM_MATCHCODE_SQL, [max_id_before])
            cur.execute(drm_sql.UPDATE_DRM_LINKS_RAW_SET_PREF_CODE_SQL, [pref_code, max_id_before])
            for stmt in drm_sql.CREATE_DRM_LINKS_RAW_INDICES_SQL:
                cur.execute(stmt)

        self._success("[ok] shapefile → drm_links_raw (multi-pref)")

    def _import_csv_kasyo_raw(
        self,
        *,
        csv_path: str,
        pref_code: int,
        encoding: str,
        truncate: bool,
    ) -> None:
        rows: list[dict] = []
        with open(csv_path, "r", encoding=encoding, newline="") as f:
            reader = csv.DictReader(f)
            needed = [
                JP["KEY"],
                JP["ROAD"],
                JP["LEN"],
                JP["UP12"],
                JP["DN12"],
                JP["UP24"],
                JP["DN24"],
                JP["SPDUP"],
                JP["SPDDN"],
                JP["LANE"],
                JP["SIG"],
                JP["CONG"],
            ]
            missing = [c for c in needed if c not in (reader.fieldnames or [])]
            if missing:
                raise CommandError(f"CSV missing columns: {missing}")

            for r in reader:
                join_key_csv = norm_csv_key(r[JP["KEY"]], str(pref_code))
                rows.append(
                    {
                        "join_key_csv": join_key_csv,
                        "matchcode_raw": str(r[JP["KEY"]] or ""),
                        "road_name": r[JP["ROAD"]],
                        "length_km_csv": to_num(r[JP["LEN"]]),
                        "vol_up_12h": to_num(r[JP["UP12"]]),
                        "vol_dn_12h": to_num(r[JP["DN12"]]),
                        "vol_up_24h": to_num(r[JP["UP24"]]),
                        "vol_dn_24h": to_num(r[JP["DN24"]]),
                        "speed_up_kmh": to_num(r[JP["SPDUP"]]),
                        "speed_dn_kmh": to_num(r[JP["SPDDN"]]),
                        "lanes": int(to_num(r[JP["LANE"]]) or 0) if r[JP["LANE"]] not in (None, "") else None,
                        "signal_density_per_km": to_num(r[JP["SIG"]]),
                        "congestion_index": to_num(r[JP["CONG"]]),
                    }
                )

        with connection.cursor() as cur, transaction.atomic():
            cur.execute(drm_sql.CREATE_DRM_KASYO_RAW_SQL)
            if truncate:
                cur.execute(drm_sql.TRUNCATE_DRM_KASYO_RAW_SQL)

        buf = io.StringIO()
        writer = csv.writer(buf)
        for r in rows:
            writer.writerow(
                [
                    pref_code,
                    r["join_key_csv"],
                    r["matchcode_raw"],
                    r["road_name"],
                    r["length_km_csv"],
                    int(r["vol_up_12h"]) if r["vol_up_12h"] is not None else None,
                    int(r["vol_dn_12h"]) if r["vol_dn_12h"] is not None else None,
                    int(r["vol_up_24h"]) if r["vol_up_24h"] is not None else None,
                    int(r["vol_dn_24h"]) if r["vol_dn_24h"] is not None else None,
                    r["speed_up_kmh"],
                    r["speed_dn_kmh"],
                    r["lanes"],
                    r["signal_density_per_km"],
                    r["congestion_index"],
                ]
            )
        buf.seek(0)

        with connection.cursor() as cur:
            cur.copy_expert(
                drm_sql.COPY_DRM_KASYO_RAW_SQL,
                buf,
            )

        with connection.cursor() as cur, transaction.atomic():
            for stmt in drm_sql.CREATE_DRM_KASYO_RAW_INDICES_SQL:
                cur.execute(stmt)

        self._success("[ok] csv → drm_kasyo_raw (multi-pref)")

        with connection.cursor() as cur, transaction.atomic():
            cur.execute(drm_sql.DROP_DRM_KASYO_DEDUP_SQL)
            cur.execute(drm_sql.CREATE_DRM_KASYO_DEDUP_SQL)
            for stmt in drm_sql.CREATE_DRM_KASYO_DEDUP_INDICES_SQL:
                cur.execute(stmt)

        self._success("[ok] csv deduped → drm_kasyo_dedup (by pref)")

    def _build_links_table(self, *, tolerance: float) -> None:
        with connection.cursor() as cur, transaction.atomic():
            cur.execute(drm_sql.DROP_DRM_LINKS_SQL)
            cur.execute(drm_sql.CREATE_DRM_LINKS_SQL)

            cur.execute(drm_sql.ALTER_DRM_LINKS_ADD_TOPOLOGY_COLS_SQL)
            for stmt in drm_sql.CREATE_DRM_LINKS_INDICES_SQL:
                cur.execute(stmt)

            cur.execute(
                drm_sql.PGR_CREATE_TOPOLOGY_SQL,
                [tolerance],
            )
            cur.execute(drm_sql.UPDATE_DRM_LINKS_BASE_COST_SQL)

        self._success("[ok] join → drm_links + topology + base cost")

    def _impute_neighbors(self, *, pref_code: int, hops: int) -> None:
        hops = max(1, hops)
        with connection.cursor() as cur, transaction.atomic():
            for hop in range(1, hops + 1):
                method = f"neighbor_{hop}hop"
                cur.execute(
                    drm_sql.IMPUTE_NEIGHBORS_SQL,
                    [pref_code, method],
                )

        with connection.cursor() as cur, transaction.atomic():
            cur.execute(drm_sql.RECOMPUTE_COST_AFTER_IMPUTE_SQL)
            for stmt in drm_sql.CREATE_DRM_LINKS_NEIGHBOR_INDICES_SQL:
                cur.execute(stmt)

        self._success(f"[ok] neighbor imputation ({hops}-hop) for pref_code={pref_code}")

    def _success(self, message: str) -> None:
        self._write(message, style_name="SUCCESS")

    def _notice(self, message: str) -> None:
        self._write(message, style_name="NOTICE")

    def _write(self, message: str, *, style_name: str | None) -> None:
        if not self.stdout:
            return
        if self.style and style_name:
            styler = getattr(self.style, style_name, None)
            if callable(styler):
                message = styler(message)
        self.stdout.write(message)


def _lazy_geodjango():
    try:
        from django.contrib.gis.gdal import DataSource, GDALException
        from django.contrib.gis.utils import LayerMapping
        from django.contrib.gis.db import models as gis_models
    except Exception as exc:
        raise CommandError(
            "GeoDjango/GDAL is required to import DRM shapefiles. "
            "Install GDAL and ensure Django can load it (e.g. via libgdal / gdal-bin)."
        ) from exc
    return DataSource, GDALException, LayerMapping, gis_models
