import React from "react";
import { Stack, CircularProgress } from "@mui/material";
import TripPatternEditTab from "../../components/edit/TripEdit/TripPatternEdit";
import { useTripsTab } from "./hooks/useTripsTab";

function TripsTab({ scenarioId }) {
  const {
    tripEditData,
    loadingEditTrips,
    tripSubTab,
    setTripSubTab,
    loadingTripActions,
    calendarData,
    stopsData,
    routeGroups,
    shapeData,
    fetchTrips,
    handleBulkDeleteTrip,
    fetchDetailTrip,
    createNewTrip,
    editTripData,
    previewShapeData,
  } = useTripsTab({ scenarioId });

  if (
    loadingEditTrips ||
    !tripEditData ||
    (!calendarData || (Array.isArray(calendarData) && calendarData.length === 0)) ||
    stopsData.length === 0
  ) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <TripPatternEditTab
      routeGroups={routeGroups}
      tripData={tripEditData}
      scenarioId={scenarioId}
      tabIndex={tripSubTab}
      setTabIndex={(v) => setTripSubTab(v)}
      calendarData={calendarData}
      stopsData={stopsData}
      onDelete={handleBulkDeleteTrip}
      onFetchDetail={fetchDetailTrip}
      onSave={createNewTrip}
      onEdit={editTripData}
      onRefetchTrips={fetchTrips}
      loadingTripActions={loadingTripActions}
      loadingEditTrips={loadingEditTrips}
      shapeData={shapeData}
      previewShapeData={previewShapeData}
      showTabs={false}
    />
  );
}

export default TripsTab;

