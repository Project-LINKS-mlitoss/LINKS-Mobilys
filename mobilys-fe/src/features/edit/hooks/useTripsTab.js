import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { TRIP } from "../../../strings";
import {
  bulkDeleteTrips,
  createTrip,
  editTrip,
  getDetailTrip,
  getTrip,
} from "../../../services/tripService";
import { previewShape } from "../../../services/utilService";
import { getEditScenarioContextSvc } from "../../../services/scenarioService";
import { getStops } from "../../../services/stopService";
import { fetchRouteGroups } from "../../../services/routeService";

export function useTripsTab({ scenarioId }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [tripEditData, setTripEditData] = React.useState(null);
  const [loadingEditTrips, setLoadingEditTrips] = React.useState(false);
  const [tripSubTab, setTripSubTab] = React.useState(0);
  const [loadingTripActions, setLoadingTripActions] = React.useState(false);
  const [calendarData, setCalendarData] = React.useState([]);
  const [stopsData, setStopsData] = React.useState([]);
  const [routeGroups, setRouteGroups] = React.useState([]);
  const [shapeData, setShapeData] = React.useState([]);

  const fetchTrips = React.useCallback(async () => {
    if (!scenarioId) return;
    setLoadingEditTrips(true);
    try {
      const data = await getTrip(scenarioId);
      setTripEditData(data || []);
    } catch (err) {
      showSnackbar({
        title: err?.message || TRIP.tripTab.snackbar.tripsLoadFailed,
        severity: "error",
      });
      setTripEditData([]);
    } finally {
      setLoadingEditTrips(false);
    }
  }, [scenarioId, showSnackbar]);

  React.useEffect(() => {
    if (!scenarioId) return undefined;
    let cancelled = false;

    const run = async () => {
      await fetchTrips();

      try {
        const ctx = await getEditScenarioContextSvc(scenarioId);
        if (!cancelled) setCalendarData(ctx);
      } catch (err) {
        if (!cancelled) {
          showSnackbar({ title: err?.message, severity: "error" });
        }
      }

      try {
        const data = await getStops(scenarioId);
        if (!cancelled) setStopsData(data?.data || []);
      } catch (err) {
        if (!cancelled) {
          showSnackbar({ title: err?.message, severity: "error" });
        }
      }

      try {
        const groups = await fetchRouteGroups(scenarioId);
        if (!cancelled) {
          setRouteGroups(groups?.routes_grouped_by_keyword || []);
        }
      } catch {
        if (!cancelled) setRouteGroups([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchTrips, scenarioId, showSnackbar]);

  const handleBulkDeleteTrip = React.useCallback(
    async (scenarioIdParam, tripIds) => {
      try {
        await bulkDeleteTrips(scenarioIdParam, tripIds);
        showSnackbar({ title: TRIP.tripTab.snackbar.tripsDeleted, severity: "success" });
        await fetchTrips();
      } catch (err) {
        showSnackbar({
          title: err?.message || TRIP.tripTab.snackbar.tripsDeleteFailed,
          severity: "error",
        });
      }
    },
    [fetchTrips, showSnackbar]
  );

  const fetchDetailTrip = React.useCallback(
    async (tripId) => {
      try {
        const data = await getDetailTrip(scenarioId, tripId);
        return data.data;
      } catch (err) {
        showSnackbar({
          title: err?.message || TRIP.tripTab.snackbar.tripDetailLoadFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [scenarioId, showSnackbar]
  );

  const createNewTrip = React.useCallback(
    async (data) => {
      setLoadingTripActions(true);
      try {
        await createTrip(data);
        showSnackbar({ title: TRIP.tripTab.snackbar.tripCreated, severity: "success" });
        await fetchTrips();
        setTripSubTab(0);
      } catch (err) {
        showSnackbar({
          title: err?.message || TRIP.tripTab.snackbar.tripCreateFailed,
          severity: "error",
        });
        throw err;
      } finally {
        setLoadingTripActions(false);
      }
    },
    [fetchTrips, showSnackbar]
  );

  const editTripData = React.useCallback(
    async (tripId, data) => {
      setLoadingTripActions(true);
      try {
        await editTrip(scenarioId, tripId, data);
        showSnackbar({ title: TRIP.tripTab.snackbar.tripUpdated, severity: "success" });
        await fetchTrips();
        setTripSubTab(0);
      } catch (err) {
        showSnackbar({
          title: err?.message || TRIP.tripTab.snackbar.tripUpdateFailed,
          severity: "error",
        });
        throw err;
      } finally {
        setLoadingTripActions(false);
      }
    },
    [fetchTrips, scenarioId, showSnackbar]
  );

  const previewShapeData = React.useCallback(async (payload) => {
    try {
      const data = await previewShape(payload);
      setShapeData(data);
    } catch (err) {
      void err;
    }
  }, []);

  return {
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
  };
}
