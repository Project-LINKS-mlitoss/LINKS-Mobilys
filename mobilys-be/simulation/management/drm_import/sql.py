def create_drm_links_raw_sql(*, srid: int) -> str:
    return f"""
    CREATE TABLE IF NOT EXISTS drm_links_raw (
      id bigserial PRIMARY KEY,
      pref_code integer,
      survey_unit text,
      matchcode text,
      link_cd bigint,
      link_len integer,
      lanes_cd integer,
      speed_code integer,
      access_cd integer,
      toll_cd integer,
      motor_only_cd integer,
      updown_cd integer,
      traffic12 integer,
      travel_speed_dkmh integer,
      w12h integer,
      w24h integer,
      h12h integer,
      h24h integer,
      geom geometry(LineString,{srid}),
      norm_survey text,
      norm_matchcode text
    );
    """


ALTER_DRM_LINKS_RAW_ADD_COLUMNS_SQL = (
    "ALTER TABLE drm_links_raw ADD COLUMN IF NOT EXISTS pref_code integer;",
    "ALTER TABLE drm_links_raw ADD COLUMN IF NOT EXISTS norm_survey text;",
    "ALTER TABLE drm_links_raw ADD COLUMN IF NOT EXISTS norm_matchcode text;",
)


SELECT_MAX_ID_DRM_LINKS_RAW_SQL = "SELECT COALESCE(MAX(id), 0) FROM drm_links_raw;"


UPDATE_DRM_LINKS_RAW_NORM_SQL = """
UPDATE drm_links_raw
SET
  norm_survey    = regexp_replace(COALESCE(survey_unit,''),'[^0-9]','','g'),
  norm_matchcode = regexp_replace(COALESCE(matchcode,''),'[^0-9]','','g')
WHERE id > %s;
"""


UPDATE_DRM_LINKS_RAW_NULL_NORM_SURVEY_SQL = """
UPDATE drm_links_raw
SET norm_survey = NULL
WHERE (norm_survey ~ '^[0]+$' OR length(norm_survey) < 6)
  AND id > %s;
"""


UPDATE_DRM_LINKS_RAW_NULL_NORM_MATCHCODE_SQL = """
UPDATE drm_links_raw
SET norm_matchcode = NULL
WHERE (norm_matchcode ~ '^[0]+$' OR length(norm_matchcode) < 6)
  AND id > %s;
"""


UPDATE_DRM_LINKS_RAW_SET_PREF_CODE_SQL = """
UPDATE drm_links_raw
SET pref_code = %s
WHERE id > %s;
"""


CREATE_DRM_LINKS_RAW_INDICES_SQL = (
    "CREATE INDEX IF NOT EXISTS drm_links_raw_norm_survey_idx ON drm_links_raw(norm_survey);",
    "CREATE INDEX IF NOT EXISTS drm_links_raw_norm_matchcode_idx ON drm_links_raw(norm_matchcode);",
    "CREATE INDEX IF NOT EXISTS drm_links_raw_geom_gix ON drm_links_raw USING GIST(geom);",
)


CREATE_DRM_KASYO_RAW_SQL = """
CREATE TABLE IF NOT EXISTS drm_kasyo_raw(
  pref_code integer,
  join_key_csv text,
  matchcode_raw text,
  road_name text,
  length_km_csv double precision,
  vol_up_12h integer,
  vol_dn_12h integer,
  vol_up_24h integer,
  vol_dn_24h integer,
  speed_up_kmh double precision,
  speed_dn_kmh double precision,
  lanes integer,
  signal_density_per_km double precision,
  congestion_index double precision,
  matchcode_digits text GENERATED ALWAYS AS (
    regexp_replace(matchcode_raw,'[^0-9]','','g')
  ) STORED
);
"""


TRUNCATE_DRM_KASYO_RAW_SQL = "TRUNCATE TABLE drm_kasyo_raw;"


COPY_DRM_KASYO_RAW_SQL = """
COPY drm_kasyo_raw(
  pref_code,
  join_key_csv,
  matchcode_raw,
  road_name,
  length_km_csv,
  vol_up_12h,
  vol_dn_12h,
  vol_up_24h,
  vol_dn_24h,
  speed_up_kmh,
  speed_dn_kmh,
  lanes,
  signal_density_per_km,
  congestion_index
)
FROM STDIN WITH (FORMAT CSV)
"""


CREATE_DRM_KASYO_RAW_INDICES_SQL = (
    """
    CREATE INDEX IF NOT EXISTS drm_kasyo_raw_join_key_csv_idx
      ON drm_kasyo_raw(pref_code, join_key_csv);
    """,
    """
    CREATE INDEX IF NOT EXISTS drm_kasyo_raw_match_digits_idx
      ON drm_kasyo_raw(pref_code, matchcode_digits);
    """,
)


DROP_DRM_KASYO_DEDUP_SQL = "DROP TABLE IF EXISTS drm_kasyo_dedup;"


CREATE_DRM_KASYO_DEDUP_SQL = """
CREATE TABLE drm_kasyo_dedup AS
SELECT DISTINCT ON (pref_code, join_key_csv) *
FROM drm_kasyo_raw
ORDER BY
  pref_code,
  join_key_csv,
  (COALESCE(vol_up_24h,0) + COALESCE(vol_dn_24h,0)) DESC;
"""


CREATE_DRM_KASYO_DEDUP_INDICES_SQL = (
    "CREATE INDEX drm_kasyo_dedup_pref_join_idx ON drm_kasyo_dedup(pref_code, join_key_csv);",
    "CREATE INDEX drm_kasyo_dedup_pref_match_idx ON drm_kasyo_dedup(pref_code, matchcode_digits);",
)


DROP_DRM_LINKS_SQL = "DROP TABLE IF EXISTS drm_links CASCADE;"


CREATE_DRM_LINKS_SQL = """
CREATE TABLE drm_links AS
WITH k AS (
  SELECT * FROM drm_kasyo_dedup
)
SELECT
  l.id,
  l.geom,
  l.pref_code AS pref_code,
  COALESCE(l.norm_survey, l.norm_matchcode) AS join_key,
  l.survey_unit AS survey_unit,
  l.matchcode  AS matchcode_shp,
  picked.matchcode_raw AS section_code_csv,
  picked.road_name AS road_name,
  COALESCE(l.link_len, (picked.length_km_csv*1000)::int) AS length_m,
  COALESCE(picked.lanes, l.lanes_cd) AS lanes,
  l.updown_cd,
  l.speed_code,
  l.toll_cd,
  l.access_cd,
  l.motor_only_cd,
  (l.travel_speed_dkmh/10.0)::double precision AS travel_speed_model_kmh,
  picked.speed_up_kmh,
  picked.speed_dn_kmh,
  picked.vol_up_24h,
  picked.vol_dn_24h,
  (COALESCE(picked.vol_up_24h,0)+COALESCE(picked.vol_dn_24h,0))::int AS traffic24_total,
  picked.vol_up_12h,
  picked.vol_dn_12h,
  (COALESCE(picked.vol_up_12h,0)+COALESCE(picked.vol_dn_12h,0))::int AS traffic12_total,
  picked.signal_density_per_km,
  picked.congestion_index,
  NULL::text AS imputed_from_join_key,
  NULL::text AS imputation_method
FROM drm_links_raw l
LEFT JOIN LATERAL (
  SELECT *
  FROM k
  WHERE
    k.pref_code = l.pref_code
    AND (
      k.join_key_csv     = l.norm_survey
      OR k.join_key_csv     = l.norm_matchcode
      OR k.matchcode_digits = l.norm_survey
      OR k.matchcode_digits = l.norm_matchcode
    )
  ORDER BY
    CASE
      WHEN k.join_key_csv     = l.norm_survey     THEN 1
      WHEN k.join_key_csv     = l.norm_matchcode  THEN 2
      WHEN k.matchcode_digits = l.norm_survey     THEN 3
      WHEN k.matchcode_digits = l.norm_matchcode  THEN 4
      ELSE 5
    END
  LIMIT 1
) AS picked ON TRUE;
"""


ALTER_DRM_LINKS_ADD_TOPOLOGY_COLS_SQL = """
ALTER TABLE drm_links ADD COLUMN IF NOT EXISTS source bigint;
ALTER TABLE drm_links ADD COLUMN IF NOT EXISTS target bigint;
ALTER TABLE drm_links ADD COLUMN IF NOT EXISTS cost double precision;
ALTER TABLE drm_links ADD COLUMN IF NOT EXISTS reverse_cost double precision;
"""


CREATE_DRM_LINKS_INDICES_SQL = (
    "CREATE INDEX IF NOT EXISTS drm_links_geom_gix ON drm_links USING GIST(geom);",
    "CREATE INDEX IF NOT EXISTS drm_links_key_idx ON drm_links(join_key);",
    "CREATE INDEX IF NOT EXISTS drm_links_pref_idx ON drm_links(pref_code);",
    "CREATE INDEX IF NOT EXISTS drm_links_source_idx ON drm_links(source);",
    "CREATE INDEX IF NOT EXISTS drm_links_target_idx ON drm_links(target);",
)


PGR_CREATE_TOPOLOGY_SQL = "SELECT pgr_createTopology('drm_links', %s::double precision, 'geom', 'id');"


UPDATE_DRM_LINKS_BASE_COST_SQL = """
UPDATE drm_links
SET
  cost = CASE
    WHEN speed_up_kmh IS NOT NULL AND speed_up_kmh > 0
      THEN (length_m/1000.0)/speed_up_kmh*60.0
    WHEN travel_speed_model_kmh IS NOT NULL AND travel_speed_model_kmh > 0
      THEN (length_m/1000.0)/travel_speed_model_kmh*60.0
    ELSE 999999.0
  END,
  reverse_cost = CASE
    WHEN speed_dn_kmh IS NOT NULL AND speed_dn_kmh > 0
      THEN (length_m/1000.0)/speed_dn_kmh*60.0
    WHEN travel_speed_model_kmh IS NOT NULL AND travel_speed_model_kmh > 0
      THEN (length_m/1000.0)/travel_speed_model_kmh*60.0
    ELSE 999999.0
  END;
UPDATE drm_links SET reverse_cost = 999999.0 WHERE updown_cd = 1;
UPDATE drm_links SET cost         = 999999.0 WHERE updown_cd = 2;
ANALYZE drm_links;
"""


IMPUTE_NEIGHBORS_SQL = """
WITH candidates AS (
    SELECT
    u.id AS uid,
    nn.join_key AS n_join_key,
    nn.road_name AS n_road_name,
    nn.lanes AS n_lanes,
    nn.speed_up_kmh AS n_speed_up_kmh,
    nn.speed_dn_kmh AS n_speed_dn_kmh,
    nn.vol_up_24h AS n_vol_up_24h,
    nn.vol_dn_24h AS n_vol_dn_24h,
    nn.traffic24_total AS n_traffic24_total,
    nn.vol_up_12h AS n_vol_up_12h,
    nn.vol_dn_12h AS n_vol_dn_12h,
    nn.traffic12_total AS n_traffic12_total,
    nn.signal_density_per_km AS n_signal_density_per_km,
    nn.congestion_index AS n_congestion_index
    FROM drm_links u
    JOIN LATERAL (
    SELECT nn.*
    FROM drm_links nn
    WHERE nn.id <> u.id
        AND nn.pref_code = u.pref_code
        AND (
        u.source = nn.source OR u.source = nn.target
        OR u.target = nn.source OR u.target = nn.target
        )
        AND nn.road_name IS NOT NULL
    ORDER BY COALESCE(nn.traffic24_total, 0) DESC
    LIMIT 1
    ) nn ON TRUE
    WHERE
    u.pref_code = %s
    AND (
        u.road_name IS NULL
        OR u.vol_up_24h IS NULL
        OR u.vol_dn_24h IS NULL
        OR u.speed_up_kmh IS NULL
        OR u.speed_dn_kmh IS NULL
    )
)
UPDATE drm_links u
SET
    road_name             = COALESCE(u.road_name,             c.n_road_name),
    lanes                 = COALESCE(u.lanes,                 c.n_lanes),
    speed_up_kmh          = COALESCE(u.speed_up_kmh,          c.n_speed_up_kmh),
    speed_dn_kmh          = COALESCE(u.speed_dn_kmh,          c.n_speed_dn_kmh),
    vol_up_24h            = COALESCE(u.vol_up_24h,            c.n_vol_up_24h),
    vol_dn_24h            = COALESCE(u.vol_dn_24h,            c.n_vol_dn_24h),
    traffic24_total       = COALESCE(u.traffic24_total,       c.n_traffic24_total),
    vol_up_12h            = COALESCE(u.vol_up_12h,            c.n_vol_up_12h),
    vol_dn_12h            = COALESCE(u.vol_dn_12h,            c.n_vol_dn_12h),
    traffic12_total       = COALESCE(u.traffic12_total,       c.n_traffic12_total),
    signal_density_per_km = COALESCE(u.signal_density_per_km, c.n_signal_density_per_km),
    congestion_index      = COALESCE(u.congestion_index,      c.n_congestion_index),
    imputed_from_join_key = COALESCE(u.imputed_from_join_key, c.n_join_key),
    imputation_method     = COALESCE(u.imputation_method, %s)
FROM candidates c
WHERE u.id = c.uid;
"""


RECOMPUTE_COST_AFTER_IMPUTE_SQL = """
UPDATE drm_links
SET
    cost = CASE
    WHEN speed_up_kmh IS NOT NULL AND speed_up_kmh > 0
        THEN (length_m/1000.0)/speed_up_kmh*60.0
    WHEN travel_speed_model_kmh IS NOT NULL AND travel_speed_model_kmh > 0
        THEN (length_m/1000.0)/travel_speed_model_kmh*60.0
    ELSE cost
    END,
    reverse_cost = CASE
    WHEN speed_dn_kmh IS NOT NULL AND speed_dn_kmh > 0
        THEN (length_m/1000.0)/speed_dn_kmh*60.0
    WHEN travel_speed_model_kmh IS NOT NULL AND travel_speed_model_kmh > 0
        THEN (length_m/1000.0)/travel_speed_model_kmh*60.0
    ELSE reverse_cost
    END;
ANALYZE drm_links;
"""


CREATE_DRM_LINKS_NEIGHBOR_INDICES_SQL = (
    "CREATE INDEX IF NOT EXISTS drm_links_source_idx ON drm_links(source);",
    "CREATE INDEX IF NOT EXISTS drm_links_target_idx ON drm_links(target);",
)

