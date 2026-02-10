import json
from typing import Dict
from app import config


class RouterStore:
    def load(self) -> Dict[str, int]:
        if not config.ROUTER_MAP_FILE.exists():
            return {}
        with config.ROUTER_MAP_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)

    def save(self, router_map: Dict[str, int]) -> None:
        with config.ROUTER_MAP_FILE.open("w", encoding="utf-8") as f:
            json.dump(router_map, f, indent=2)