from enum import Enum


class StrEnum(str, Enum):
    """Base class for string enums that serialize to JSON properly."""
    
    def __str__(self) -> str:
        return self.value
    
    @classmethod
    def choices(cls):
        """Return choices tuple for Django model fields."""
        return [(item.value, item.name.replace('_', ' ').title()) for item in cls]
    
    @classmethod
    def values(cls):
        """Return list of all values."""
        return [item.value for item in cls]


class RoleLevel(StrEnum):
    """Role level types."""
    SUPER_USER = 'super_user'
    ORGANIZER = 'organizer'
    USER = 'user'
