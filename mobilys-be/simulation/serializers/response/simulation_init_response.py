from rest_framework import serializers

from simulation.serializers.base import BaseResponseSerializer


class SimulationScenarioResponseSerializer(BaseResponseSerializer):
    """DTO for scenario reference in responses."""

    id = serializers.CharField(allow_null=True)
    name = serializers.CharField(allow_null=True)


class SimulationSourceFileResponseSerializer(BaseResponseSerializer):
    """DTO for uploaded source file metadata."""

    name = serializers.CharField(required=False, allow_blank=True)
    size = serializers.IntegerField(required=False)
    type = serializers.CharField(required=False, allow_blank=True)


class SimulationCSVSourceFileResponseSerializer(BaseResponseSerializer):
    """DTO for CSV file metadata in validation payloads."""

    name = serializers.CharField(required=False, allow_blank=True)
    size = serializers.IntegerField(required=False, allow_null=True)


class SimulationInitParamsGetResponseSerializer(BaseResponseSerializer):
    """DTO for simulation init params in GET responses."""

    service_date = serializers.CharField()
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    epsilon_inc = serializers.FloatField()
    epsilon_dec = serializers.FloatField()
    cost_per_share = serializers.FloatField()
    car_share = serializers.FloatField()
    time_value_yen_per_min_per_vehicle = serializers.FloatField()
    default_fare = serializers.FloatField()


class SimulationInitParamsCreateResponseSerializer(BaseResponseSerializer):
    """DTO for simulation init params in POST responses."""

    serviceDate = serializers.CharField()
    serviceId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    serviceIds = serializers.ListField(child=serializers.CharField(), required=False)
    epsilon_inc = serializers.FloatField()
    epsilon_dec = serializers.FloatField()
    costPerVehKmYen = serializers.FloatField()
    carShare = serializers.FloatField()
    timeValueYenPerMin_perVehicle = serializers.FloatField()
    defaultFare = serializers.FloatField()
    same_with_bus = serializers.BooleanField(required=False)
    buffer_bus = serializers.IntegerField(required=False)


class SimulationInitGetResponseSerializer(BaseResponseSerializer):
    """DTO for SimulationInitAPIView GET response payload."""

    id = serializers.IntegerField()
    original_scenario = SimulationScenarioResponseSerializer()
    duplicated_scenario = SimulationScenarioResponseSerializer()
    simulation_id = serializers.CharField()
    params = SimulationInitParamsGetResponseSerializer()
    source_file = SimulationSourceFileResponseSerializer()
    status = serializers.CharField()
    created_at = serializers.CharField()
    updated_at = serializers.CharField()


class SimulationInitCreateResponseSerializer(BaseResponseSerializer):
    """DTO for SimulationInitAPIView POST response payload."""

    id = serializers.IntegerField()
    original_scenario = SimulationScenarioResponseSerializer()
    duplicated_scenario = SimulationScenarioResponseSerializer()
    simulationId = serializers.CharField()
    params = SimulationInitParamsCreateResponseSerializer()
    source_file = SimulationSourceFileResponseSerializer()
    status = serializers.CharField()
    createdAt = serializers.CharField()
    updatedAt = serializers.CharField()


class SimulationCSVIssueResponseSerializer(BaseResponseSerializer):
    """DTO for CSV validation issues."""

    type = serializers.CharField()
    scenario = serializers.CharField()
    expected_route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SimulationCSVInvalidRowResponseSerializer(BaseResponseSerializer):
    """DTO for invalid CSV rows."""

    row_number = serializers.IntegerField()
    trip_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    issues = SimulationCSVIssueResponseSerializer(many=True)


class SimulationCSVComparisonResponseSerializer(BaseResponseSerializer):
    """DTO for pattern-level trip comparisons."""

    route_id = serializers.CharField()
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    is_direction_id_generated = serializers.BooleanField(required=False)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    first_and_last_stop_name = serializers.CharField(required=False, allow_blank=True)
    original_trip_count = serializers.IntegerField()
    duplicated_trip_count = serializers.IntegerField()
    difference = serializers.IntegerField()


class SimulationInitDiffResponseSerializer(BaseResponseSerializer):
    """DTO for SimulationInitDiffAPIView response payload."""

    invalid_rows = SimulationCSVInvalidRowResponseSerializer(many=True)
    valid_trip_count = serializers.IntegerField()
    invalid_trip_count = serializers.IntegerField()
    trip_count_comparisons = SimulationCSVComparisonResponseSerializer(many=True)
    all_trip_counts_equal = serializers.BooleanField()
    service_date = serializers.CharField(allow_null=True, required=False)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)


class SimulationUnionServiceIdsResponseSerializer(serializers.ListSerializer):
    """DTO for union service id list response payload."""

    child = serializers.CharField()


class ValidateAndSaveCSVResponseSerializer(BaseResponseSerializer):
    """DTO for ValidateAndSaveCSVView response payload."""

    trip_count_comparisons = SimulationCSVComparisonResponseSerializer(many=True)
    invalid_rows = SimulationCSVInvalidRowResponseSerializer(many=True)
    service_date = serializers.CharField(required=False, allow_blank=True)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    source_file = SimulationCSVSourceFileResponseSerializer(required=False)
    persisted = serializers.BooleanField(required=False)
    saved_at = serializers.CharField(required=False)
    version = serializers.IntegerField(required=False)


class ValidationResultDeleteResponseSerializer(BaseResponseSerializer):
    """DTO for delete response in validation result view."""

    deleted = serializers.IntegerField()
