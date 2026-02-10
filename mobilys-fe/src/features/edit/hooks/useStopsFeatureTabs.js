import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import {
  addStopChildSvc,
  deleteStopSvc,
  editStopSvc,
  fetchStopGroups,
  patchStopGroupId,
  patchStopGroupName,
  updateStopGrouping,
  updateStopGroupingMethod,
} from "../../../services/stopService";
import { STOP } from "../../../strings";

export function useStopGroupingTab({ scenarioId }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [loading, setLoading] = React.useState(false);
  const [stopGroupsByName, setStopGroupsByName] = React.useState([]);
  const [stopGroupsById, setStopGroupsById] = React.useState([]);
  const [stopGroupingMethod, setStopGroupingMethod] = React.useState("");

  const loadStopGroups = React.useCallback(async () => {
    const groups = await fetchStopGroups(scenarioId);
    setStopGroupsByName(groups.stops_groups_by_name || []);
    setStopGroupsById(groups.stops_groups_by_id || []);
    setStopGroupingMethod(groups.grouping_method || "");
  }, [scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return undefined;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        await loadStopGroups();
      } catch (err) {
        if (!cancelled) {
          showSnackbar({
            title: err?.message || STOP.stopGroupingTab.snackbar.stopsLoadFailed,
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
  }, [loadStopGroups, scenarioId, showSnackbar]);

  const handleSave = React.useCallback(
    async (pendingMoves, groupingMethod) => {
      try {
        await updateStopGrouping(scenarioId, pendingMoves, groupingMethod);
        await loadStopGroups();
        showSnackbar({
          title: STOP.stopGroupingTab.snackbar.groupingUpdated,
          severity: "success",
        });
      } catch (err) {
        showSnackbar({
          title: err?.message || STOP.stopGroupingTab.snackbar.groupingUpdateFailed,
          severity: "error",
        });
      }
    },
    [loadStopGroups, scenarioId, showSnackbar]
  );

  const handleGroupTypeChange = React.useCallback(
    async (groupingMethod) => {
      try {
        await updateStopGroupingMethod(scenarioId, groupingMethod);
        await loadStopGroups();
        showSnackbar({
          title: STOP.stopGroupingTab.snackbar.groupTypeUpdated,
          severity: "success",
        });
      } catch (err) {
        showSnackbar({
          title: err?.message || STOP.stopGroupingTab.snackbar.groupTypeUpdateFailed,
          severity: "error",
        });
      }
    },
    [loadStopGroups, scenarioId, showSnackbar]
  );

  const handlePatchName = React.useCallback(
    async (stop_group_id, payload) => {
      try {
        await patchStopGroupName(stop_group_id, {
          ...payload,
          scenario_id: scenarioId,
        });
        await loadStopGroups();
        showSnackbar({
          title: STOP.stopGroupingTab.snackbar.groupNameUpdated,
          severity: "success",
        });
      } catch (err) {
        showSnackbar({
          title: err?.message || STOP.stopGroupingTab.snackbar.groupNameUpdateFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [loadStopGroups, scenarioId, showSnackbar]
  );

  const handlePatchId = React.useCallback(
    async (stop_group_id, payload) => {
      try {
        await patchStopGroupId(stop_group_id, {
          ...payload,
          scenario_id: scenarioId,
        });
        await loadStopGroups();
        showSnackbar({
          title: STOP.stopGroupingTab.snackbar.groupIdUpdated,
          severity: "success",
        });
      } catch (err) {
        showSnackbar({
          title: err?.message || STOP.stopGroupingTab.snackbar.groupIdUpdateFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [loadStopGroups, scenarioId, showSnackbar]
  );

  return {
    loading,
    stopGroupsByName,
    stopGroupsById,
    stopGroupingMethod,
    handleSave,
    handleGroupTypeChange,
    handlePatchName,
    handlePatchId,
  };
}

export function useStopsTab({ scenarioId }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [stopAction, setStopAction] = React.useState(null);
  const [stopGroups, setStopGroups] = React.useState(null);
  const [loadingStop, setLoadingStop] = React.useState(false);
  const [stopGroupingMethod, setStopGroupingMethod] = React.useState("");

  const refetchStops = React.useCallback(async () => {
    setLoadingStop(true);
    try {
      const data = await fetchStopGroups(scenarioId);
      setStopGroups(data);
      setStopGroupingMethod(data.grouping_method);
    } catch (err) {
      showSnackbar({
        title: err?.message || STOP.stopGroupingTab.snackbar.stopsLoadFailed,
        severity: "error",
      });
    } finally {
      setLoadingStop(false);
    }
  }, [scenarioId, showSnackbar]);

  React.useEffect(() => {
    if (!scenarioId) return;
    void refetchStops();
  }, [refetchStops, scenarioId]);

  const handleStopFormSubmit = React.useCallback(
    async (values) => {
      try {
        if (stopAction?.type === "edit") {
          await editStopSvc(scenarioId, stopAction.payload.stop_id, values);
          showSnackbar({ title: STOP.stopsTab.snackbar.stopUpdated, severity: "success" });
        } else if (stopAction?.type === "create" || stopAction?.type === "create_child") {
          const baseValue = { ...values, scenario_id: scenarioId || "" };
          if (stopAction?.type === "create") {
            const {
              parent_stop_id: _parent_stop_id,
              parent_stop_source_id: _parent_stop_source_id,
              ...payloadWithoutParent
            } = baseValue;
            await addStopChildSvc(payloadWithoutParent);
            showSnackbar({ title: STOP.stopsTab.snackbar.stopCreated, severity: "success" });
          } else {
            await addStopChildSvc(baseValue);
            showSnackbar({ title: STOP.stopsTab.snackbar.childStopCreated, severity: "success" });
          }
        }
        setStopAction(null);
        await refetchStops();
      } catch (err) {
        showSnackbar({
          title: err?.message || STOP.stopsTab.snackbar.stopSaveFailed,
          severity: "error",
        });
      }
    },
    [refetchStops, scenarioId, showSnackbar, stopAction]
  );

  const handleStopDeleteInline = React.useCallback(
    async (stop) => {
      await deleteStopSvc(scenarioId, stop.stop_id);
      showSnackbar({ title: STOP.stopsTab.snackbar.stopDeleted, severity: "success" });
      setStopAction(null);
      await refetchStops();
    },
    [refetchStops, scenarioId, showSnackbar]
  );

  const handleGroupTypeChange = React.useCallback(
    async (groupingMethod) => {
      try {
        await updateStopGroupingMethod(scenarioId, groupingMethod);
      } catch (err) {
        showSnackbar({
          title: err?.message || STOP.stopGroupingTab.snackbar.groupTypeChangeFailed,
          severity: "error",
        });
        return;
      }

      showSnackbar({
        title: STOP.stopsTab.snackbar.groupTypeChanged,
        severity: "success",
      });
      setStopGroupingMethod(groupingMethod);
      await refetchStops();
    },
    [refetchStops, scenarioId, showSnackbar]
  );

  const onCreate = React.useCallback(() => {
    setStopAction({
      type: "create",
      payload: {
        stop_name: "",
        stop_id: "",
        stop_lat: "",
        stop_lon: "",
      },
    });
  }, []);

  const onCreateChild = React.useCallback(() => {
    setStopAction({
      type: "create_child",
      payload: {
        stop_name: "",
        stop_id: "",
        stop_lat: "",
        stop_lon: "",
      },
    });
  }, []);

  const onEdit = React.useCallback((stop) => {
    const formatted = {
      ...stop,
      stop_lat: Number(stop.stop_lat).toFixed(6),
      stop_lon: Number(stop.stop_lon).toFixed(6),
    };
    setStopAction({ type: "edit", payload: formatted });
  }, []);

  return {
    loadingStop,
    stopGroups,
    stopAction,
    setStopAction,
    stopGroupingMethod,
    handleStopFormSubmit,
    handleStopDeleteInline,
    handleGroupTypeChange,
    onCreate,
    onCreateChild,
    onEdit,
  };
}
