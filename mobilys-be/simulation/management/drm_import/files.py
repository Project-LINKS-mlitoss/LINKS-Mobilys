import os

from django.core.management.base import CommandError

from .constants import SHAPEFILE_ENCODING_CANDIDATES


def find_drm_files(data_dir: str) -> tuple[str, str]:
    shp_path = None
    csv_path = None

    for filename in os.listdir(data_dir):
        if filename.lower().endswith(".shp"):
            shp_path = os.path.join(data_dir, filename)
            break
    if not shp_path:
        raise CommandError("Shapefile (*.shp) not found in --data-dir.")

    for filename in os.listdir(data_dir):
        if filename.lower().endswith(".csv") and "kasyo" in filename.lower():
            csv_path = os.path.join(data_dir, filename)
            break
    if not csv_path:
        for filename in os.listdir(data_dir):
            if filename.lower().endswith(".csv"):
                csv_path = os.path.join(data_dir, filename)
                break
    if not csv_path:
        raise CommandError("CSV (*.csv) not found in --data-dir.")

    return shp_path, csv_path


def probe_shapefile_encoding(shp_path: str) -> str | None:
    DataSource, GDALException = _lazy_gdal()
    try:
        DataSource(shp_path)
        return None
    except GDALException:
        for encoding in SHAPEFILE_ENCODING_CANDIDATES:
            try:
                DataSource(shp_path, encoding=encoding)
                return encoding
            except Exception:
                continue
        raise


def _lazy_gdal():
    try:
        from django.contrib.gis.gdal import DataSource, GDALException
    except Exception as exc:
        raise CommandError(
            "GeoDjango/GDAL is required to import DRM shapefiles. "
            "Install GDAL and ensure Django can load it (e.g. via libgdal / gdal-bin)."
        ) from exc
    return DataSource, GDALException

