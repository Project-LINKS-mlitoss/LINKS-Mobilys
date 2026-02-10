from rest_framework import serializers
from simulation.models import BenefitCalculations
from simulation.serializers.base import BaseResponseSerializer

class BenefitCalculationValuePairSerializer(BaseResponseSerializer):
    """DTO for before/after value pairs."""

    before = serializers.FloatField(allow_null=True, required=False)
    after = serializers.FloatField(allow_null=True, required=False)


class BenefitCalculationSegmentMetricsSerializer(BaseResponseSerializer):
    """DTO for benefit calculation segment metrics."""

    travel_time_savings_benefit_yen_per_year = BenefitCalculationValuePairSerializer()
    operating_cost_reduction_benefit_yen_per_year = BenefitCalculationValuePairSerializer()
    traffic_accident_reduction_benefit_yen_per_year = BenefitCalculationValuePairSerializer()


class BenefitCalculationSegmentSerializer(BaseResponseSerializer):
    """DTO for a segment in benefit calculations."""

    matchcode_shp = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    section_code_csv = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    road_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    metrics = BenefitCalculationSegmentMetricsSerializer()


class BenefitCalculationShapeSerializer(BaseResponseSerializer):
    """DTO for route shape entry in benefit calculations."""

    route_pattern = serializers.JSONField(required=False)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    segments = BenefitCalculationSegmentSerializer(many=True)


class BenefitCalculationRouteSerializer(BaseResponseSerializer):
    """DTO for route-level benefit calculations."""

    route_id = serializers.CharField()
    shapes = BenefitCalculationShapeSerializer(many=True)


class BenefitCalculationTotalsSerializer(BaseResponseSerializer):
    """DTO for totals section in benefit calculations."""

    total_travel_time_savings_benefit_before_per_year = serializers.FloatField()
    total_travel_time_savings_benefit_after_per_year = serializers.FloatField()
    total_operating_cost_reduction_benefit_before_per_year = serializers.FloatField()
    total_operating_cost_reduction_benefit_after_per_year = serializers.FloatField()
    total_traffic_accident_reduction_benefit_before_per_year = serializers.FloatField()
    total_traffic_accident_reduction_benefit_after_per_year = serializers.FloatField()


class BenefitCalculationAnnualBenefitsSerializer(BaseResponseSerializer):
    """DTO for annual benefits section."""

    annual_travel_time_savings_benefit = serializers.FloatField()
    annual_operating_cost_reduction_benefit = serializers.FloatField()
    annual_traffic_accident_reduction_benefit = serializers.FloatField()


class BenefitCalculationsPayloadResponseSerializer(BaseResponseSerializer):
    """DTO for benefit calculations list response payload."""

    simulation = serializers.CharField()
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    routes = BenefitCalculationRouteSerializer(many=True)
    totals = BenefitCalculationTotalsSerializer()
    annual_benefits = BenefitCalculationAnnualBenefitsSerializer()
    annual_total_benefit = serializers.FloatField()
