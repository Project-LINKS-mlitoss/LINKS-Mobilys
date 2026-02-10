from rest_framework.response import Response
from rest_framework import status as http_status
from typing import Any, Optional, Dict, List, Union


class BaseResponse(Response):
    """
    Standardized API response wrapper.
    All API endpoints MUST use this class instead of DRF's Response.
    
    Success Response Structure:
    {
        "data": <any>,
        "message": "Success message",
        "error": null
    }
    
    Error Response Structure:
    {
        "data": null,
        "message": "Error message",
        "error": "Detailed error information"
    }
    """
    
    def __init__(
        self,
        data: Any = None,
        message: str = '',
        error: Optional[Union[str, Dict, List]] = None,
        status_code: int = http_status.HTTP_200_OK,
        **kwargs
    ):
        payload = {
            "data": data,
            "message": message,
            "error": error
        }
        super().__init__(data=payload, status=status_code, **kwargs)
    
    @classmethod
    def success(
        cls,
        data: Any = None,
        message: str = "Success",
        status_code: int = http_status.HTTP_200_OK
    ) -> 'BaseResponse':
        """
        Create a success response.
        
        Usage:
            return BaseResponse.success(data=user_data, message="User created")
            return BaseResponse.success(data=items, message="Items retrieved")
        """
        return cls(data=data, message=message, error=None, status_code=status_code)
    
    @classmethod
    def created(
        cls,
        data: Any = None,
        message: str = "Created successfully"
    ) -> 'BaseResponse':
        """Create a 201 Created response."""
        return cls.success(data=data, message=message, status_code=http_status.HTTP_201_CREATED)
    
    @classmethod
    def no_content(cls, message: str = "Deleted successfully") -> 'BaseResponse':
        """Create a 204 No Content response."""
        return cls(data=None, message=message, error=None, status_code=http_status.HTTP_204_NO_CONTENT)
    
    @classmethod
    def error(
        cls,
        message: str,
        error: Optional[Union[str, Dict, List]] = None,
        status_code: int = http_status.HTTP_400_BAD_REQUEST
    ) -> 'BaseResponse':
        """
        Create an error response.
        
        Usage:
            return BaseResponse.error(message="Validation failed", error=serializer.errors)
            return BaseResponse.error(message="Not found", status_code=404)
        """
        return cls(data=None, message=message, error=error or message, status_code=status_code)
    
    @classmethod
    def bad_request(
        cls,
        message: str = "Bad request",
        error: Optional[Union[str, Dict, List]] = None
    ) -> 'BaseResponse':
        """Create a 400 Bad Request response."""
        return cls.error(message=message, error=error, status_code=http_status.HTTP_400_BAD_REQUEST)
    
    @classmethod
    def unauthorized(
        cls,
        message: str = "Unauthorized",
        error: Optional[str] = None
    ) -> 'BaseResponse':
        """Create a 401 Unauthorized response."""
        return cls.error(message=message, error=error, status_code=http_status.HTTP_401_UNAUTHORIZED)
    
    @classmethod
    def forbidden(
        cls,
        message: str = "Forbidden",
        error: Optional[str] = None
    ) -> 'BaseResponse':
        """Create a 403 Forbidden response."""
        return cls.error(message=message, error=error, status_code=http_status.HTTP_403_FORBIDDEN)
    
    @classmethod
    def not_found(
        cls,
        message: str = "Not found",
        error: Optional[str] = None
    ) -> 'BaseResponse':
        """Create a 404 Not Found response."""
        return cls.error(message=message, error=error, status_code=http_status.HTTP_404_NOT_FOUND)
    
    @classmethod
    def internal_error(
        cls,
        message: str = "Internal server error",
        error: Optional[str] = None
    ) -> 'BaseResponse':
        """Create a 500 Internal Server Error response."""
        return cls.error(message=message, error=error, status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR)