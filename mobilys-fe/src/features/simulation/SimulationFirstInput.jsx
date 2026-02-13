// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/pages/simulation/SimulationFirstInput.jsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Backdrop,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Stack,
  TextField,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import LargeTooltip from "../../components/LargeTooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import dayjs from "dayjs";
import "dayjs/locale/ja";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import FileUploader from "../../components/FileUploader.jsx";
import { FILE_STATUS } from "../../constant/file.js";
import {
  SIMULATION_CSV_TEMPLATE,
  SIMULATION_DEFAULT_PARAMS,
} from "../../constant/simulation.js";
import { useSnackbarStore } from "../../state/snackbarStore";
import CsvValidationTab from "./CsvValidationTab.jsx";
import { SIMULATION } from "@/strings";
import { useSimulationFirstInput } from "./hooks/useSimulationFirstInput";

const num = (v, fb = 0) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? fb : Number(v));

export default function SimulationFirstInput({
  simulationId,
  onSaved,
  beforeScenario,
  afterScenario,
  onValidationStateChange,
  // Lifted state props
  uploadedFiles = [],
  hasPersistedValidation = false,
  onFilesChange,
  form: formFromParent,
  dateOptions: dateOptionsFromParent = [],
  serviceOptions: serviceOptionsFromParent = [],
  onFormStateChange,
  onResetInputState,
}) {
  const strings = SIMULATION.firstInput;
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [saving, setSaving] = React.useState(false);

  const {
    loadingInit,
    locked,
    serverData,
    refreshInit,
    fetchServiceIdsByDate,
    validateCsv,
    removeValidationResult,
    executeSimulation,
  } = useSimulationFirstInput(simulationId);

  // Use lifted state from parent
  const form = formFromParent || SIMULATION_DEFAULT_PARAMS;
  const dateOptions = dateOptionsFromParent;
  const serviceOptions = serviceOptionsFromParent;
  const files = uploadedFiles;

  // Helper to update form in parent
  const setForm = React.useCallback((updater) => {
    // Pass updater function directly to parent, let parent's setState handle it
    onFormStateChange?.({ form: updater });
  }, [onFormStateChange]);

  const setDateOptions = React.useCallback((opts) => {
    onFormStateChange?.({ dateOptions: opts });
  }, [onFormStateChange]);

  const setServiceOptions = React.useCallback((opts) => {
    onFormStateChange?.({ serviceOptions: opts });
  }, [onFormStateChange]);

  // upload state (local, non-lifted)
  const [status, setStatus] = React.useState(FILE_STATUS.IDLE);
  const [errorMessage, setErrorMessage] = React.useState("");

  // validation dialog state (local - only for dialog display)
  const [validationModalOpen, setValidationModalOpen] = React.useState(false);
  const [validationLoading, setValidationLoading] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState(null);
  const [validationError, setValidationError] = React.useState("");

  // helpers
  const fromServerParams = React.useCallback((p = {}) => {
    const sidArr =
      Array.isArray(p.service_ids) ? p.service_ids :
      (typeof p.service_id === "string" && p.service_id.trim() ? p.service_id.split(",").map(s => s.trim()).filter(Boolean) : []);
    return {
      serviceDate: p.service_date || "",
      serviceIds: sidArr,
      epsilon_inc: num(p.epsilon_inc, SIMULATION_DEFAULT_PARAMS.epsilon_inc),
      epsilon_dec: num(p.epsilon_dec, SIMULATION_DEFAULT_PARAMS.epsilon_dec),
      costPerShare: num(p.cost_per_share, SIMULATION_DEFAULT_PARAMS.costPerShare),
      carShare: num(p.car_share, SIMULATION_DEFAULT_PARAMS.carShare),
      timeValueYenPerMin_perVehicle: num(p.time_value_yen_per_min_per_vehicle, SIMULATION_DEFAULT_PARAMS.timeValueYenPerMin_perVehicle),
      defaultFare: num(p.default_fare, SIMULATION_DEFAULT_PARAMS.defaultFare),
    };
  }, []);

  const toServerPayload = React.useCallback(
    (f) => ({
      simulation_id: simulationId,
      service_date: f.serviceDate,
      service_ids: f.serviceIds,
      epsilon_inc: parseFloat(f.epsilon_inc) || 0,
      epsilon_dec: parseFloat(f.epsilon_dec) || 0,
      cost_per_share: parseFloat(f.costPerShare) || 0,
      car_share: parseFloat(f.carShare) || 0,
      time_value_yen_per_min_per_vehicle: parseFloat(f.timeValueYenPerMin_perVehicle) || 0,
      default_fare: parseFloat(f.defaultFare) || 0,
    }),
    [simulationId]
  );

  React.useEffect(() => {
    dayjs.locale("ja");
  }, []);

  const handleFetchServiceIdsByDate = React.useCallback(
    async (isoDate) => {
      if (!isoDate) {
        setServiceOptions([]);
        setForm((p) => ({ ...p, serviceIds: [] }));
        return;
      }
      try {
        const options = await fetchServiceIdsByDate(isoDate);
        setServiceOptions(options);
        setForm((p) => ({ ...p, serviceIds: options }));
        showSnackbar({
          title: options.length
            ? strings.serviceId.snackbars.fetched(options.length)
            : strings.serviceId.snackbars.none,
          severity: options.length ? "success" : "warning",
        });
      } catch (e) {
        setServiceOptions([]);
        setForm((p) => ({ ...p, serviceIds: [] }));
        showSnackbar({
          title: strings.serviceId.snackbars.failed,
          severity: "error",
          detail: String(e?.message || e),
        });
        throw e;
      }
    },
    [fetchServiceIdsByDate, showSnackbar, setForm, setServiceOptions, strings.serviceId.snackbars]
  );

  const EPSILON_OPTIONS = Array.from({ length: 20 }, (_, i) => Number(((i + 1) / 10).toFixed(1)));

  const handleSelectFiles = (selected, error) => {
    setValidationResult(null);
    setValidationError("");
    setValidationModalOpen(false);

    if (error) {
      setErrorMessage(error);
      return;
    }
    const arr = Array.isArray(selected) ? selected : [selected];
    const list = arr.filter(Boolean).slice(0, 1);

    // Update files via parent
    onFilesChange?.(list, false);

    const f = list[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const txt = String(ev.target?.result || "");
        const dates = extractIsoDatesFromCsvText(txt);
        await triggerCsvValidation(f, list);
        setDateOptions(dates);
        const first = dates[0] || "";
        setForm((p) => ({ ...p, serviceDate: first, serviceIds: [] }));
        if (first) {
          try {
            await handleFetchServiceIdsByDate(first);
          } catch {
            // noop
          }
        }
      };
      reader.readAsText(f, "utf-8");
    } else {
      setDateOptions([]);
      setForm((p) => ({ ...p, serviceDate: "", serviceIds: [] }));
    }
  };

  React.useEffect(() => {
    if (!serverData) {
      if (files.length === 0) {
        setForm(SIMULATION_DEFAULT_PARAMS);
        setServiceOptions([]);
        setDateOptions([]);
      }
      return;
    }

    if (files.length !== 0) return;

    if (serverData?.params) {
      const merged = {
        ...SIMULATION_DEFAULT_PARAMS,
        ...fromServerParams(serverData.params),
      };

      setForm(merged);

      if (locked) {
        if (merged.serviceDate) setDateOptions([merged.serviceDate]);
        if (merged.serviceIds?.length) setServiceOptions(merged.serviceIds);
      } else if (merged.serviceDate) {
        void (async () => {
          try {
            await handleFetchServiceIdsByDate(merged.serviceDate);
          } catch {
            // noop
          }
        })();
      } else {
        setServiceOptions([]);
      }
    } else {
      setForm(SIMULATION_DEFAULT_PARAMS);
      setServiceOptions([]);
      setDateOptions([]);
    }
  }, [
    files.length,
    fromServerParams,
    handleFetchServiceIdsByDate,
    locked,
    serverData,
    setDateOptions,
    setForm,
    setServiceOptions,
  ]);

  const handleRemoveAt = async (idx) => {
    const next = files.slice();
    next.splice(idx, 1);

    // If there was any persisted validation, nuke it on the backend too
    try {
      await removeValidationResult();
    } catch (e) {
      showSnackbar({
        title: strings.snackbars.validationDeleteFailed,
        severity: "warning",
        detail: String(e?.message || e),
      });
    }

    // Update via parent (no persisted validation anymore)
    onFilesChange?.(next, false);

    // Local / parent validation state reset
    setValidationResult(null);
    setValidationError("");
    setValidationModalOpen(false);

    onValidationStateChange?.({
      validationLoading: false,
      validationError: "",
      validationResult: null,
      comparisonsWithDiff: [],
      comparisonsNoDiff: [],
      invalidGroupedByRoute: [],
    });

    setDateOptions([]);
    setServiceOptions([]);
    setForm((p) => ({ ...p, serviceDate: "", serviceIds: [] }));
  };

  const triggerCsvValidation = React.useCallback(async (file, currentFiles) => {
    if (!file || !simulationId) return;

    setValidationError("");
    setValidationResult(null);
    setValidationLoading(true);
    setValidationModalOpen(true);

    try {
      const result = await validateCsv(file);
      setValidationResult(result);

      // Update persisted flag via parent
      onFilesChange?.(currentFiles || files, !!result?.persisted);

      const derived = deriveValidationProps(result);
      onValidationStateChange?.({
        validationLoading: false,
        validationError: "",
        validationResult: result,
        ...derived,
      });

      showSnackbar({
        title: strings.snackbars.validationSaved,
        severity: "success",
      });
    } catch (err) {
      setValidationError(String(err?.message || err));
      onFilesChange?.(currentFiles || files, false);
    } finally {
      setValidationLoading(false);
    }
  }, [simulationId, onValidationStateChange, showSnackbar, files, onFilesChange, strings.snackbars.validationSaved, validateCsv]);

  function extractIsoDatesFromCsvText(txt) {
    const lines = (txt || "").split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const header = lines[0].split(",").map(s => s.replace(/^\uFEFF/, "").trim());
    const dateIdx = header.findIndex(h => h.toLowerCase() === "date");
    if (dateIdx === -1) return [];
    const set = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const raw = (cols[dateIdx] || "").trim().replace(/"/g, "");
      if (!raw) continue;
      const iso = raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : raw;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) set.add(iso);
    }
    return Array.from(set).sort();
  }

  const downloadTemplate = () => {
    const blob = new Blob([SIMULATION_CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "simulation_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    showSnackbar({ title: strings.snackbars.templateDownloaded, severity: "success" });
  };

  const handleSaveTop = async () => {
    if (locked) return;
    if (!form.serviceDate) return;
    if (!form.serviceIds || form.serviceIds.length === 0) return;
    if (files.length === 0) return;
    if (!hasPersistedValidation) return;

    setSaving(true);
    try {
      const payload = toServerPayload(form);
      await executeSimulation({ file: files[0], payload });

      showSnackbar({ title: strings.snackbars.saved, severity: "success" });
      await refreshInit();

      // Reset all lifted state via parent
      onResetInputState?.();
      setStatus(FILE_STATUS.IDLE);
      setErrorMessage("");
      if (typeof onSaved === "function") onSaved();
    } catch (e) {
      showSnackbar({
        title: strings.snackbars.saveFailed,
        severity: "error",
        detail: String(e?.message || e),
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = !locked
    && !!form.serviceDate
    && Array.isArray(form.serviceIds) && form.serviceIds.length >= 1
    && files.length === 1
    && hasPersistedValidation
    && !saving;

  const ScenarioRow = ({ label, obj }) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(100px,auto) 1fr", rowGap: 0.75, columnGap: 4, alignItems: "center" }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ pr: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={obj?.name || "-"}>
          {obj?.name || "-"}
        </Typography>
      </Box>
    </Box>
  );

  const EPS = EPSILON_OPTIONS;
  const CAR_SHARE_MAX = 1;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const blockInvalidKeys = (e) => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); };
  const makeNumberHandler = (field, { min = 0, max = Infinity } = {}) => (e) => {
    const { value } = e.target;
    if (value === "") { setForm((p) => ({ ...p, [field]: "" })); return; }
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const clamped = clamp(n, min, max);
    setForm((p) => ({ ...p, [field]: clamped }));
  };

  const scenarioDisplay = {
    before: beforeScenario ?? serverData?.original_scenario ?? null,
    after:  afterScenario  ?? serverData?.duplicated_scenario ?? null,
  };

  // dialog-local derivations (for rendering)
  const cmp = [...(validationResult?.trip_count_comparisons ?? [])]
    .sort((a, b) => (a.route_id || "").localeCompare(b.route_id || "", "ja"));
  const comparisonsWithDiff = cmp.filter((r) => Number(r.difference) !== 0);
  const comparisonsNoDiff = cmp.filter((r) => Number(r.difference) === 0);
  const invalidGroupedByRoute = React.useMemo(() => {
    const rows = validationResult?.invalid_rows ?? [];
    const grouped = rows.reduce((acc, r) => {
      const k = r.route_id || "（不明）";
      (acc[k] = acc[k] || []).push(r);
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => String(a[0]).localeCompare(String(b[0]), "ja"));
  }, [validationResult]);

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: "transparent" }}>
      <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-start" }}>
        <Button variant="contained" onClick={handleSaveTop} sx={{ minWidth: 140 }} disabled={!canSave}>
          {strings.actions.runSimulation}
        </Button>
      </Box>

      {/* Scenario */}
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr auto" }, alignItems: "start", columnGap: 2, rowGap: 1.5, mb: 3 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            {strings.sections.scenario}
          </Typography>
          <Stack spacing={1.25}>
            <ScenarioRow
              label={strings.scenarioRows.before}
              obj={scenarioDisplay.before}
            />
            <ScenarioRow
              label={strings.scenarioRows.after}
              obj={scenarioDisplay.after}
            />
          </Stack>
        </Box>
      </Paper>

      {/* uploader (unlocked) */}
      {!locked && (
        <>
          {files.length === 0 ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, mt: 3 }}>
                {strings.sections.upload}
              </Typography>
              <FileUploader
                status={status}
                filename={undefined}
                errorMessage={errorMessage}
                onFileUpload={handleSelectFiles}
                disabled={loadingInit || saving}
                requiredValue={strings.uploader.requiredValue}
                multiple={false}
                fileExtensionAllowed={[".csv"]}
                emptyText={strings.uploader.emptyText}
                acceptLabel={strings.uploader.acceptLabel}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: "flex-end" }}>
                <Button
                 size="small"
                 variant="outlined"
                 onClick={downloadTemplate}
                  startIcon={
                   <span className="material-symbols-outlined outlined">
                     download
                   </span>
                 }
                 >
                  {strings.actions.downloadTemplate}
                </Button>
              </Stack>
            </Box>
          ) : (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, mt: 3 }}>
                {strings.sections.upload}
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2, height: 240, p: 1, overflow: "auto", mt: 1 }}>
                <List dense disablePadding>
                  {files.map((f, idx) => (
                    <Box key={`${f.name}-${f.size}`}>
                      <ListItem
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label={strings.actions.removeFileAriaLabel}
                            onClick={() => handleRemoveAt(idx)}
                            disabled={saving}
                          >
                            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>×</Typography>
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <span>{f.name}</span>
                              {(validationLoading || validationResult) && (
                                <Tooltip title={strings.uploader.validationTooltip}>
                                  <IconButton
                                    size="small"
                                    onClick={() => setValidationModalOpen(true)}
                                    sx={{ p: 0.5 }}
                                    aria-label={strings.actions.openValidationAriaLabel}
                                  >
                                    <HelpOutlineIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          }
                        />
                        <ListItemText primary={formatBytes(f.size)} />
                      </ListItem>
                      {idx < files.length - 1 && <Divider component="li" />}
                    </Box>
                  ))}
                </List>
              </Paper>

              <Box sx={{ display: "flex", justifyContent: "flex-end", my: 2 }}>
                <Button size="small" variant="outlined" onClick={downloadTemplate} disabled={saving}>
                  {strings.actions.downloadTemplate}
                </Button>
              </Box>
            </>
          )}
        </>
      )}

      {/* Params */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, mt: 3 }}>
        {strings.sections.params}
      </Typography>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.serviceId.title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
              <TextField
                select
                fullWidth
                label={strings.serviceId.serviceDateLabel(dateOptions.length)}
                value={form.serviceDate}
                onChange={(e) => {
                  const iso = e.target.value;
                  setForm((p) => ({ ...p, serviceDate: iso, serviceIds: [] }));
                  if (iso) handleFetchServiceIdsByDate(iso);
                }}
                helperText={
                  dateOptions.length
                    ? strings.serviceId.serviceDateHelperWithDates
                    : strings.serviceId.serviceDateHelperNoDates
                }
                disabled={locked || loadingInit || saving || dateOptions.length === 0}
              >
                {dateOptions.map((d) => {
                  const m = dayjs(d);
                  const label = m.isValid()
                    ? m.format("YYYY/MM/DD（ddd）")
                    : d;

                  return (
                    <MenuItem key={d} value={d}>
                      {label}
                    </MenuItem>
                  );
                })}
              </TextField>
            </LocalizationProvider>

            <TextField
              select
              fullWidth
              label={strings.serviceId.serviceIdsLabel(serviceOptions.length)}
              value={form.serviceIds}
              SelectProps={{
                multiple: true,
                renderValue: (selected) => (selected || []).join(", "),
                onChange: (e) => {
                  const value = e.target.value;
                  const arr = Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
                  setForm((p) => ({ ...p, serviceIds: arr }));
                },
              }}
              disabled={true}
            >
              {serviceOptions.map((sid) => (
                <MenuItem key={sid} value={sid}>{sid}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>
            {strings.params.ridershipSensitivity}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label={strings.params.labels.epsilonInc}
                value={form.epsilon_inc ?? 0.5}
                onChange={(e) => setForm((p) => ({ ...p, epsilon_inc: Number(e.target.value) }))} fullWidth
                disabled={locked || saving || loadingInit}>
                {EPS.map((opt) => <MenuItem key={opt} value={opt}>{opt.toFixed(1)}</MenuItem>)}
              </TextField>
              <TextField
                select
                label={strings.params.labels.epsilonDec}
                value={form.epsilon_dec ?? 0.5}
                onChange={(e) => setForm((p) => ({ ...p, epsilon_dec: Number(e.target.value) }))} fullWidth
                disabled={locked || saving || loadingInit}>
                {EPS.map((opt) => <MenuItem key={opt} value={opt}>{opt.toFixed(1)}</MenuItem>)}
              </TextField>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>
            {strings.params.operatingEconomics}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={strings.params.labels.costPerShare}
              type="number"
              value={form.costPerShare}
              onChange={(e) => setForm((p) => ({ ...p, costPerShare: e.target.value }))}
              fullWidth
              disabled={locked || saving || loadingInit}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.params.carRouting}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={strings.params.labels.carShare}
              type="number"
              value={form.carShare}
              onChange={makeNumberHandler("carShare", { min: 0, max: CAR_SHARE_MAX })}
              inputProps={{ min: 0, max: CAR_SHARE_MAX, step: "any" }}
              onKeyDown={blockInvalidKeys}
              fullWidth
              disabled={locked || saving || loadingInit}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>
            {strings.params.benefitCalculation}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={strings.params.labels.timeValue}
              type="number"
              value={form.timeValueYenPerMin_perVehicle ?? 48.89}
              onChange={(e) => setForm((p) => ({ ...p, timeValueYenPerMin_perVehicle: e.target.value }))}
              fullWidth
              disabled
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

       <Accordion defaultExpanded disableGutters>
         <AccordionSummary
           expandIcon={<ExpandMoreIcon />}
           sx={{ display: "flex", alignItems: "center" }}
         >
           <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 700 }}>{strings.params.fare}</Typography>
            <LargeTooltip title={
              <>
                {strings.params.fareTooltipLines[0]}
                <br />
                {strings.params.fareTooltipLines[1]}
              </>
            }>
              <InfoOutlinedIcon fontSize="inherit" />
            </LargeTooltip>
           </Box>
         </AccordionSummary>
         <AccordionDetails>
           <Stack spacing={2}>
             <TextField
              label={strings.params.labels.defaultFare}
               type="number"
               value={form.defaultFare}
               onChange={makeNumberHandler("defaultFare", { min: 0, max: 100000 })}
               inputProps={{ min: 0, max: 100000 }}
               onKeyDown={blockInvalidKeys}
               fullWidth
              disabled={locked || saving || loadingInit}
             />
           </Stack>
         </AccordionDetails>
       </Accordion>

      {/* Validation dialog */}
      <Dialog
        open={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {strings.validationDialog.title}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <CsvValidationTab
            title={strings.validationDialog.title}
            showTitle={false}
            validationLoading={validationLoading}
            validationError={validationError}
            validationResult={validationResult}
            comparisonsWithDiff={comparisonsWithDiff}
            comparisonsNoDiff={comparisonsNoDiff}
            invalidGroupedByRoute={invalidGroupedByRoute}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setValidationModalOpen(false)}
            variant="contained"
            color="primary"
          >
            {strings.actions.close}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global loading */}
      <Backdrop open={loadingInit || saving} sx={{ color: "#1976d2", zIndex: (t) => t.zIndex.drawer + 2, position: "fixed" }}>
        <CircularProgress color="inherit" />
        <Typography sx={{ ml: 2, fontWeight: 500, color: "#1976d2" }}>
          {saving ? strings.backdrop.saving : strings.backdrop.loading}
        </Typography>
      </Backdrop>
    </Paper>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function deriveValidationProps(result) {
  const cmp = [...(result?.trip_count_comparisons ?? [])]
    .sort((a, b) => (a.route_id || "").localeCompare(b.route_id || "", "ja"));
  const comparisonsWithDiff = cmp.filter((r) => Number(r.difference) !== 0);
  const comparisonsNoDiff = cmp.filter((r) => Number(r.difference) === 0);

  const grouped = (result?.invalid_rows ?? []).reduce((acc, r) => {
    const k = r.route_id || "（不明）";
    (acc[k] = acc[k] || []).push(r);
    return acc;
  }, {});
  const invalidGroupedByRoute = Object.entries(grouped)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "ja"));

  return { comparisonsWithDiff, comparisonsNoDiff, invalidGroupedByRoute };
}
