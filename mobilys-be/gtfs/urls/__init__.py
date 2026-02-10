"""GTFS URL configuration.

Refactor item #5 (URL Organization):
- Keep all URL paths stable for FE compatibility.
- Split endpoints by feature/resource into modular URL modules.
"""

from __future__ import annotations

from gtfs.urls.calendar_urls import urlpatterns as calendar_urlpatterns
from gtfs.urls.health_urls import urlpatterns as health_urlpatterns
from gtfs.urls.maps_urls import urlpatterns as maps_urlpatterns
from gtfs.urls.notifications_urls import urlpatterns as notifications_urlpatterns
from gtfs.urls.ridership_urls import urlpatterns as ridership_urlpatterns
from gtfs.urls.route_patterns_urls import urlpatterns as route_patterns_urlpatterns
from gtfs.urls.routes_urls import urlpatterns as routes_urlpatterns
from gtfs.urls.scenario_urls import urlpatterns as scenario_urlpatterns
from gtfs.urls.shapes_urls import urlpatterns as shapes_urlpatterns
from gtfs.urls.stops_urls import urlpatterns as stops_urlpatterns
from gtfs.urls.trip_frequency_urls import urlpatterns as trip_frequency_urlpatterns
from gtfs.urls.trips_urls import urlpatterns as trips_urlpatterns
from gtfs.urls.validation_urls import urlpatterns as validation_urlpatterns

urlpatterns = (
    []
    # Router-driven APIs first (same behavior as the old monolithic urls.py)
    + scenario_urlpatterns
    + validation_urlpatterns
    + shapes_urlpatterns
    + stops_urlpatterns
    + routes_urlpatterns
    + trip_frequency_urlpatterns
    + route_patterns_urlpatterns
    + calendar_urlpatterns
    + maps_urlpatterns
    # Remaining feature endpoints
    + trips_urlpatterns
    + notifications_urlpatterns
    + health_urlpatterns
    + ridership_urlpatterns
)

