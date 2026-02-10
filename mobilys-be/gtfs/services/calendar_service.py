from django.db import DatabaseError

from gtfs.models import Calendar, Trips
from gtfs.services.base import log_service_call
from gtfs.constants import ErrorMessages


class CalendarServiceError(Exception):
    def __init__(self, *, message: str, error: str | None, status_code: int):
        super().__init__(message)
        self.message = message
        self.error = error
        self.status_code = status_code


@log_service_call
class CalendarService:
    @staticmethod
    def list_service_ids(*, scenario_id: str | None) -> list[str]:
        if not scenario_id:
            raise CalendarServiceError(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                status_code=400,
            )

        try:
            trips_exist = Trips.objects.filter(scenario_id=scenario_id).exists()
            if not trips_exist:
                raise CalendarServiceError(
                    message=ErrorMessages.TRIPS_NOT_FOUND_JA,
                    error=ErrorMessages.TRIPS_NOT_FOUND_JA,
                    status_code=404,
                )

            trip_service_ids = set(
                Trips.objects.filter(scenario_id=scenario_id)
                .values_list("service_id", flat=True)
                .distinct()
            )
            calendar_service_ids = set(
                Calendar.objects.filter(scenario_id=scenario_id)
                .values_list("service_id", flat=True)
                .distinct()
            )

            all_service_ids = list(trip_service_ids | calendar_service_ids)

            return all_service_ids

        except CalendarServiceError:
            raise
        except DatabaseError as e:
            raise CalendarServiceError(
                message=ErrorMessages.DATABASE_ERROR_JA,
                error=ErrorMessages.CALENDAR_LIST_FETCH_ERROR_JA,
                status_code=500,
            ) from e
        except Exception as e:
            raise CalendarServiceError(
                message=ErrorMessages.UNEXPECTED_ERROR_JA,
                error=ErrorMessages.CALENDAR_LIST_FETCH_ERROR_JA,
                status_code=500,
            ) from e
