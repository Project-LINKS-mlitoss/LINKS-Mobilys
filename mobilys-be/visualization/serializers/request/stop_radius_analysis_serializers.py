from rest_framework import serializers


class StopGroupBufferAnalysisRequestSerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    radius = serializers.FloatField(required=True)
    dissolve = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    outline_only = serializers.BooleanField(required=False)
    project_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_radius(self, value):
        if value <= 0:
            raise serializers.ValidationError("radius must be greater than 0.")
        return value


class StopGroupBufferAnalysisGraphRequestSerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    radius = serializers.FloatField(required=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_radius(self, value):
        if value <= 0:
            raise serializers.ValidationError("radius must be greater than 0.")
        return value
