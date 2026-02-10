from typing import Optional, Tuple


def sort_key_casefold(value: Optional[str]) -> Tuple[str]:
    return ((value or "").lower(),)
