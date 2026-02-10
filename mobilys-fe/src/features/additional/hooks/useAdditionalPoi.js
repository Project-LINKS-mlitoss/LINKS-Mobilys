import React from "react";
import { useAuthStore } from "../../../state/authStore";
import { useProjectPrefectureStore } from "../../../state/projectPrefectureStore";
import { useShallow } from "zustand/react/shallow";
import {
  checkPoiFilesSvc,
  commitPoiBatchesSvc,
  deletePoiBatchSvc,
  getPoiDataStrict,
  setActivePoiBatchSvc,
} from "../../../services/poiService";
import { FILE_STATUS } from "../../../constant/file";
import { POI } from "../../../strings";

export function useAdditionalPoi() {
  const projectId = useAuthStore((s) => s.projectId);

  const {
    prefecture,
    availablePrefectures,
    isDefault,
    prefectureLoading,
    prefectureError,
    fetchPrefectureSelection,
    savePrefectureSelection,
  } = useProjectPrefectureStore(
    useShallow((s) => ({
      prefecture: s.prefecture,
      availablePrefectures: s.availablePrefectures,
      isDefault: s.isDefault,
      prefectureLoading: s.loading,
      prefectureError: s.error,
      fetchPrefectureSelection: s.fetchSelection,
      savePrefectureSelection: s.saveSelection,
    }))
  );

  // grouped API
  const [apiData, setApiData] = React.useState({ total: 0, groups: [] });
  const [mapData, setMapData] = React.useState([]);
  const [loadingRes, setLoadingRes] = React.useState(true);

  // uploader / flow
  const [files, setFiles] = React.useState([]);
  const [status, setStatus] = React.useState(FILE_STATUS.IDLE);
  const [csvErrors, setCsvErrors] = React.useState([]);

  // table filters
  const [type, setType] = React.useState(POI.common.all);
  const [batch, setBatch] = React.useState(POI.common.all);
  const [activeBatchId, setActiveBatchId] = React.useState("default");

  // check/commit modal
  const [checkOpen, setCheckOpen] = React.useState(false);
  const [checkData, setCheckData] = React.useState(null);
  const [remarksByFile, setRemarksByFile] = React.useState({});
  const [committing, setCommitting] = React.useState(false);

  // right view toggle (controlled by Uploader)
  const [view, setView] = React.useState("map"); // "map" | "list"

  const fetchPoiData = React.useCallback(async () => {
    setLoadingRes(true);
    try {
      const data = await getPoiDataStrict(); // { total, groups: [...] }
      setApiData({ total: data?.total ?? 0, groups: data?.groups ?? [] });
      setActiveBatchId(
        data?.active_batch_id !== undefined && data?.active_batch_id !== null
          ? data.active_batch_id
          : "default"
      );

      const markers = (data?.groups ?? []).flatMap((g) =>
        (g.items ?? []).map((it) => ({
          id: it.id,
          type: it.type,
          name: it.name,
          lat: Number(it.lat),
          lng: Number(it.lng),
          batchId: g.batch_id,
          fileName: g.file_name,
          remark: it.remark ? it.remark : POI.common.none,
        }))
      );
      setMapData(markers);
    } catch (err) {
      setCsvErrors([err?.message || POI.errors.fetchFailed]);
    } finally {
      setLoadingRes(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchPoiData();
  }, [fetchPoiData]);

  React.useEffect(() => {
    if (projectId) {
      fetchPrefectureSelection(projectId);
    } else {
      // Call without project_id to allow store to apply its fallback logic.
      fetchPrefectureSelection();
    }
  }, [fetchPrefectureSelection, projectId]);

  // uploader handlers
  const onFilesSelected = React.useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const onRemoveFile = React.useCallback((index) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleRetry = React.useCallback(() => {
    setFiles([]);
    setStatus(FILE_STATUS.IDLE);
    setCsvErrors([]);
  }, []);

  const handleCheck = React.useCallback(async () => {
    if (!files.length) return;
    setStatus(FILE_STATUS.UPLOADING);
    try {
      const data = await checkPoiFilesSvc(files);
      setCheckData(data);
      const init = {};
      (data?.batches || []).forEach((b) => (init[b.file] = ""));
      setRemarksByFile(init);
      setCsvErrors([]);
      setCheckOpen(true);
      setStatus(FILE_STATUS.SUCCESS);
    } catch (err) {
      setCsvErrors([err?.message || POI.errors.importFailed]);
      setStatus(FILE_STATUS.ERROR);
    }
  }, [files]);

  const buildCommitPayload = React.useCallback(() => {
    const okFiles = (checkData?.batches || []).filter((b) => (b.valid_rows || []).length > 0);
    return {
      batches: okFiles.map((b) => ({
        file: b.file,
        remark: remarksByFile[b.file] || "",
        rows: (b.valid_rows || []).map((v) => v.row),
      })),
    };
  }, [checkData?.batches, remarksByFile]);

  const handleCommit = React.useCallback(async () => {
    setCommitting(true);
    try {
      await commitPoiBatchesSvc(buildCommitPayload(), projectId);
      setCheckOpen(false);
      setCheckData(null);
      setRemarksByFile({});
      setFiles([]);
      await fetchPoiData();
    } catch (err) {
      setCsvErrors([err?.message || POI.errors.commitFailed]);
    } finally {
      setCommitting(false);
    }
  }, [buildCommitPayload, fetchPoiData, projectId]);

  const handleDeleteBatch = React.useCallback(
    async (batchId) => {
      try {
        await deletePoiBatchSvc(batchId, projectId);
        await fetchPoiData();
      } catch (err) {
        setCsvErrors([err?.message || POI.errors.deleteBatchFailed]);
      }
    },
    [fetchPoiData, projectId]
  );

  const handleSetActiveBatch = React.useCallback(
    async (batchId) => {
      const prev = activeBatchId;
      setActiveBatchId(batchId); // optimistic update
      try {
        await setActivePoiBatchSvc(batchId, projectId);
      } catch (err) {
        setActiveBatchId(prev);
        setCsvErrors([err?.message || POI.errors.setActiveBatchFailed]);
      }
    },
    [activeBatchId, projectId]
  );

  const handleDefaultPrefectureChange = React.useCallback(
    async (value) => {
      try {
        await savePrefectureSelection(value);
      } catch (err) {
        setCsvErrors([err?.message || POI.errors.prefectureSaveFailed]);
      }
    },
    [savePrefectureSelection]
  );

  const handleDownloadTemplate = React.useCallback(() => {
    const content = [POI.template.headers.join(",")].join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = POI.template.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    apiData,
    mapData,
    loadingRes,
    files,
    status,
    csvErrors,
    type,
    setType,
    batch,
    setBatch,
    activeBatchId,
    checkOpen,
    setCheckOpen,
    checkData,
    remarksByFile,
    setRemarksByFile,
    committing,
    view,
    setView,
    prefecture,
    availablePrefectures,
    isDefault,
    prefectureLoading,
    prefectureError,
    onFilesSelected,
    onRemoveFile,
    handleRetry,
    handleCheck,
    handleCommit,
    handleDeleteBatch,
    handleSetActiveBatch,
    handleDefaultPrefectureChange,
    handleDownloadTemplate,
  };
}
