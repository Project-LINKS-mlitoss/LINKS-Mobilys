import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Box,
  IconButton,
  Typography,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  Tooltip,
  Divider,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
} from "@mui/material";
import {
  DatePicker,
  LocalizationProvider,
  DateCalendar,
} from "@mui/x-date-pickers";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import ja from "date-fns/locale/ja";
import { useFormik } from "formik";
import { Add, Delete } from "@mui/icons-material";
import { getEditScenarioContextSvc } from "../../services/scenarioService";
import { GTFS } from "../../strings/domains/gtfs";

/**
 * Helper: format Date | string | null -> 'YYYY-MM-DD' | null
 */
function formatDateISO(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const modalUi = GTFS.scenario.multiStepEditModal;

const steps = [
  modalUi.steps.basicInfo, // Step 0: Scenario + FeedInfo
  modalUi.steps.calendar, // Step 1: Calendar
  modalUi.steps.exceptions, // Step 2: CalendarDates via calendar grid
  modalUi.steps.confirm, // Step 3: Preview tables
];

// Defaults for initial values
const defaultInitialValues = {
  scenario_name: "",
  start_date: null,
  end_date: null,
  feed_info: {
    publisher_url: "",
    version: "",
  },
};

// Calendar row template
const emptyCalendarRow = (overrides = {}) => ({
  service_id: "",
  monday: 1,
  tuesday: 1,
  wednesday: 1,
  thursday: 1,
  friday: 1,
  saturday: 0,
  sunday: 0,
  useScenarioDates: true,
  start_date: null,
  end_date: null,
  ...overrides,
});

// CalendarDates row template
const emptyCalendarDateRow = (overrides = {}) => ({
  service_id: "",
  date: null,
  exception_type: 1, // 1=added (green), 2=removed (red)
  ...overrides,
});

export default function MultiStepEditScenarioModal({
  open,
  onClose,
  onSubmit, // Promise-returning
  scenarioId,
  initialValues = defaultInitialValues,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState("");
  const [ctxData, setCtxData] = useState(null);

  // ---- Step 0 form (Scenario + FeedInfo)
  const formik0 = useFormik({
    initialValues: {
      ...defaultInitialValues,
      ...initialValues,
      feed_info: {
        publisher_url: initialValues?.feed_info?.publisher_url || "",
        version: initialValues?.feed_info?.version || "",
      },
    },
    enableReinitialize: true,
    validate: (values) => {
      const errs = {};
      if (!values.scenario_name?.trim()) errs.scenario_name = modalUi.validation.required;
      const s = values.start_date ? new Date(values.start_date) : null;
      const e = values.end_date ? new Date(values.end_date) : null;
      if (s && e && e <= s) {
        errs.end_date = modalUi.validation.endDateAfterStart;
      }
      return errs;
    },
    onSubmit: () => {},
  });

  // ---- Step 1 state (Calendar)
  const [calendarRows, setCalendarRows] = useState([emptyCalendarRow()]);

  // ---- Step 2 state (CalendarDates)
  const [calendarDateRows, setCalendarDateRows] = useState([
    emptyCalendarDateRow(),
  ]);
  const [cdServiceId, setCdServiceId] = useState("");
  const [cdType, setCdType] = useState(1); // current exception type to place: 1 or 2
  const [cdSelectedDate, setCdSelectedDate] = useState(null);

  // Fetch edit context when dialog opens
  useEffect(() => {
    if (!open || !scenarioId) return;
    let cancelled = false;
    async function run() {
      setCtxError("");
      setCtxLoading(true);
      try {
        const data = await getEditScenarioContextSvc(scenarioId);
        if (cancelled) return;
        setCtxData(data);
        // Fill step0
        formik0.setValues(
          {
            scenario_name: data?.scenario_name || "",
            start_date: data?.start_date ? new Date(data.start_date) : null,
            end_date: data?.end_date ? new Date(data.end_date) : null,
            feed_info: {
              publisher_url: data?.feed_info?.publisher_url || "",
              version: data?.feed_info?.version || "",
            },
          },
          false
        );
        // Fill calendar rows
        const scenStart = data?.start_date || null;
        const scenEnd = data?.end_date || null;
        const cal = (data?.calendar || []).map((r) => ({
          ...emptyCalendarRow(),
          service_id: r.service_id,
          monday: r.monday,
          tuesday: r.tuesday,
          wednesday: r.wednesday,
          thursday: r.thursday,
          friday: r.friday,
          saturday: r.saturday,
          sunday: r.sunday,
          useScenarioDates:
            r.start_date === scenStart && r.end_date === scenEnd,
          start_date: r.start_date ? new Date(r.start_date) : null,
          end_date: r.end_date ? new Date(r.end_date) : null,
        }));
        setCalendarRows(cal.length ? cal : [emptyCalendarRow()]);
        // Fill calendar_dates rows from DB
        const cds = (data?.calendar_dates || []).map((r) => ({
          service_id: r.service_id,
          date: r.date ? new Date(r.date) : null,
          exception_type: r.exception_type,
        }));
        setCalendarDateRows(cds.length ? cds : [emptyCalendarDateRow()]);
        // default selected service_id
        const union = computeServiceIdUnion(cal, cds, []);
        setCdServiceId(union[0] || "");
        setCdSelectedDate(
          data?.start_date ? new Date(data.start_date) : new Date()
        );
      } catch (e) {
        if (!cancelled) setCtxError(modalUi.errors.loadContextFailed);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scenarioId]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setCalendarRows([emptyCalendarRow()]);
      setCalendarDateRows([emptyCalendarDateRow()]);
      setCdServiceId("");
      setCdType(1);
      setCdSelectedDate(null);
      setCtxError("");
      setCtxLoading(false);
      setCtxData(null);
    }
  }, [open]);

  const scenarioStart = formik0.values.start_date
    ? new Date(formik0.values.start_date)
    : null;
  const scenarioEnd = formik0.values.end_date
    ? new Date(formik0.values.end_date)
    : null;

  const canGoNextFromStep0 = useMemo(() => {
    const hasErr = Object.keys(formik0.errors || {}).length > 0;
    const hasName = !!formik0.values.scenario_name?.trim();
    return hasName && !hasErr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik0.values, formik0.errors]);

  const goNext = async () => {
    if (activeStep === 0) {
      await formik0.validateForm();
      if (Object.keys(formik0.errors).length > 0) return;
    }
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  const handleAddCalendarRow = () =>
    setCalendarRows((rows) => [...rows, emptyCalendarRow()]);
  const handleRemoveCalendarRow = (idx) =>
    setCalendarRows((rows) => rows.filter((_, i) => i !== idx));

  const handleRemoveCalendarDateRow = (idx) =>
    setCalendarDateRows((rows) => rows.filter((_, i) => i !== idx));

  const applyScenarioDatesToAllServices = (checked) => {
    setCalendarRows((rows) =>
      rows.map((r) => ({
        ...r,
        useScenarioDates: checked,
        start_date: checked ? null : r.start_date,
        end_date: checked ? null : r.end_date,
      }))
    );
  };

  // ----------------- Union service_id list -----------------
  function computeServiceIdUnion(calRows, cdRows, dynamicRows) {
    const set = new Set();
    (calRows || []).forEach((r) => r.service_id && set.add(r.service_id));
    (cdRows || []).forEach((r) => r.service_id && set.add(r.service_id));
    (dynamicRows || []).forEach((r) => r.service_id && set.add(r.service_id));
    return Array.from(set);
  }

  const serviceIdUnion = useMemo(
    () => computeServiceIdUnion(calendarRows, calendarDateRows, calendarRows),
    [calendarRows, calendarDateRows]
  );

  // Keep selected service_id valid
  useEffect(() => {
    if (!open) return;
    if (!serviceIdUnion.includes(cdServiceId)) {
      setCdServiceId(serviceIdUnion[0] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIdUnion.join("|")]);

  // ----------------- Calendar-day interactions -----------------
  const exceptionsForSelected = useMemo(
    () =>
      calendarDateRows
        .filter((r) => r.service_id === cdServiceId && r.date)
        .reduce((acc, r) => {
          acc[formatDateISO(r.date)] = r.exception_type; // map iso -> type
          return acc;
        }, {}),
    [calendarDateRows, cdServiceId]
  );

  const handleClickDay = (day) => {
    if (!cdServiceId) return;
    if (!day) return;
    const iso = formatDateISO(day);
    if (!iso) return;

    // constraint within scenario range
    if (scenarioStart && new Date(iso) < new Date(formatDateISO(scenarioStart)))
      return;
    if (scenarioEnd && new Date(iso) > new Date(formatDateISO(scenarioEnd)))
      return;

    setCdSelectedDate(day);

    // find existing
    const idx = calendarDateRows.findIndex(
      (r) => r.service_id === cdServiceId && formatDateISO(r.date) === iso
    );
    if (idx === -1) {
      // add new with current type
      setCalendarDateRows((rows) => [
        ...rows,
        emptyCalendarDateRow({
          service_id: cdServiceId,
          date: day,
          exception_type: cdType,
        }),
      ]);
    } else {
      // toggle/update
      setCalendarDateRows((rows) => {
        const clone = [...rows];
        const curr = clone[idx];
        if (curr.exception_type === cdType) {
          // same type -> remove
          clone.splice(idx, 1);
        } else {
          // update type
          clone[idx] = { ...curr, exception_type: cdType };
        }
        return clone;
      });
    }
  };

  const ServerDay = (props) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const iso = formatDateISO(day);
    const t = exceptionsForSelected[iso];
    return (
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        badgeContent={
          t ? (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: t === 1 ? "success.main" : "error.main",
              }}
            />
          ) : null
        }>
        <PickersDay
          {...other}
          day={day}
          outsideCurrentMonth={outsideCurrentMonth}
        />
      </Badge>
    );
  };

  const buildPayload = () => {
    const payload = {
      scenario_name: formik0.values.scenario_name,
      start_date: formatDateISO(formik0.values.start_date),
      end_date: formatDateISO(formik0.values.end_date),
      feed_info: {
        publisher_url: formik0.values.feed_info?.publisher_url || "",
        version: formik0.values.feed_info?.version || "",
      },
    };

    const calendar = calendarRows
      .filter((r) => r.service_id?.trim())
      .map((r) => ({
        service_id: r.service_id.trim(),
        monday: Number(!!r.monday),
        tuesday: Number(!!r.tuesday),
        wednesday: Number(!!r.wednesday),
        thursday: Number(!!r.thursday),
        friday: Number(!!r.friday),
        saturday: Number(!!r.saturday),
        sunday: Number(!!r.sunday),
        start_date: r.useScenarioDates
          ? formatDateISO(formik0.values.start_date)
          : formatDateISO(r.start_date),
        end_date: r.useScenarioDates
          ? formatDateISO(formik0.values.end_date)
          : formatDateISO(r.end_date),
      }));
    if (calendar.length > 0) payload.calendar = calendar;

    const calendar_dates = calendarDateRows
      .filter((r) => r.service_id?.trim() && r.date)
      .map((r) => ({
        service_id: r.service_id.trim(),
        date: formatDateISO(r.date),
        exception_type: Number(r.exception_type) === 2 ? 2 : 1,
      }));
    if (calendar_dates.length > 0) payload.calendar_dates = calendar_dates;

    return payload;
  };

  // Derived previews (for Step 3)
  const previewCalendar = useMemo(
    () => buildPayload().calendar || [],
    [calendarRows, formik0.values]
  );
  const previewCalendarDates = useMemo(
    () => buildPayload().calendar_dates || [],
    [calendarDateRows, formik0.values]
  );

  // Filters for Step 3 (confirm) - calendar_dates table
  const [pvService, setPvService] = useState(""); // empty = all
  const [pvType, setPvType] = useState(0); // 0=all, 1=added, 2=removed
  const [pvStart, setPvStart] = useState(null);
  const [pvEnd, setPvEnd] = useState(null);

  const pvServiceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (previewCalendarDates || []).map((r) => r.service_id).filter(Boolean)
        )
      ),
    [previewCalendarDates]
  );

  const filteredPreviewCalendarDates = useMemo(() => {
    let list = previewCalendarDates || [];
    if (pvService) list = list.filter((r) => r.service_id === pvService);
    if (pvType === 1 || pvType === 2)
      list = list.filter((r) => Number(r.exception_type) === pvType);
    const startIso = pvStart ? formatDateISO(pvStart) : null;
    const endIso = pvEnd ? formatDateISO(pvEnd) : null;
    if (startIso) list = list.filter((r) => (r.date || "") >= startIso);
    if (endIso) list = list.filter((r) => (r.date || "") <= endIso);
    return list;
  }, [previewCalendarDates, pvService, pvType, pvStart, pvEnd]);

  const formatJP = (d) => {
    if (!d) return "";
    const dd = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dd.getTime())) return "";
    return `${dd.getFullYear()}/${String(dd.getMonth() + 1).padStart(2, "0")}/${String(dd.getDate()).padStart(2, "0")}`;
  };

  const DayIcon = ({ value }) => (
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: value ? "success.main" : "error.main",
        display: "inline-block",
        verticalAlign: "middle",
      }}
    />
  );
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{modalUi.title}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ my: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {ctxError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {ctxError}
          </Alert>
        )}

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
          {/* Step 0: Basic */}
          {activeStep === 0 && (
            <Box component="form" sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label={modalUi.fields.scenarioName}
                    name="scenario_name"
                    value={formik0.values.scenario_name}
                    onChange={formik0.handleChange}
                    fullWidth
                    required
                    variant="standard"
                    error={!!formik0.errors.scenario_name}
                    helperText={formik0.errors.scenario_name || ""}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <DatePicker
                    label={modalUi.fields.startDate}
                    value={formik0.values.start_date}
                    onChange={(newValue) => {
                      formik0.setFieldValue("start_date", newValue);
                      const e = formik0.values.end_date
                        ? new Date(formik0.values.end_date)
                        : null;
                      if (newValue && e && new Date(e) <= new Date(newValue)) {
                        formik0.setFieldValue("end_date", null);
                      }
                    }}
                    format="yyyy/MM/dd"
                    slotProps={{
                      textField: {
                        variant: "standard",
                        fullWidth: true,
                        required: false,
                        error: !!formik0.errors.start_date,
                        helperText: formik0.errors.start_date || "",
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <DatePicker
                    label={modalUi.fields.endDate}
                    value={formik0.values.end_date}
                    minDate={
                      formik0.values.start_date
                        ? new Date(
                            new Date(formik0.values.start_date).getTime() +
                              24 * 60 * 60 * 1000
                          )
                        : undefined
                    }
                    onChange={(newValue) =>
                      formik0.setFieldValue("end_date", newValue)
                    }
                    format="yyyy/MM/dd"
                    slotProps={{
                      textField: {
                        variant: "standard",
                        fullWidth: true,
                        required: false,
                        error: !!formik0.errors.end_date,
                        helperText: formik0.errors.end_date || "",
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={8}>
                  <TextField
                    label={modalUi.fields.publisherUrl}
                    name="feed_info.publisher_url"
                    value={formik0.values.feed_info.publisher_url}
                    onChange={formik0.handleChange}
                    fullWidth
                    variant="standard"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={modalUi.fields.version}
                    name="feed_info.version"
                    value={formik0.values.feed_info.version}
                    onChange={formik0.handleChange}
                    fullWidth
                    variant="standard"
                    placeholder={modalUi.fields.versionPlaceholder}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Step 1: Calendar */}
          {activeStep === 1 && (
            <Box sx={{ mt: 1, position: "relative", minHeight: 120 }}>
              {ctxLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.paper",
                    opacity: 0.6,
                    zIndex: 10,
                  }}>
                  <CircularProgress />
                </Box>
              )}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 1,
                }}>
                <Typography variant="subtitle1">{modalUi.steps.calendar}</Typography>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={
                          calendarRows.length > 0 &&
                          calendarRows.every((r) => r.useScenarioDates)
                        }
                        onChange={(e) =>
                          applyScenarioDatesToAllServices(e.target.checked)
                        }
                      />
                    }
                    label={modalUi.fields.useScenarioDates}
                  />
                  <Tooltip title={modalUi.tooltips.addService}>
                    <IconButton size="small" onClick={handleAddCalendarRow}>
                      <Add />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {calendarRows.map((row, idx) => (
                <Grid
                  key={idx}
                  container
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 1 }}>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label={modalUi.fields.serviceId}
                      value={row.service_id}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCalendarRows((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, service_id: v } : r
                          )
                        );
                      }}
                      fullWidth
                      variant="standard"
                    />
                  </Grid>

                  {modalUi.daysShort.map((label, i) => {
                      const keys = [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                      ];
                      const key = keys[i];
                      return (
                        <Grid key={key} item xs={12} md={1}>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={!!row[key]}
                                onChange={(e) => {
                                  const val = e.target.checked ? 1 : 0;
                                  setCalendarRows((rows) =>
                                    rows.map((r, j) =>
                                      j === idx ? { ...r, [key]: val } : r
                                    )
                                  );
                                }}
                              />
                            }
                            label={label}
                          />
                        </Grid>
                      );
                    })}

                  <Grid item xs={12} md={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={row.useScenarioDates}
                          onChange={(e) =>
                            setCalendarRows((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? { ...r, useScenarioDates: e.target.checked }
                                  : r
                              )
                            )
                          }
                        />
                      }
                      label={modalUi.fields.scenarioDates}
                    />
                  </Grid>

                  {!row.useScenarioDates && (
                    <>
                      <Grid item xs={12} md={2}>
                        <DatePicker
                          label={modalUi.fields.startDate}
                          value={row.start_date}
                          onChange={(val) =>
                            setCalendarRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, start_date: val } : r
                              )
                            )
                          }
                          minDate={scenarioStart || undefined}
                          maxDate={scenarioEnd || undefined}
                          format="yyyy/MM/dd"
                          slotProps={{
                            textField: { variant: "standard", fullWidth: true },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <DatePicker
                          label={modalUi.fields.endDate}
                          value={row.end_date}
                          onChange={(val) =>
                            setCalendarRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, end_date: val } : r
                              )
                            )
                          }
                          minDate={row.start_date || scenarioStart || undefined}
                          maxDate={scenarioEnd || undefined}
                          format="yyyy/MM/dd"
                          slotProps={{
                            textField: { variant: "standard", fullWidth: true },
                          }}
                        />
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12} md={1} sx={{ textAlign: "right" }}>
                    <Tooltip title={modalUi.tooltips.delete}>
                      <IconButton
                        color="error"
                        onClick={() => handleRemoveCalendarRow(idx)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              ))}

              {calendarRows.length === 0 && (
                <Box sx={{ py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {modalUi.helperText.noAddedServices}
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    onClick={handleAddCalendarRow}
                    sx={{ mt: 1 }}>
                    {modalUi.actions.addService}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Step 2: CalendarDates via calendar grid */}
          {activeStep === 2 && (
            <Box sx={{ mt: 1, position: "relative", minHeight: 120 }}>
              {ctxLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.paper",
                    opacity: 0.6,
                    zIndex: 10,
                  }}>
                  <CircularProgress />
                </Box>
              )}

              <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1">{modalUi.steps.exceptions}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={cdServiceId}
                    onChange={(e) => setCdServiceId(e.target.value)}
                    variant="standard"
                    fullWidth
                    displayEmpty
                    renderValue={(v) => (v ? v : modalUi.placeholders.selectServiceId)}>
                    {serviceIdUnion.map((sid) => (
                      <MenuItem key={sid} value={sid}>
                        {sid}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                  <ToggleButtonGroup
                    value={cdType}
                    exclusive
                    onChange={(e, v) => v && setCdType(v)}
                    size="small">
                    <ToggleButton value={1}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "success.main",
                          mr: 1,
                        }}
                      />
                      {modalUi.exceptionType.addedWithCode}
                    </ToggleButton>
                    <ToggleButton value={2}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "error.main",
                          mr: 1,
                        }}
                      />
                      {modalUi.exceptionType.removedWithCode}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
              </Grid>

              {!cdServiceId ? (
                <Alert severity="info">
                  {modalUi.helperText.selectServiceHint}
                </Alert>
              ) : (
                <Box
                  sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
                  <DateCalendar
                    value={cdSelectedDate}
                    onChange={handleClickDay}
                    minDate={scenarioStart || undefined}
                    maxDate={scenarioEnd || undefined}
                    slots={{ day: ServerDay }}
                  />

                  {/* Small list of selected dates for current service */}
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {modalUi.summary.selectedCountTemplate.replace(
                        "{count}",
                        String(Object.keys(exceptionsForSelected).length)
                      )}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {calendarDateRows
                        .filter((r) => r.service_id === cdServiceId)
                        .sort((a, b) => (a.date || 0) - (b.date || 0))
                        .map((r, idx) => (
                          <Box
                            key={`${r.service_id}-${idx}-${formatDateISO(r.date)}`}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 1,
                              px: 1,
                              py: 0.5,
                              borderRadius: 2,
                              border: 1,
                              borderColor: "divider",
                            }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor:
                                  r.exception_type === 1
                                    ? "success.main"
                                    : "error.main",
                              }}
                            />
                            <Typography variant="caption">
                              {formatJP(r.date)} (
                              {r.exception_type === 1
                                ? modalUi.exceptionType.added
                                : modalUi.exceptionType.removed}
                              )
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => {
                                const idx2 = calendarDateRows.findIndex(
                                  (x) => x === r
                                );
                                if (idx2 >= 0)
                                  handleRemoveCalendarDateRow(idx2);
                              }}>
                              <Delete fontSize="inherit" />
                            </IconButton>
                          </Box>
                        ))}
                      {calendarDateRows.filter(
                        (r) => r.service_id === cdServiceId
                      ).length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          {modalUi.helperText.noExceptions}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Step 3: Preview tables */}
          {activeStep === 3 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                {modalUi.preview.title}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {modalUi.preview.calendar}
                  </Typography>
                  <Box
                    sx={{
                      overflow: "auto",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                    }}>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {[
                            modalUi.fields.serviceId,
                            ...modalUi.daysShort,
                            modalUi.fields.startDate,
                            modalUi.fields.endDate,
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: 8,
                                borderBottom:
                                  "1px solid var(--mui-palette-divider)",
                              }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewCalendar.map((r, i) => (
                          <tr key={i}>
                            <td style={{ padding: 8 }}>{r.service_id}</td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.monday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.tuesday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.wednesday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.thursday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.friday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.saturday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <DayIcon value={Number(r.sunday) === 1} />
                            </td>
                            <td style={{ padding: 8 }}>{r.start_date}</td>
                            <td style={{ padding: 8 }}>{r.end_date}</td>
                          </tr>
                        ))}

                        {previewCalendar.length === 0 && (
                          <tr>
                            <td
                              colSpan={10}
                              style={{ padding: 8, color: "gray" }}>
                              {modalUi.placeholders.none}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1,
                      mb: 1,
                    }}>
                    <Typography variant="body2">{modalUi.preview.exceptions}</Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexWrap: "wrap",
                      }}>
                      <Select
                        value={pvService}
                        onChange={(e) => setPvService(e.target.value)}
                        variant="standard"
                        displayEmpty
                        renderValue={(v) => (v ? v : modalUi.placeholders.all)}
                        sx={{ minWidth: 160 }}>
                        <MenuItem value="">{modalUi.placeholders.all}</MenuItem>
                        {pvServiceOptions.map((sid) => (
                          <MenuItem key={sid} value={sid}>
                            {sid}
                          </MenuItem>
                        ))}
                      </Select>

                      <ToggleButtonGroup
                        value={pvType}
                        exclusive
                        size="small"
                        onChange={(e, v) => v !== null && setPvType(v)}>
                        <ToggleButton value={0}>{modalUi.placeholders.all}</ToggleButton>
                        <ToggleButton value={1}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: "success.main",
                              mr: 1,
                            }}
                          />
                          {modalUi.exceptionType.added}
                        </ToggleButton>
                        <ToggleButton value={2}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: "error.main",
                              mr: 1,
                            }}
                          />
                          {modalUi.exceptionType.removed}
                        </ToggleButton>
                      </ToggleButtonGroup>

                      <DatePicker
                        label={modalUi.fields.start}
                        value={pvStart}
                        onChange={setPvStart}
                        format="yyyy/MM/dd"
                        slotProps={{
                          textField: {
                            variant: "standard",
                            sx: { minWidth: 140 },
                          },
                        }}
                      />
                      <DatePicker
                        label={modalUi.fields.end}
                        value={pvEnd}
                        onChange={setPvEnd}
                        format="yyyy/MM/dd"
                        slotProps={{
                          textField: {
                            variant: "standard",
                            sx: { minWidth: 140 },
                          },
                        }}
                      />
                      <Button
                        onClick={() => {
                          setPvService("");
                          setPvType(0);
                          setPvStart(null);
                          setPvEnd(null);
                        }}>
                        {GTFS.common.actions.reset}
                      </Button>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      overflow: "auto",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                    }}>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {[modalUi.fields.serviceId, modalUi.fields.date, modalUi.fields.type].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: 8,
                                borderBottom:
                                  "1px solid var(--mui-palette-divider)",
                              }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreviewCalendarDates.map((r, i) => (
                          <tr key={i}>
                            <td style={{ padding: 8 }}>{r.service_id}</td>
                            <td style={{ padding: 8 }}>{r.date}</td>
                            <td style={{ padding: 8 }}>
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor:
                                      r.exception_type === 1
                                        ? "success.main"
                                        : "error.main",
                                  }}
                                />
                                <span>
                                  {r.exception_type === 1
                                    ? modalUi.exceptionType.added
                                    : modalUi.exceptionType.removed}
                                </span>
                              </Box>
                            </td>
                          </tr>
                        ))}
                        {filteredPreviewCalendarDates.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              style={{ padding: 8, color: "gray" }}>
                              {modalUi.preview.noMatches}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </LocalizationProvider>
      </DialogContent>

      <DialogActions>
        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 1,
          }}>
          <Button onClick={onClose}>{GTFS.common.actions.cancel}</Button>
          <Box>
            {activeStep > 0 && (
              <Button onClick={goBack} sx={{ mr: 1 }}>
                {modalUi.actions.back}
              </Button>
            )}
            {activeStep < steps.length - 1 ? (
              <Button
                onClick={() => {
                  if (
                    activeStep === 0 &&
                    Object.keys(formik0.errors).length > 0
                  )
                    return;
                  if (
                    (activeStep === 0 ||
                      activeStep === 1 ||
                      activeStep === 2) &&
                    ctxLoading
                  )
                    return;
                  if (activeStep === 0 && !formik0.values.scenario_name?.trim())
                    return;
                  setActiveStep((s) => Math.min(s + 1, steps.length - 1));
                }}
                variant="contained"
                disabled={
                  (activeStep === 0 &&
                    Object.keys(formik0.errors).length > 0) ||
                  ctxLoading
                }>
                {modalUi.actions.next}
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  const payload = buildPayload();
                  setSubmitting(true);
                  try {
                    await onSubmit(payload);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                variant="contained"
                disabled={submitting}>
                {submitting ? modalUi.status.submitting : GTFS.common.actions.update}
              </Button>
            )}
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
