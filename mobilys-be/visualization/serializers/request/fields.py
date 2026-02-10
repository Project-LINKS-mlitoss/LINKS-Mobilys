from rest_framework import serializers


class CommaSeparatedListField(serializers.Field):
    default_error_messages = {
        "invalid": "Invalid list format.",
    }

    def __init__(self, child, **kwargs):
        super().__init__(**kwargs)
        self.child = child
        self.child.bind(field_name="child", parent=self)

    def to_internal_value(self, data):
        if data in (None, "", []):
            return []
        if isinstance(data, (list, tuple)):
            items = []
            for raw in data:
                if isinstance(raw, str):
                    items.extend([part.strip() for part in raw.split(",") if part.strip()])
                else:
                    items.append(raw)
        elif isinstance(data, str):
            items = [part.strip() for part in data.split(",") if part.strip()]
        else:
            self.fail("invalid")
        return [self.child.run_validation(item) for item in items]

    def to_representation(self, value):
        return value
