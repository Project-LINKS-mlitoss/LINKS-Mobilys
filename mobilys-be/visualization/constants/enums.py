# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from enum import Enum

# Enums for number of buses running visualization
class Weekday(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class StopGroupingMethod(str, Enum):
    STOP_NAME = "stop_name"
    STOP_ID = "stop_id"


class StopGroupingLabel(str, Enum):
    STOP_NAME = "停留所名"
    STOP_ID = "停留所ID"


# Enums for buffer analysis visualization
class MLITDatasetLabel(str, Enum):
    NLNI_KSJ_P29 = "学校"
    NLNI_KSJ_P04 = "病院"

    @classmethod
    def from_dataset_id(cls, dataset_id: str):
        if dataset_id == "nlni_ksj-p29":
            return cls.NLNI_KSJ_P29
        if dataset_id == "nlni_ksj-p04":
            return cls.NLNI_KSJ_P04
        return None


class MLITDataset(str, Enum):
    NLNI_KSJ_P04 = "nlni_ksj-p04"
    NLNI_KSJ_P29 = "nlni_ksj-p29"

    @property
    def english_label(self):
        if self is MLITDataset.NLNI_KSJ_P04:
            return "hospital"
        if self is MLITDataset.NLNI_KSJ_P29:
            return "school"
        return ""

