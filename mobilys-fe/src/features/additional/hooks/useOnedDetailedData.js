import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { RIDERSHIP } from "../../../strings";
import { getUserScenarios } from "../../../services/scenarioService";
import {
  deleteRidershipUploadSvc,
  exportRidershipUploadSvc,
  getRidershipUploadDetailSvc,
  listRidershipRecordsSvc,
  listRidershipUploadsSvc,
} from "../../../services/ridershipService";
import { downloadBlob } from "../../../utils/downloadBlob";

const LS_SCENARIO_KEY = "ridership_selected_scenario_id";
const RIDERSHIP_UPLOAD_SELECT_STATUS_VALUES = ["completed", "partial"];

const DETAILS_PAGE_SIZE = 50;

const SUB_TABS = {
  uploads: "uploads",
  records: "records",
};

function mergeErrorSummary(prev, next, errorType = "") {
  if (!errorType) return next;
  const prevSummary = Array.isArray(prev?.error_summary) ? prev.error_summary : [];
  const nextSummary = Array.isArray(next?.error_summary) ? next.error_summary : [];
  if (prevSummary.length === 0) return next;

  const nextItem = nextSummary.find((s) => s?.error_type === errorType);
  if (!nextItem) return { ...prev, ...next };

  const nextKey =
    nextItem?.group_key ||
    (nextItem?.field_name ? `${nextItem.error_type}:${nextItem.field_name}` : nextItem?.error_type);

  const mergedSummary = prevSummary.map((s) => {
    const key = s?.group_key || (s?.field_name ? `${s.error_type}:${s.field_name}` : s?.error_type);
    return key === nextKey ? nextItem : s;
  });
  return { ...prev, ...next, error_summary: mergedSummary };
}

export function useOnedDetailedData() {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [subTab, setSubTab] = React.useState(SUB_TABS.uploads);

  // scenarios
  const [scenarios, setScenarios] = React.useState([]);
  const [scenarioId, setScenarioId] = React.useState("");
  const [scenarioLoading, setScenarioLoading] = React.useState(false);
  const [scenarioError, setScenarioError] = React.useState("");

  // upload modal
  const [uploadOpen, setUploadOpen] = React.useState(false);

  // uploads list
  const [uploadsLoading, setUploadsLoading] = React.useState(false);
  const [uploadsError, setUploadsError] = React.useState("");
  const [uploads, setUploads] = React.useState([]);
  const [uploadsPagination, setUploadsPagination] = React.useState(null);
  const [uploadsPage, setUploadsPage] = React.useState(1);
  const [searchText, setSearchText] = React.useState("");
  const [uploadsForSelect, setUploadsForSelect] = React.useState([]);
  const [exportingUpload, setExportingUpload] = React.useState(false);

  // detail
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");
  const [detailUploadId, setDetailUploadId] = React.useState("");
  const [detailData, setDetailData] = React.useState(null);
  const [errorGroupPages, setErrorGroupPages] = React.useState({});

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  // records list
  const [recordsLoading, setRecordsLoading] = React.useState(false);
  const [recordsError, setRecordsError] = React.useState("");
  const [records, setRecords] = React.useState([]);
  const [recordsPagination, setRecordsPagination] = React.useState(null);
  const [recordsPage, setRecordsPage] = React.useState(1);
  const [recordFilters, setRecordFilters] = React.useState({
    upload_id: "",
    start_date: "",
    end_date: "",
    boarding_station: "",
    alighting_station: "",
  });

  const scenarioOptions = React.useMemo(
    () =>
      (scenarios || []).map((s) => ({
        id: s?.id,
        label: s?.scenario_name || s?.name || s?.label || s?.id,
      })),
    [scenarios]
  );

  const uploadOptions = React.useMemo(
    () =>
      (uploadsForSelect || []).map((u) => ({
        id: u?.id,
        ridership_record_name: u?.ridership_record_name,
        file_name: u?.file_name,
      })),
    [uploadsForSelect]
  );

  const loadScenarios = React.useCallback(async () => {
    setScenarioLoading(true);
    setScenarioError("");
    try {
      const items = (await getUserScenarios(true)) || [];
      setScenarios(items);

      const saved = localStorage.getItem(LS_SCENARIO_KEY);
      const hasSaved = saved && items.some((s) => s?.id === saved);
      setScenarioId(hasSaved ? saved : items?.[0]?.id || "");
    } catch (err) {
      const msg = err?.message || "";
      setScenarioError(msg);
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const loadUploads = React.useCallback(
    async (page = 1) => {
      if (!scenarioId) return;
      setUploadsLoading(true);
      setUploadsError("");
      try {
        const { items, pagination } = await listRidershipUploadsSvc({
          scenarioId,
          params: { page, page_size: 20 },
        });
        setUploads(items || []);
        setUploadsPagination(pagination || null);
      } catch (err) {
        setUploadsError(err?.message || "");
      } finally {
        setUploadsLoading(false);
      }
    },
    [scenarioId]
  );

  const loadUploadsForSelect = React.useCallback(async () => {
    if (!scenarioId) return;
    setUploadsForSelect([]);
    try {
      const { items } = await listRidershipUploadsSvc({
        scenarioId,
        params: {
          page: 1,
          page_size: 200,
          status: RIDERSHIP_UPLOAD_SELECT_STATUS_VALUES.join(","),
        },
      });
      setUploadsForSelect((items || []).filter((u) => u?.upload_status !== "failed"));
    } catch {
      setUploadsForSelect([]);
    }
  }, [scenarioId]);

  const loadDetail = React.useCallback(
    async ({ errorType = "", fieldName = "", detailsPage = 1 } = {}) => {
      if (!scenarioId || !detailUploadId) return;
      setDetailLoading(true);
      setDetailError("");
      try {
        const data = await getRidershipUploadDetailSvc({
          scenarioId,
          uploadId: detailUploadId,
          params: {
            ...(errorType ? { error_type: errorType } : {}),
            ...(fieldName ? { field_name: fieldName } : {}),
            ...(detailsPage ? { details_page: detailsPage } : {}),
            details_page_size: DETAILS_PAGE_SIZE,
          },
        });
        setDetailData((prev) => (errorType ? mergeErrorSummary(prev, data, errorType) : data));
      } catch (err) {
        setDetailError(err?.message || "");
      } finally {
        setDetailLoading(false);
      }
    },
    [detailUploadId, scenarioId]
  );

  const loadRecords = React.useCallback(
    async (page = 1, filters = {}) => {
      if (!scenarioId) return;
      if (!filters?.upload_id) {
        setRecords([]);
        setRecordsPagination(null);
        setRecordsError("");
        return;
      }
      setRecordsLoading(true);
      setRecordsError("");
      try {
        const params = {
          page,
          page_size: 50,
          upload_id: filters.upload_id,
        };
        if (filters?.start_date) params.start_date = filters.start_date;
        if (filters?.end_date) params.end_date = filters.end_date;
        if (filters?.boarding_station) params.boarding_station = filters.boarding_station;
        if (filters?.alighting_station) params.alighting_station = filters.alighting_station;

        const { items, pagination } = await listRidershipRecordsSvc({ scenarioId, params });
        setRecords(items || []);
        setRecordsPagination(pagination || null);
      } catch (err) {
        setRecordsError(err?.message || "");
      } finally {
        setRecordsLoading(false);
      }
    },
    [scenarioId]
  );

  React.useEffect(() => {
    void loadScenarios();
  }, [loadScenarios]);

  React.useEffect(() => {
    if (!scenarioId) return;
    localStorage.setItem(LS_SCENARIO_KEY, scenarioId);
  }, [scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return;
    setUploadsPage(1);
    setRecordsPage(1);
    void loadUploads(1);
    void loadUploadsForSelect();
  }, [loadUploads, loadUploadsForSelect, scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return;
    const firstId = uploadsForSelect?.[0]?.id || "";
    if (!firstId) return;

    setRecordFilters((prev) => {
      const current = prev?.upload_id || "";
      const exists = uploadsForSelect.some((u) => u?.id === current);
      return exists ? prev : { ...prev, upload_id: firstId };
    });
    setRecordsPage(1);
  }, [scenarioId, uploadsForSelect]);

  React.useEffect(() => {
    if (!scenarioId) return;
    if (subTab !== SUB_TABS.uploads) return;
    void loadUploads(uploadsPage);
  }, [loadUploads, scenarioId, subTab, uploadsPage]);

  React.useEffect(() => {
    if (!scenarioId) return;
    if (subTab !== SUB_TABS.records) return;
    void loadRecords(recordsPage, recordFilters);
  }, [loadRecords, recordFilters, recordsPage, scenarioId, subTab]);

  React.useEffect(() => {
    if (!detailOpen || !scenarioId || !detailUploadId) return;
    void loadDetail();
  }, [detailOpen, detailUploadId, loadDetail, scenarioId]);

  const openDetail = React.useCallback(
    (upload) => {
      const id = upload?.id;
      if (!id) return;
      setDetailUploadId(id);
      setErrorGroupPages({});
      setDetailData(null);
      setDetailError("");
      setDetailOpen(true);
    },
    []
  );

  const handleErrorGroupPageChange = React.useCallback(
    async ({ groupKey, errorType, fieldName, page }) => {
      if (!groupKey || !errorType || !page) return;
      setErrorGroupPages((prev) => ({ ...prev, [groupKey]: page }));
      await loadDetail({ errorType, fieldName, detailsPage: page });
    },
    [loadDetail]
  );

  const confirmDelete = React.useCallback(
    (target) => {
      if (!target) {
        setDeleteTarget(null);
        return;
      }
      if (!target?.id || !scenarioId) return;
      setDeleteTarget(target);
    },
    [scenarioId]
  );

  const closeDeleteDialog = React.useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleExportUpload = React.useCallback(
    async (upload, format = "csv") => {
      if (!scenarioId || !upload?.id) return;
      setExportingUpload(true);
      try {
        const { blob, filename, recordCount } = await exportRidershipUploadSvc({
          scenarioId,
          uploadId: upload.id,
          params: { format },
        });

        const name = upload?.ridership_record_name || "ridership_upload";
        const fallback = `${name}.${format}`;
        downloadBlob(blob, filename || fallback);

        showSnackbar?.({
          title: `${RIDERSHIP.oneDetailed.snackbar.exportCompleted}${
            recordCount
              ? RIDERSHIP.oneDetailed.snackbar.exportCountSuffixTemplate.replace(
                  "{count}",
                  String(recordCount)
                )
              : ""
          }`,
          severity: "success",
        });
      } catch (err) {
        showSnackbar?.({
          title: err?.message || RIDERSHIP.oneDetailed.snackbar.exportFailed,
          severity: "error",
        });
      } finally {
        setExportingUpload(false);
      }
    },
    [scenarioId, showSnackbar]
  );

  const runDelete = React.useCallback(async () => {
    if (!deleteTarget?.id || !scenarioId) return;
    setDeleteLoading(true);
    try {
      const res = await deleteRidershipUploadSvc({ scenarioId, uploadId: deleteTarget.id });
      showSnackbar?.({
        title: res?.message || RIDERSHIP.oneDetailed.snackbar.deleted,
        severity: "success",
      });

      await loadUploads(uploadsPage);
      await loadUploadsForSelect();
      await loadRecords(recordsPage, recordFilters);

      if (detailUploadId === deleteTarget.id) {
        setDetailOpen(false);
        setDetailUploadId("");
        setDetailData(null);
      }
    } catch (err) {
      showSnackbar?.({
        title: err?.message || RIDERSHIP.oneDetailed.snackbar.deleteFailed,
        severity: "error",
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }, [
    deleteTarget?.id,
    detailUploadId,
    loadRecords,
    loadUploads,
    loadUploadsForSelect,
    recordFilters,
    recordsPage,
    scenarioId,
    showSnackbar,
    uploadsPage,
  ]);

  const handleUploaded = React.useCallback(async () => {
    await loadUploads(1);
    await loadUploadsForSelect();
    setUploadsPage(1);
  }, [loadUploads, loadUploadsForSelect]);

  const closeDetail = React.useCallback(() => {
    setDetailOpen(false);
    setDetailUploadId("");
    setDetailData(null);
    setDetailError("");
    setErrorGroupPages({});
  }, []);

  return {
    showSnackbar,
    subTab,
    setSubTab,
    scenarioOptions,
    scenarioId,
    setScenarioId,
    scenarioLoading,
    scenarioError,
    uploadOpen,
    setUploadOpen,
    uploadsLoading,
    uploadsError,
    uploads,
    uploadsPagination,
    uploadsPage,
    setUploadsPage,
    searchText,
    setSearchText,
    uploadsForSelect,
    uploadOptions,
    exportingUpload,
    detailOpen,
    closeDetail,
    detailLoading,
    detailError,
    detailData,
    errorGroupPages,
    handleErrorGroupPageChange,
    openDetail,
    recordFilters,
    setRecordFilters,
    recordsLoading,
    recordsError,
    records,
    recordsPagination,
    recordsPage,
    setRecordsPage,
    confirmDelete,
    deleteTarget,
    deleteLoading,
    closeDeleteDialog,
    runDelete,
    handleExportUpload,
    handleUploaded,
  };
}
