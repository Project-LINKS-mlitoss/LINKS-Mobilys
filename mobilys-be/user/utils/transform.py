from typing import Any, Callable, Mapping, MutableMapping


def stringify(value: Any) -> str:
    return "" if value is None else str(value)


def stringify_list(values) -> list[str]:
    if values is None:
        return []
    return [str(v) for v in values]


def apply_explicit_nullable_field(
    validated_data: MutableMapping[str, Any],
    raw_data: Mapping[str, Any],
    field: str,
    caster: Callable[[Any], Any],
) -> None:
    """
    Apply a nullable field update based on raw request payload presence.

    - If `field` not provided in raw payload: do nothing.
    - If `field` is explicitly null: set validated_data[field] = None.
    - If `field` is provided and truthy: cast and set it.
    - If `field` is empty string / falsy: do nothing (keeps existing validated value).
    """
    if field not in raw_data:
        return

    raw_value = raw_data.get(field)
    if raw_value is None:
        validated_data[field] = None
        return

    if raw_value:
        validated_data[field] = caster(raw_value)

