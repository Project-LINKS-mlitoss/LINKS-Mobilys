import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { CALENDAR } from "../../../strings";
import { editScenario, getEditScenarioContextSvc } from "../../../services/scenarioService";
import { ERRORS as ERROR_MESSAGES } from "../../../constant";

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useCalendarTab({ scenarioId, onScenarioNameChange }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [scenarioCtx, setScenarioCtx] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const refreshContext = React.useCallback(async () => {
    if (!scenarioId) return;
    const data = await getEditScenarioContextSvc(scenarioId);
    setScenarioCtx(data);
    if (onScenarioNameChange && data?.scenario_name) {
      onScenarioNameChange(data.scenario_name);
    }
  }, [onScenarioNameChange, scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return undefined;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getEditScenarioContextSvc(scenarioId);
        if (cancelled) return;
        setScenarioCtx(data);
        if (onScenarioNameChange && data?.scenario_name) {
          onScenarioNameChange(data.scenario_name);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || CALENDAR.tab.error.loadFailed);
          showSnackbar({
            title: err?.message || CALENDAR.tab.error.loadFailed,
            severity: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onScenarioNameChange, scenarioId, showSnackbar]);

  const scenarioStart = toDateOrNull(scenarioCtx?.feed_info?.start_date);
  const scenarioEnd = toDateOrNull(scenarioCtx?.feed_info?.end_date);

  const initialCalendar = React.useMemo(
    () =>
      (scenarioCtx?.calendar || []).map((r) => ({
        service_id: r.service_id,
        monday: r.monday,
        tuesday: r.tuesday,
        wednesday: r.wednesday,
        thursday: r.thursday,
        friday: r.friday,
        saturday: r.saturday,
        sunday: r.sunday,
        useScenarioDates:
          r.start_date === scenarioCtx?.feed_info?.start_date &&
          r.end_date === scenarioCtx?.feed_info?.end_date,
        start_date: toDateOrNull(r.start_date),
        end_date: toDateOrNull(r.end_date),
      })),
    [scenarioCtx]
  );

  const initialCalendarDates = React.useMemo(
    () =>
      (scenarioCtx?.calendar_dates || []).map((r) => ({
        service_id: r.service_id,
        date: toDateOrNull(r.date),
        exception_type: r.exception_type,
      })),
    [scenarioCtx]
  );

  const onSaveCalendar = React.useCallback(
    async (calendar) => {
      try {
        await editScenario(
          scenarioId,
          { calendar },
          { fallbackMessage: ERROR_MESSAGES.calendar.updateCalendar }
        );
        await refreshContext();
        showSnackbar({ title: CALENDAR.tab.snackbar.saveCalendarSuccess, severity: "success" });
      } catch (err) {
        showSnackbar({
          title: err?.message || CALENDAR.tab.snackbar.saveFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [refreshContext, scenarioId, showSnackbar]
  );

  const onSaveCalendarDates = React.useCallback(
    async (calendar_dates) => {
      try {
        await editScenario(
          scenarioId,
          { calendar_dates },
          { fallbackMessage: ERROR_MESSAGES.calendar.updateCalendarDates }
        );
        await refreshContext();
        showSnackbar({
          title: CALENDAR.tab.snackbar.saveCalendarDatesSuccess,
          severity: "success",
        });
      } catch (err) {
        showSnackbar({
          title: err?.message || CALENDAR.tab.snackbar.saveFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [refreshContext, scenarioId, showSnackbar]
  );

  return {
    loading,
    error,
    scenarioStart,
    scenarioEnd,
    initialCalendar,
    initialCalendarDates,
    onSaveCalendar,
    onSaveCalendarDates,
  };
}
