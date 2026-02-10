from rest_framework import serializers


class ODUploadRequestSerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    od_data = serializers.ListField(child=serializers.DictField(), required=True, allow_empty=False)


class ODUsageDistributionRequestSerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    od_data = serializers.ListField(child=serializers.DictField(), required=True)
    total_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    selected_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ODLastFirstStopRequestSerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    od_data = serializers.ListField(child=serializers.DictField(), required=True)
    selected_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    type = serializers.CharField(required=True)


class ODBusStopRequestSerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    od_data = serializers.ListField(child=serializers.DictField(), required=True)
    selected_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)
