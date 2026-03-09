# Simulation app

This Django app contains the simulation domain (API endpoints, services, and supporting utilities).

## Management commands

### `import_drm_for_simulation`

Imports DRM road network data (Shapefile + CSV) into Postgres tables used by the simulation services.

**Prerequisites**
- PostgreSQL with `postgis` and `pgrouting` extensions available.
- GeoDjango + GDAL installed and discoverable by Django (required for Shapefile import).

**Input files**
- A Shapefile (`*.shp`) for link geometry + attributes.
- A CSV (`*.csv`) for traffic/speed attributes. The expected Japanese headers are defined in
  `simulation/management/drm_import/constants.py`.

**Usage**
- Example:
  - `python manage.py import_drm_for_simulation --data-dir ./data/drm/kagawa --pref-code 37 --truncate`
- To import multiple prefectures, run the command multiple times with different `--pref-code`.
  Use `--truncate` only when you want a full reset of existing imported tables.

**Options**
- `--encoding-shp auto` detects encoding by trying common Japanese encodings.
- `--encoding-csv` defaults to `cp932` (can be overridden if your CSV uses a different encoding).
- `--no-impute-neighbors` disables neighbor-based imputation.
- `--max-impute-hops` repeats the same neighbor imputation step multiple times (default `1`).

