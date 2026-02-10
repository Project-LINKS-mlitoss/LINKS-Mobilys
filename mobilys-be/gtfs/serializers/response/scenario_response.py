from __future__ import annotations

from rest_framework import serializers

from gtfs.models import Scenario


class ScenarioAPISerializer(serializers.ModelSerializer):
    class Meta:
        model = Scenario
        fields = [
            "start_date",
            "end_date",
        ]


class ScenarioLocalSerializer(serializers.ModelSerializer):
    source_type = serializers.CharField(source="get_source_type_display", read_only=True)
    source_scenario_name = serializers.CharField(source="source_scenario.scenario_name", read_only=True)

    scenario_source = serializers.SerializerMethodField(read_only=True)
    is_owned = serializers.SerializerMethodField(read_only=True)
    owner_username = serializers.CharField(source="user.username", read_only=True)
    owner_email = serializers.CharField(source="user.email", read_only=True)
    project_name = serializers.SerializerMethodField(read_only=True)

    start_date = serializers.SerializerMethodField(read_only=True)
    end_date = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Scenario
        fields = [
            "id",
            "scenario_name",
            "gtfs_filename",
            "created_datetime",
            "source_type",
            "start_date",
            "end_date",
            "source_scenario_name",
            "osm_graph_status",
            "drm_graph_status",
            "edited_data",
            "edit_state",
            "updated_datetime",
            "scenario_source",
            "is_owned",
            "owner_username",
            "owner_email",
            "project_name",
        ]

    def _get_feed_info(self, obj):
        feed_info = getattr(obj, "_prefetched_feed_info", None)
        if feed_info is None:
            feed_info_list = getattr(obj, "_prefetched_feed_info_list", None)
            if isinstance(feed_info_list, list) and feed_info_list:
                feed_info = feed_info_list[0]
        return feed_info

    def get_start_date(self, obj):
        feed_info = self._get_feed_info(obj)
        return feed_info.feed_start_date if feed_info else None

    def get_end_date(self, obj):
        feed_info = self._get_feed_info(obj)
        return feed_info.feed_end_date if feed_info else None

    def get_is_owned(self, obj):
        current_user = self.context.get("current_user") or getattr(self.context.get("request"), "user", None)
        if not current_user:
            return None
        return obj.user.id == current_user.id

    def get_project_name(self, obj):
        return self.context.get("project_name")

    def get_scenario_source(self, obj):
        current_user = self.context.get("current_user") or getattr(self.context.get("request"), "user", None)
        if not current_user:
            return None
        scenario_owner = obj.user

        if scenario_owner.id == current_user.id:
            return "owned scenario"

        project_name = self.context.get("project_name")
        if project_name:
            return f"{project_name} ({scenario_owner.username})"
        project_id = self.context.get("project_id")
        if project_id:
            return f"project ({scenario_owner.username})"

        return f"shared ({scenario_owner.username})"
