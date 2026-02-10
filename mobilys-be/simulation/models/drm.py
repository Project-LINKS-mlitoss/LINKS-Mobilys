from django.contrib.gis.db import models as gis_models
from django.db import models


class DrmLinksRaw(models.Model):
    id = models.BigAutoField(primary_key=True)
    pref_code = models.IntegerField(null=True, blank=True)
    survey_unit = models.TextField(null=True, blank=True)
    matchcode = models.TextField(null=True, blank=True)
    link_cd = models.BigIntegerField(null=True, blank=True)
    link_len = models.IntegerField(null=True, blank=True)
    lanes_cd = models.IntegerField(null=True, blank=True)
    speed_code = models.IntegerField(null=True, blank=True)
    access_cd = models.IntegerField(null=True, blank=True)
    toll_cd = models.IntegerField(null=True, blank=True)
    motor_only_cd = models.IntegerField(null=True, blank=True)
    updown_cd = models.IntegerField(null=True, blank=True)
    traffic12 = models.IntegerField(null=True, blank=True)
    travel_speed_dkmh = models.IntegerField(null=True, blank=True)
    w12h = models.IntegerField(null=True, blank=True)
    w24h = models.IntegerField(null=True, blank=True)
    h12h = models.IntegerField(null=True, blank=True)
    h24h = models.IntegerField(null=True, blank=True)
    geom = gis_models.LineStringField(srid=4326)
    norm_survey = models.TextField(null=True, blank=True)
    norm_matchcode = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "drm_links_raw"
        managed = False
        indexes = [
            models.Index(fields=["norm_survey"]),
            models.Index(fields=["norm_matchcode"]),
        ]


class DrmKasyoRaw(models.Model):
    pref_code = models.IntegerField(null=True, blank=True)
    join_key_csv = models.TextField()
    matchcode_raw = models.TextField(null=True, blank=True)
    road_name = models.TextField(null=True, blank=True)
    length_km_csv = models.FloatField(null=True, blank=True)
    vol_up_12h = models.IntegerField(null=True, blank=True)
    vol_dn_12h = models.IntegerField(null=True, blank=True)
    vol_up_24h = models.IntegerField(null=True, blank=True)
    vol_dn_24h = models.IntegerField(null=True, blank=True)
    speed_up_kmh = models.FloatField(null=True, blank=True)
    speed_dn_kmh = models.FloatField(null=True, blank=True)
    lanes = models.IntegerField(null=True, blank=True)
    signal_density_per_km = models.FloatField(null=True, blank=True)
    congestion_index = models.FloatField(null=True, blank=True)
    matchcode_digits = models.TextField(null=True, blank=True, editable=False)

    class Meta:
        db_table = "drm_kasyo_raw"
        managed = False


class DrmKasyoDedup(models.Model):
    pref_code = models.IntegerField(null=True, blank=True)
    join_key_csv = models.TextField()
    matchcode_raw = models.TextField(null=True, blank=True)
    road_name = models.TextField(null=True, blank=True)
    length_km_csv = models.FloatField(null=True, blank=True)
    vol_up_12h = models.IntegerField(null=True, blank=True)
    vol_dn_12h = models.IntegerField(null=True, blank=True)
    vol_up_24h = models.IntegerField(null=True, blank=True)
    vol_dn_24h = models.IntegerField(null=True, blank=True)
    speed_up_kmh = models.FloatField(null=True, blank=True)
    speed_dn_kmh = models.FloatField(null=True, blank=True)
    lanes = models.IntegerField(null=True, blank=True)
    signal_density_per_km = models.FloatField(null=True, blank=True)
    congestion_index = models.FloatField(null=True, blank=True)
    matchcode_digits = models.TextField(null=True, blank=True, editable=False)

    class Meta:
        db_table = "drm_kasyo_dedup"
        managed = False


class DrmLinks(models.Model):
    id = models.BigAutoField(primary_key=True)
    geom = gis_models.LineStringField(srid=4326)
    pref_code = models.IntegerField(null=True, blank=True)
    join_key = models.TextField(null=True, blank=True)
    survey_unit = models.TextField(null=True, blank=True)
    matchcode_shp = models.TextField(null=True, blank=True)
    section_code_csv = models.TextField(null=True, blank=True)
    road_name = models.TextField(null=True, blank=True)
    length_m = models.IntegerField(null=True, blank=True)
    lanes = models.IntegerField(null=True, blank=True)
    updown_cd = models.IntegerField(null=True, blank=True)
    speed_code = models.IntegerField(null=True, blank=True)
    toll_cd = models.IntegerField(null=True, blank=True)
    access_cd = models.IntegerField(null=True, blank=True)
    motor_only_cd = models.IntegerField(null=True, blank=True)
    travel_speed_model_kmh = models.FloatField(null=True, blank=True)
    speed_up_kmh = models.FloatField(null=True, blank=True)
    speed_dn_kmh = models.FloatField(null=True, blank=True)
    vol_up_24h = models.IntegerField(null=True, blank=True)
    vol_dn_24h = models.IntegerField(null=True, blank=True)
    traffic24_total = models.IntegerField(null=True, blank=True)
    vol_up_12h = models.IntegerField(null=True, blank=True)
    vol_dn_12h = models.IntegerField(null=True, blank=True)
    traffic12_total = models.IntegerField(null=True, blank=True)
    signal_density_per_km = models.FloatField(null=True, blank=True)
    congestion_index = models.FloatField(null=True, blank=True)
    source = models.BigIntegerField(null=True, blank=True)
    target = models.BigIntegerField(null=True, blank=True)
    cost = models.FloatField(null=True, blank=True)
    reverse_cost = models.FloatField(null=True, blank=True)
    imputed_from_join_key = models.TextField(null=True, blank=True)
    imputation_method = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "drm_links"
        managed = False
        indexes = [
            models.Index(fields=["join_key"]),
            models.Index(fields=["source"]),
            models.Index(fields=["target"]),
        ]


class DrmLinksVerticesPgr(models.Model):
    id = models.BigAutoField(primary_key=True)
    the_geom = gis_models.PointField(srid=4326, db_column="the_geom")

    class Meta:
        db_table = "drm_links_vertices_pgr"
        managed = False

