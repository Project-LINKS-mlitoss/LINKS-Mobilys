from __future__ import annotations


def safe_serialize(serializer_cls, payload, *, many=None):
    """
    Best-effort serializer wrapper to preserve backward compatibility.

    If the payload doesn't match the serializer (extra keys, type differences, etc.),
    return the original payload unchanged.
    """

    try:
        if many is None:
            many = isinstance(payload, list)
        return serializer_cls(payload, many=many).data
    except Exception:
        return payload
