# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import json
import logging
from typing import Dict
from app import config

logger = logging.getLogger(__name__)


class RouterStore:
    def load(self) -> Dict[str, int]:
        if not config.ROUTER_MAP_FILE.exists():
            return {}
        try:
            with config.ROUTER_MAP_FILE.open("r", encoding="utf-8-sig") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                logger.warning("router_map.json is not a JSON object; ignoring invalid content.")
                return {}
            return data
        except json.JSONDecodeError as exc:
            logger.warning(f"Failed to parse router_map.json; ignoring invalid content: {exc}")
            return {}

    def save(self, router_map: Dict[str, int]) -> None:
        with config.ROUTER_MAP_FILE.open("w", encoding="utf-8") as f:
            json.dump(router_map, f, indent=2)
