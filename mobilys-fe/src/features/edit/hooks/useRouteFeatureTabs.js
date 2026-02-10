import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import {
  createExistingRoutePattern,
  createRouteGroupKeyword,
  createRoutePattern,
  deleteRouteGroup,
  deleteRoutePattern,
  fetchRouteGroups,
  fetchRoutePattern,
  updateRouteGrouping,
  updateRouteGroupColor,
  updateRouteGroupName,
  updateRoutePattern,
} from "../../../services/routeService";
import { updateShapesBulk } from "../../../services/shapeService";
import { previewShape } from "../../../services/utilService";
import { ROUTE } from "../../../strings";

export function useRouteGroupingTab({ scenarioId }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [loading, setLoading] = React.useState(false);
  const [routeGroups, setRouteGroups] = React.useState([]);
  const [stopGroupsGeojson, setStopGroupsGeojson] = React.useState(null);
  const [routeFilterOption, setRouteFilterOption] = React.useState([]);
  const [routeData, setRouteData] = React.useState([]);

  const loadRouteGroups = React.useCallback(async () => {
    if (!scenarioId) return;
    const groups = await fetchRouteGroups(scenarioId);
    setRouteGroups(groups.routes_grouped_by_keyword || []);
    setStopGroupsGeojson(groups.geojson || null);
    setRouteFilterOption(groups.filter_options || []);
    setRouteData(groups.route_data || []);
  }, [scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return undefined;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        await loadRouteGroups();
      } catch (err) {
        if (!cancelled) {
          showSnackbar({
            title: err?.message || ROUTE.routeGroupingTab.snackbar.loadFailed,
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
  }, [loadRouteGroups, scenarioId, showSnackbar]);

  const handleSave = React.useCallback(
    async (payload) => {
      try {
        await updateRouteGrouping(scenarioId, payload);
        await loadRouteGroups();
        showSnackbar({ title: ROUTE.routeGroupingTab.snackbar.updated, severity: "success" });
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routeGroupingTab.snackbar.updateFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [loadRouteGroups, scenarioId, showSnackbar]
  );

  const handleCreateGroup = React.useCallback(
    async (payload) => {
      try {
        const created = await createRouteGroupKeyword({
          keyword: payload.keyword,
          color: payload.color,
          scenario_id: scenarioId,
        });
        await loadRouteGroups();
        showSnackbar({ title: ROUTE.routeGroupingTab.snackbar.groupCreated, severity: "success" });
        return created;
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routeGroupingTab.snackbar.groupCreateFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [loadRouteGroups, scenarioId, showSnackbar]
  );

  const handleColorSave = React.useCallback(
    async (routeGroupKeywordId, color) => {
      try {
        await updateRouteGroupColor(routeGroupKeywordId, color);
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routeGroupingTab.snackbar.colorUpdateFailed,
          severity: "error",
        });
      }
    },
    [showSnackbar]
  );

  const handleDeleteGroup = React.useCallback(
    async (routeDataParam) => {
      try {
        await deleteRouteGroup(scenarioId, { data: routeDataParam });
        showSnackbar({ title: ROUTE.routeGroupingTab.snackbar.groupDeleted, severity: "success" });
        await loadRouteGroups();
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routeGroupingTab.snackbar.groupDeleteFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [loadRouteGroups, scenarioId, showSnackbar]
  );

  const handleRenameGroup = React.useCallback(
    async ({ keyword_id, keyword }) => {
      try {
        await updateRouteGroupName(keyword_id, keyword);
        showSnackbar({ title: ROUTE.routeGroupingTab.snackbar.groupRenamed, severity: "success" });
        await loadRouteGroups();
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routeGroupingTab.snackbar.groupRenameFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [loadRouteGroups, showSnackbar]
  );

  return {
    loading,
    routeGroups,
    stopGroupsGeojson,
    routeFilterOption,
    routeData,
    handleSave,
    handleCreateGroup,
    handleColorSave,
    handleDeleteGroup,
    handleRenameGroup,
  };
}

export function useRoutePatternTab({ scenarioId }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [routeData, setRouteData] = React.useState([]);
  const [routeGroups, setRouteGroups] = React.useState([]);
  const [loadingRoutes, setLoadingRoutes] = React.useState(false);
  const [loadingRouteActions, setLoadingRouteActions] = React.useState(false);
  const [shapeData, setShapeData] = React.useState([]);

  const refetchRoutes = React.useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const data = await fetchRoutePattern(scenarioId);
      setRouteData(data);
    } catch (err) {
      showSnackbar({
        title: err?.message || ROUTE.routePatternTab.snackbar.routesLoadFailed,
        severity: "error",
      });
      setRouteData([]);
    } finally {
      setLoadingRoutes(false);
    }
  }, [scenarioId, showSnackbar]);

  const loadRouteGroups = React.useCallback(async () => {
    try {
      const groups = await fetchRouteGroups(scenarioId);
      setRouteGroups(groups.routes_grouped_by_keyword || []);
    } catch {
      setRouteGroups([]);
    }
  }, [scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return;
    void refetchRoutes();
    void loadRouteGroups();
  }, [loadRouteGroups, refetchRoutes, scenarioId]);

  const handleSaveRoute = React.useCallback(
    async (routeDataParam) => {
      setLoadingRouteActions(true);
      try {
        await createRoutePattern(routeDataParam);
        showSnackbar({ title: ROUTE.routePatternTab.snackbar.routeCreated, severity: "success" });
        await refetchRoutes();
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routePatternTab.snackbar.routeCreateFailed,
          severity: "error",
        });
        throw err;
      } finally {
        setLoadingRouteActions(false);
      }
    },
    [refetchRoutes, showSnackbar]
  );

  const handleSaveExistingRoute = React.useCallback(
    async (routeDataParam) => {
      setLoadingRouteActions(true);
      try {
        await createExistingRoutePattern(routeDataParam);
        showSnackbar({ title: ROUTE.routePatternTab.snackbar.routeUpdated, severity: "success" });
        await refetchRoutes();
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routePatternTab.snackbar.routeUpdateFailed,
          severity: "error",
        });
        throw err;
      } finally {
        setLoadingRouteActions(false);
      }
    },
    [refetchRoutes, showSnackbar]
  );

  const handleUpdateRoute = React.useCallback(
    async (scenarioIdParam, routeDataParam) => {
      setLoadingRouteActions(true);
      try {
        await updateRoutePattern(scenarioIdParam, routeDataParam);
        showSnackbar({
          title: ROUTE.routePatternTab.snackbar.routePatternUpdated,
          severity: "success",
        });
        await refetchRoutes();
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routePatternTab.snackbar.routeUpdateFailed,
          severity: "error",
        });
        throw err;
      } finally {
        setLoadingRouteActions(false);
      }
    },
    [refetchRoutes, showSnackbar]
  );

  const handleDeleteRoute = React.useCallback(
    async (scenarioIdParam, routeDataParam) => {
      setLoadingRouteActions(true);
      try {
        await deleteRoutePattern(scenarioIdParam, { data: routeDataParam });
        showSnackbar({ title: ROUTE.routePatternTab.snackbar.routeDeleted, severity: "success" });
        await refetchRoutes();
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routePatternTab.snackbar.routeDeleteFailed,
          severity: "error",
        });
        throw err;
      } finally {
        setLoadingRouteActions(false);
      }
    },
    [refetchRoutes, showSnackbar]
  );

  const previewShapeData = React.useCallback(async (payload) => {
    try {
      const data = await previewShape(payload);
      setShapeData(data);
    } catch {
      setShapeData([]);
    }
  }, []);

  const handleUpdateShapesBulk = React.useCallback(
    async (body) => {
      try {
        await updateShapesBulk(scenarioId, body);
        showSnackbar({ title: ROUTE.routePatternTab.snackbar.shapesSaved, severity: "success" });
      } catch (err) {
        showSnackbar({
          title: err?.message || ROUTE.routePatternTab.snackbar.shapesSaveFailed,
          severity: "error",
        });
        throw err;
      }
    },
    [scenarioId, showSnackbar]
  );

  return {
    routeData,
    routeGroups,
    loadingRoutes,
    loadingRouteActions,
    shapeData,
    refetchRoutes,
    handleSaveRoute,
    handleSaveExistingRoute,
    handleUpdateRoute,
    handleDeleteRoute,
    previewShapeData,
    handleUpdateShapesBulk,
  };
}

