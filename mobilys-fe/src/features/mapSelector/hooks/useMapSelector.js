import React from "react";
import { useAuthStore } from "../../../state/authStore";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { MAP } from "../../../strings";
import { fetchMapListSvc, updateUserMapSvc } from "../../../services/mapService";

export function useMapSelector() {
  const ui = MAP.selector;
  const mapUrl = useAuthStore((s) => s.mapUrl);
  const setMapUrl = useAuthStore((s) => s.setMapUrl);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [mapList, setMapList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);

  const loadMapList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMapListSvc();
      setMapList(Array.isArray(res) ? res : []);
    } catch {
      showSnackbar?.({ title: ui.snackbar.loadMapListFailed, severity: "error" });
      setMapList([]);
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, ui.snackbar.loadMapListFailed]);

  React.useEffect(() => {
    loadMapList();
  }, [loadMapList]);

  const currentId = React.useMemo(() => {
    return mapList.find((m) => String(m.url) === String(mapUrl))?.id || mapList[0]?.id || "";
  }, [mapList, mapUrl]);

  const handleChange = React.useCallback(
    async (e) => {
      const newId = e.target.value;
      const idStr = String(newId);
      const newMap = mapList.find((m) => String(m.id) === idStr);
      if (!newMap) return;

      setPending(true);
      setMapReady(false);
      try {
        const res = await updateUserMapSvc({ map_id: newId });
        setMapUrl(res?.url);
      } catch {
        showSnackbar?.({ title: ui.snackbar.updateMapFailed, severity: "error" });
      } finally {
        setPending(false);
      }
    },
    [mapList, setMapUrl, showSnackbar, ui.snackbar.updateMapFailed]
  );

  return {
    ui,
    mapUrl,
    mapList,
    loading,
    pending,
    mapReady,
    setMapReady,
    currentId,
    handleChange,
    reload: loadMapList,
  };
}

