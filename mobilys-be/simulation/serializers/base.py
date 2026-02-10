from rest_framework import serializers


class BaseRequestSerializer(serializers.Serializer):
    """
    Base class for all request serializers.

    Request serializers are responsible for:
    - Validating incoming data
    - Transforming data types
    - Providing default values

    Request serializers must NOT:
    - Contain business logic
    - Access database directly
    - Call services
    """
    pass


class BaseResponseSerializer(serializers.Serializer):
    """
    Base class for all response serializers.

    Response serializers are responsible for:
    - Formatting output data
    - Selecting which fields to expose
    - Transforming data for API response

    Response serializers must NOT:
    - Contain business logic
    - Modify data (only format)
    - Perform complex computations
    """
    pass


class PaginationRequestSerializer(BaseRequestSerializer):
    """Standard pagination request parameters."""
    page = serializers.IntegerField(default=1, min_value=1)
    page_size = serializers.IntegerField(default=50, min_value=1, max_value=1000)
