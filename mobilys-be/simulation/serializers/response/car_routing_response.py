from rest_framework import serializers
from simulation.serializers.base import BaseResponseSerializer


class CarRoutingPointSerializer(BaseResponseSerializer):
    """DTO for coordinates."""

    lon = serializers.FloatField(required=False, allow_null=True)
    lat = serializers.FloatField(required=False, allow_null=True)


class CarRoutingSummarySerializer(BaseResponseSerializer):
    """DTO for car path summary."""

    distance_km = serializers.FloatField(required=False, allow_null=True)
    est_time_min = serializers.FloatField(required=False, allow_null=True)
    edges = serializers.IntegerField(required=False, allow_null=True)


class CarRoutingSegmentDetailSerializer(BaseResponseSerializer):
    """DTO for detailed car routing segment."""

    seq = serializers.IntegerField(required=False, allow_null=True)
    link_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    road_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    length_m = serializers.FloatField(required=False, allow_null=True)
    lanes = serializers.IntegerField(required=False, allow_null=True)
    speed_up_kmh = serializers.FloatField(required=False, allow_null=True)
    speed_dn_kmh = serializers.FloatField(required=False, allow_null=True)
    cost_min = serializers.FloatField(required=False, allow_null=True)
    geometry = serializers.JSONField(required=False)


class CarRoutingPathSerializer(BaseResponseSerializer):
    """DTO for car routing path."""

    summary = CarRoutingSummarySerializer()
    segments = CarRoutingSegmentDetailSerializer(many=True)


class CarRoutingPatternDetailSerializer(BaseResponseSerializer):
    """DTO for car routing pattern detail."""

    pattern_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gtfs_shape = serializers.JSONField(required=False, allow_null=True)
    start = CarRoutingPointSerializer()
    end = CarRoutingPointSerializer()
    car_path = CarRoutingPathSerializer()


class CarRoutingRouteDetailSerializer(BaseResponseSerializer):
    """DTO for car routing route detail."""

    route_id = serializers.CharField()
    route_name = serializers.CharField(required=False, allow_blank=True)
    route_keyword_color = serializers.CharField(required=False, allow_blank=True)
    route_patterns = CarRoutingPatternDetailSerializer(many=True)


class CarRoutingDetailResponseSerializer(BaseResponseSerializer):
    """DTO for car routing detail response payload."""

    simulation_id = serializers.CharField()
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    routes = CarRoutingRouteDetailSerializer(many=True)


class CarRoutingVolumeSegmentSerializer(BaseResponseSerializer):
    """DTO for car routing volume segment."""

    matchcode_shp = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    section_code_csv = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    road_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    length_m = serializers.FloatField(required=False, allow_null=True)
    lanes = serializers.IntegerField(required=False, allow_null=True)
    updown_cd = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    speed_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    access_cd = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    toll_cd = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    motor_only_cd = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    travel_speed_model_kmh = serializers.FloatField(required=False, allow_null=True)
    speed_up_kmh = serializers.FloatField(required=False, allow_null=True)
    speed_dn_kmh = serializers.FloatField(required=False, allow_null=True)
    vol_up_24h = serializers.FloatField(required=False, allow_null=True)
    vol_dn_24h = serializers.FloatField(required=False, allow_null=True)
    traffic24_total = serializers.FloatField(required=False, allow_null=True)
    vol_up_12h = serializers.FloatField(required=False, allow_null=True)
    vol_dn_12h = serializers.FloatField(required=False, allow_null=True)
    traffic12_total = serializers.FloatField(required=False, allow_null=True)
    signal_density_per_km = serializers.FloatField(required=False, allow_null=True)
    congestion_index = serializers.FloatField(required=False, allow_null=True)
    before_cars_per_day = serializers.FloatField(required=False, allow_null=True)
    after_cars_per_day = serializers.FloatField(required=False, allow_null=True)
    before_vehicle_km_per_day = serializers.FloatField(required=False, allow_null=True)
    after_vehicle_km_per_day = serializers.FloatField(required=False, allow_null=True)


class CarRoutingVolumePatternSerializer(BaseResponseSerializer):
    """DTO for car routing volume pattern."""

    pattern_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    segments = CarRoutingVolumeSegmentSerializer(many=True)
    need_cars_per_day = serializers.FloatField(required=False, allow_null=True)


class CarRoutingVolumeRouteSerializer(BaseResponseSerializer):
    """DTO for car routing volume route."""

    route_id = serializers.CharField()
    route_name = serializers.CharField(required=False, allow_blank=True)
    route_keyword_color = serializers.CharField(required=False, allow_blank=True)
    route_patterns = CarRoutingVolumePatternSerializer(many=True)
    car_change = serializers.FloatField(required=False, allow_null=True)


class CarRoutingVolumeResponseSerializer(BaseResponseSerializer):
    """DTO for car routing volume response payload."""

    simulation_id = serializers.CharField()
    services_ids = serializers.ListField(child=serializers.CharField(), required=False)
    car_change_number = serializers.FloatField()
    routes = CarRoutingVolumeRouteSerializer(many=True)
