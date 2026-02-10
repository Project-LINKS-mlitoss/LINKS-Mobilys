from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.response.trip_response import AdjustmentSerializer, TripSerializer


class RouteSerializer(serializers.Serializer):
    route_id = serializers.CharField()
    route_name = serializers.CharField()
    isEditOnTripsLevel = serializers.BooleanField()
    adjustment = AdjustmentSerializer(required=False)
    trips = TripSerializer(many=True)

