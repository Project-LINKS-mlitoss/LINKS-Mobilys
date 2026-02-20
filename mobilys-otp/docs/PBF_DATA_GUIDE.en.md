# PBF Data Guide

This guide explains how to add new OSM (OpenStreetMap) or DRM (Digital Road Map) PBF files to the Mobilys OTP service for road network analysis.

---

## Table of Contents

- [Overview](#overview)
- [Data Types](#data-types)
- [Folder Structure](#folder-structure)
- [File Naming Convention](#file-naming-convention)
- [Adding OSM Data](#adding-osm-data)
- [Adding DRM Data](#adding-drm-data)
- [Verification](#verification)
- [Data Sources](#data-sources)
- [Currently Available Data](#currently-available-data)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Mobilys OTP service uses PBF (Protocolbuffer Binary Format) files for road network data. These files are used by OpenTripPlanner to build routing graphs for isochrone calculations and road network analysis.

There are two types of road network data:
- **OSM (OpenStreetMap)** - Open source map data
- **DRM (Digital Road Map)** - Japan's official road network data with traffic information

---

## Data Types

| Type | Description | Use Case |
|------|-------------|----------|
| OSM | OpenStreetMap data | General road network analysis, available for all prefectures |
| DRM | Digital Road Map data | Traffic simulation with detailed road attributes (lanes, traffic volume, speed) |

---

## Folder Structure

PBF files are stored in the `mobilys-otp` directory:

```
mobilys-otp/
├── preloaded_osm_files/          # OSM PBF files
│   ├── Hokkaido.osm.pbf
│   ├── Tokyo.osm.pbf
│   ├── Osaka.osm.pbf
│   ├── Kagawa.osm.pbf
│   └── ... (47 prefectures)
│
├── preloaded_drm_files/          # DRM files
│   ├── Kagawa.osm
│   ├── Toyama.osm
│   └── ... (limited prefectures)
```

---

## File Naming Convention

### OSM Files

**Format:** `{PrefectureName}.osm.pbf`

**Rules:**
- Prefecture name must be **capitalized** (first letter uppercase)
- Use **romaji** (English transliteration) for prefecture names
- File extension must be `.osm.pbf`

**Examples:**
| Prefecture | Correct | Incorrect |
|------------|---------|-----------|
| 東京都 | `Tokyo.osm.pbf` | `tokyo.osm.pbf`, `TOKYO.osm.pbf` |
| 香川県 | `Kagawa.osm.pbf` | `kagawa.osm.pbf`, `Kagawa.pbf` |
| 北海道 | `Hokkaido.osm.pbf` | `hokkaido.osm.pbf` |

### DRM Files

**Format:** `{PrefectureName}.osm.pbf`

**Rules:**
- Prefecture name must be **capitalized** (first letter uppercase)
- Use **romaji** (English transliteration) for prefecture names
- File extension is `.osm.pbf` (same format as OSM files)

**Examples:**
| Prefecture | Correct | Incorrect |
|------------|---------|-----------|
| 香川県 | `Kagawa.osm.pbf` | `kagawa.osm.pbf`, `Kagawa.osm` |
| 富山県 | `Toyama.osm.pbf` | `toyama.osm.pbf` |

---

## Adding OSM Data

### Step 1: Download OSM Data

Download the prefecture PBF file from Geofabrik:

1. Go to https://download.geofabrik.de/asia/japan.html
2. Find your target prefecture
3. Download the `.osm.pbf` file

### Step 2: Rename the File

Rename the downloaded file to match the naming convention:

```bash
# Example: Rename Geofabrik file to standard format
mv japan-latest.osm.pbf Osaka.osm.pbf
```

### Step 3: Copy to Preloaded Folder

Copy the file to `mobilys-otp/preloaded_osm_files/`:

```bash
cp Osaka.osm.pbf /path/to/mobilys-otp/preloaded_osm_files/
```

### Step 4: Restart Services

The file will be automatically recognized once copied to the folder. No backend configuration update is required.

```bash
# Run from the project root directory
docker-compose restart otp-fastapi
```

---

## Adding DRM Data

### Step 1: Prepare DRM Data

DRM data requires conversion from the original format to OSM PBF format. The data typically comes from Japan's road traffic census.

### Step 2: Convert to OSM PBF Format

If you have raw DRM data, convert it to `.osm.pbf` format using appropriate tools.

### Step 3: Rename the File

Ensure the file follows the naming convention:

```bash
# Example
mv drm_kagawa_data.osm.pbf Kagawa.osm.pbf
```

### Step 4: Copy to Preloaded Folder

Copy the file to `mobilys-otp/preloaded_drm_files/`:

```bash
cp Kagawa.osm.pbf /path/to/mobilys-otp/preloaded_drm_files/
```

### Step 5: Restart Services

The file will be automatically recognized once copied to the folder. No backend configuration update is required.

```bash
# Run from the project root directory
docker-compose restart otp-fastapi
```

### Important Notes

- Prefecture names must match **exactly** (case-sensitive)
- Filename must be capitalized romaji with `.osm.pbf` extension
- Example: `Kagawa.osm.pbf`, `Tokyo.osm.pbf`
- Files are automatically recognized once copied to the folder (no configuration file editing required)

---

## Verification

### Check File Exists

```bash
# For OSM
ls -la mobilys-otp/preloaded_osm_files/

# For DRM
ls -la mobilys-otp/preloaded_drm_files/
```

### Test via API

After restarting services, test the PBF bbox endpoint:

```bash
# Check if the new prefecture is recognized
curl "http://localhost:8001/pbf_bbox?prefecture=Kagawa"
```

Expected response:
```json
{
  "status": "success",
  "bbox": {
    "min_lon": 133.xxx,
    "min_lat": 34.xxx,
    "max_lon": 134.xxx,
    "max_lat": 34.xxx
  }
}
```

### Test Graph Building

Build a test graph to verify the data works:

```bash
curl -X POST "http://localhost:8001/build_graph" \
  -F "scenario_id=test-123" \
  -F "prefecture=Kagawa" \
  -F "gtfs_file=@test_gtfs.zip"
```

---

## Data Sources

### OSM Data

| Source | URL | Description |
|--------|-----|-------------|
| Geofabrik | https://download.geofabrik.de/asia/japan.html | Pre-extracted Japan prefecture data |
| Planet OSM | https://planet.openstreetmap.org/ | Full OpenStreetMap data |
| BBBike | https://extract.bbbike.org/ | Custom area extraction |

### DRM Data

DRM data is sourced from Japan's Ministry of Land, Infrastructure, Transport and Tourism (MLIT) road traffic census. Contact your data administrator for access.

---

## Currently Available Data

### OSM Files (47 Prefectures)

All 47 Japanese prefectures are available:

| Region | Prefectures |
|--------|-------------|
| Hokkaido | Hokkaido |
| Tohoku | Aomori, Iwate, Miyagi, Akita, Yamagata, Fukushima |
| Kanto | Ibaraki, Tochigi, Gunma, Saitama, Chiba, Tokyo, Kanagawa |
| Chubu | Niigata, Toyama, Ishikawa, Fukui, Yamanashi, Nagano, Gifu, Shizuoka, Aichi |
| Kinki | Mie, Shiga, Kyoto, Osaka, Hyogo, Nara, Wakayama |
| Chugoku | Tottori, Shimane, Okayama, Hiroshima, Yamaguchi |
| Shikoku | Tokushima, Kagawa, Ehime, Kochi |
| Kyushu | Fukuoka, Saga, Nagasaki, Kumamoto, Oita, Miyazaki, Kagoshima, Okinawa |


---

## Troubleshooting

### Error: "PBF file not found"

**Cause:** File doesn't exist or has incorrect name.

**Solution:**
1. Check file exists in the correct folder
2. Verify filename matches naming convention (capitalized)
3. Verify file extension (`.osm.pbf` for OSM, `.osm` for DRM)

### Error: "Prefecture not in available list"

**Cause:** PBF file does not exist in the correct folder or has an incorrect filename.

**Solution:**
1. Verify file exists in the correct folder (`preloaded_osm_files/` for OSM, `preloaded_drm_files/` for DRM)
2. Verify filename follows naming convention (capitalized, `.osm.pbf` extension)
3. Restart service with `docker-compose restart otp-fastapi`

### Error: "OTP build failed"

**Cause:** PBF file is corrupted or incompatible.

**Solution:**
1. Re-download the PBF file
2. Verify file integrity with `osmium fileinfo <file.osm.pbf>`
3. Check OTP logs for specific error messages

### Graph building is slow

**Cause:** Large prefecture with many roads.

**Solution:**
1. Increase OTP heap memory: Set `OTP_BUILD_HEAP=12G` or higher
2. Ensure sufficient system RAM (16GB+ recommended)
3. Large prefectures (Tokyo, Osaka, Hokkaido) may take 10-30 minutes

---

## Quick Reference

### Add OSM Prefecture

```bash
# 1. Download from Geofabrik
wget https://download.geofabrik.de/asia/japan/kanto-region-latest.osm.pbf

# 2. Rename (example for Saitama)
mv kanto-region-latest.osm.pbf Saitama.osm.pbf

# 3. Copy to folder
cp Saitama.osm.pbf mobilys-otp/preloaded_osm_files/

# 4. Restart services (no config file editing needed, auto-detected)
docker-compose restart otp-fastapi
```

### Add DRM Prefecture

```bash
# 1. Prepare .osm.pbf file

# 2. Rename (example for Osaka)
mv osaka_drm.osm.pbf Osaka.osm.pbf

# 3. Copy to folder
cp Osaka.osm.pbf mobilys-otp/preloaded_drm_files/

# 4. Restart services (no config file editing needed, auto-detected)
docker-compose restart otp-fastapi
```
