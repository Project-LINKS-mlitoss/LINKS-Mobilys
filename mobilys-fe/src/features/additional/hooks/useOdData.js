// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { RIDERSHIP } from "../../../strings";
import { getUserScenarios } from "../../../services/scenarioService";
import { convertOneDetailedToOdCsvSvc, listRidershipUploadsSvc } from "../../../services/ridershipService";
import { downloadBlob } from "../../../utils/downloadBlob";

const LS_SCENARIO_KEY = "ridership_selected_scenario_id";

export function useOdData() {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const ui = RIDERSHIP.odData;

  const [scenarios, setScenarios] = React.useState([]);
  const [scenarioId, setScenarioId] = React.useState("");
  const [scenarioLoading, setScenarioLoading] = React.useState(false);
  const [scenarioError, setScenarioError] = React.useState("");

  const [uploadsLoading, setUploadsLoading] = React.useState(false);
  const [uploadsError, setUploadsError] = React.useState("");
  const [uploads, setUploads] = React.useState([]);
  const [uploadsPagination, setUploadsPagination] = React.useState(null);
  const [uploadsPage, setUploadsPage] = React.useState(1);

  const [searchText, setSearchText] = React.useState("");
  const [exportingId, setExportingId] = React.useState("");
  const [confirmTarget, setConfirmTarget] = React.useState(null);

  const scenarioOptions = React.useMemo(
    () =>
      (scenarios || []).map((s) => ({
        id: s?.id,
        label: s?.scenario_name || s?.name || s?.label || s?.id,
      })),
    [scenarios]
  );

  const filteredUploads = React.useMemo(() => {
    const normalized = Array.isArray(uploads) ? uploads : [];
    if (!searchText.trim()) return normalized;
    const q = searchText.trim().toLowerCase();
    return normalized.filter((u) => {
      return (
        String(u?.ridership_record_name || "").toLowerCase().includes(q) ||
        String(u?.file_name || "").toLowerCase().includes(q)
      );
    });
  }, [uploads, searchText]);

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
      setScenarioError(err?.message || "");
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const loadUploads = React.useCallback(
    async (page = 1) => {
      if (!scenarioId) return;
      setUploadsLoading(true);
      setUploadsError("");
      setUploads([]);
      try {
        const { items, pagination } = await listRidershipUploadsSvc({
          scenarioId,
          params: {
            page,
            page_size: 20,
          },
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

  const handleDownloadCsv = React.useCallback(
    async (upload) => {
      if (!scenarioId || !upload?.id) return;
      setExportingId(upload.id);
      try {
        const res = await convertOneDetailedToOdCsvSvc({
          scenarioId,
          ridershipUploadId: upload.id,
        });

        const name = upload?.ridership_record_name || ui.fileName.defaultRecordName;
        const filename = res?.filename || `${name}${ui.fileName.defaultSuffix}`;
        downloadBlob(res.blob, filename);

        showSnackbar?.({ title: ui.snackbar.exportCompleted, severity: "success" });
      } catch (err) {
        if (err?.statusCode === 401) return;
        const msg = err?.message || "";
        showSnackbar?.({ title: ui.snackbar.exportFailedTitle, detail: msg, severity: "error" });
      } finally {
        setExportingId("");
      }
    },
    [scenarioId, showSnackbar, ui]
  );

  const openConfirm = React.useCallback((upload) => {
    if (!upload?.id) return;
    setConfirmTarget(upload);
  }, []);

  const closeConfirm = React.useCallback(() => {
    if (exportingId) return;
    setConfirmTarget(null);
  }, [exportingId]);

  const confirmAndDownload = React.useCallback(async () => {
    if (!confirmTarget) return;
    await handleDownloadCsv(confirmTarget);
    setConfirmTarget(null);
  }, [confirmTarget, handleDownloadCsv]);

  React.useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  React.useEffect(() => {
    if (!scenarioId) return;
    localStorage.setItem(LS_SCENARIO_KEY, scenarioId);
  }, [scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return;
    setUploadsPage(1);
    loadUploads(1);
  }, [scenarioId, loadUploads]);

  React.useEffect(() => {
    if (!scenarioId) return;
    if (uploadsPage === 1) return;
    loadUploads(uploadsPage);
  }, [scenarioId, uploadsPage, loadUploads]);

  return {
    showSnackbar,
    scenarioOptions,
    scenarioId,
    setScenarioId,
    scenarioLoading,
    scenarioError,
    uploadsLoading,
    uploadsError,
    uploads,
    filteredUploads,
    uploadsPagination,
    uploadsPage,
    setUploadsPage,
    searchText,
    setSearchText,
    exportingId,
    confirmTarget,
    openConfirm,
    closeConfirm,
    confirmAndDownload,
  };
}

