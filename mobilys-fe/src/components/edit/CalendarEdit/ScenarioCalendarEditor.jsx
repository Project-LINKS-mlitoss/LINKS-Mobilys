import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Switch,
  Button,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Chip,
  TextField,
} from "@mui/material";
import {
  DatePicker,
  DateCalendar,
  LocalizationProvider,
  PickersDay,
} from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import ja from "date-fns/locale/ja";
import { alpha } from "@mui/material/styles";
import { directionMap } from "../../../constant/gtfs";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES, ERRORS } from "../../../constant";

/* ---------- helpers ---------- */
function formatDateISO(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const d2 = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d2}`;
}
const safeStr = (v) => (v == null || v === "" ? "—" : String(v));

const emptyCalendarRow = (o = {}) => ({
  service_id: "",
  monday: 1,
  tuesday: 1,
  wednesday: 1,
  thursday: 1,
  friday: 1,
  saturday: 0,
  sunday: 0,
  start_date: null,
  end_date: null,
  ...o,
});
const emptyCalendarDateRow = (o = {}) => ({
  service_id: "",
  date: null,
  exception_type: 1, // 1=追加, 2=運休
  ...o,
});

function normalizeCalendar(rows, scenStart, scenEnd) {
  const s = formatDateISO(scenStart),
    e = formatDateISO(scenEnd);
  return (rows || [])
    .filter((r) => r.service_id?.trim())
    .map((r) => ({
      service_id: r.service_id.trim(),
      monday: +!!r.monday,
      tuesday: +!!r.tuesday,
      wednesday: +!!r.wednesday,
      thursday: +!!r.thursday,
      friday: +!!r.friday,
      saturday: +!!r.saturday,
      sunday: +!!r.sunday,
      start_date: formatDateISO(r.start_date) || s,
      end_date: formatDateISO(r.end_date) || e,
    }));
}
function normalizeCalendarDates(rows) {
  return (rows || [])
    .filter((r) => r.service_id?.trim() && r.date)
    .map((r) => ({
      service_id: r.service_id.trim(),
      date: formatDateISO(r.date),
      exception_type: Number(r.exception_type) === 2 ? 2 : 1,
    }));
}
function mapByService(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.service_id, r);
  return m;
}
function keyCD(r) {
  return `${r.service_id}__${r.date}`;
}
function mapCalendarDates(rows) {
  const m = new Map();
  for (const r of rows) m.set(keyCD(r), r);
  return m;
}

function parseCalendarServiceError(err) {
  if (!err) return null;

  const data = (err && err.response && err.response.data) ? err.response.data : err;

  let rawMessage = "";

  if (typeof data.error === "string") {
    rawMessage = data.error;
  }
  else if (data.error && typeof data.error.message === "string") {
    rawMessage = data.error.message;
  }
  else if (typeof data.message === "string") {
    rawMessage = data.message;
  }
  else if (typeof err.message === "string") {
    rawMessage = err.message;
  }

  if (!rawMessage) return null;

  const listMatch = rawMessage.match(/^\s*\[(["'])([\s\S]*?)\1\s*\]\s*$/);
  if (listMatch) {
    rawMessage = listMatch[2];
  }

  rawMessage = rawMessage.replace(/\\n/g, "\n");

  rawMessage = rawMessage.replace(/^["']/, "").replace(/["']$/, "");

  const lines = rawMessage
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { headerMessage: rawMessage, rows: [] };
  }

  let headerMessage = lines[0];

  const allRows = lines
    .slice(1)
    .map((l) => {
      let line = l;
      if (line.startsWith("-")) line = line.slice(1).trim();
      const obj = {};
      line.split(/,\s*/).forEach((part) => {
        const m = part.match(/^([^:]+):\s*(.*)$/);
        if (m) {
          const key = m[1].trim();
          let value = m[2].trim();
          value = value.replace(/["'\]]+$/, "");
          obj[key] = value;
        }
      });
      return obj;
    })
    .filter((o) => Object.keys(o).length > 0);

  const patternRows = allRows.filter((r) =>
    Object.prototype.hasOwnProperty.call(r, "pattern_id")
  );

  return {
    headerMessage,
    rows: patternRows.length ? patternRows : allRows,
    serviceIds: Array.isArray(data.error?.service_ids)
      ? data.error.service_ids
      : undefined,
    trips: Array.isArray(data.error?.trips) ? data.error.trips : undefined,
  };
}


/* ---------- UI smalls ---------- */
const HeaderJPWithSub = ({ jp, sub }) => (
  <Box>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {jp}
    </Typography>
    <Typography
      variant="caption"
      sx={{
        color: "text.secondary",
        display: "block",
        mt: 0.25,
        lineHeight: 1,
      }}
    >
      {sub}
    </Typography>
  </Box>
);

const BlueDot = () => (
  <Box
    sx={{
      width: 10,
      height: 10,
      borderRadius: "50%",
      bgcolor: "primary.main",
      display: "inline-block",
      verticalAlign: "middle",
    }}
  />
);

/* ---------- component ---------- */
export default function ScenarioCalendarEditor({
  scenarioStart = null,
  scenarioEnd = null,
  initialCalendar = [emptyCalendarRow()],
  initialCalendarDates = [emptyCalendarDateRow()],
  onChange,
  onSaveCalendar,
  onSaveCalendarDates,
}) {
  const scenStart = scenarioStart ? new Date(scenarioStart) : null;
  const scenEnd = scenarioEnd ? new Date(scenarioEnd) : null;

  const [calendarRows, setCalendarRows] = useState(
    initialCalendar.length
      ? initialCalendar
      : [emptyCalendarRow({ start_date: scenStart, end_date: scenEnd })]
  );
  const [calendarDateRows, setCalendarDateRows] = useState(
    initialCalendarDates.length
      ? initialCalendarDates
      : [emptyCalendarDateRow()]
  );
  const [baselineCal, setBaselineCal] = useState(initialCalendar);
  const [baselineCD, setBaselineCD] = useState(initialCalendarDates);

  useEffect(() => {
    setCalendarRows(
      initialCalendar.length
        ? initialCalendar
        : [emptyCalendarRow({ start_date: scenStart, end_date: scenEnd })]
    );
    setBaselineCal(initialCalendar); // eslint-disable-next-line
  }, [initialCalendar]);
  useEffect(() => {
    setCalendarDateRows(
      initialCalendarDates.length
        ? initialCalendarDates
        : [emptyCalendarDateRow()]
    );
    setBaselineCD(initialCalendarDates);
  }, [initialCalendarDates]);

  const [tab, setTab] = useState(0);

  const serviceIdUnion = useMemo(() => {
    const s = new Set();
    calendarRows.forEach((r) => r.service_id && s.add(r.service_id));
    calendarDateRows.forEach((r) => r.service_id && s.add(r.service_id));
    return [...s];
  }, [calendarRows, calendarDateRows]);

  const [cdServiceId, setCdServiceId] = useState(serviceIdUnion[0] || "");
  useEffect(() => {
    if (!serviceIdUnion.includes(cdServiceId))
      setCdServiceId(serviceIdUnion[0] || "");
    // eslint-disable-next-line
  }, [serviceIdUnion.join("|")]);

  const [cdType, setCdType] = useState(1); // 1=追加, 2=運休
  const [cdSelectedDate, setCdSelectedDate] = useState(
    scenStart || new Date()
  );

  const exceptionsForSelected = useMemo(
    () =>
      calendarDateRows
        .filter((r) => r.service_id === cdServiceId && r.date)
        .reduce((a, r) => {
          a[formatDateISO(r.date)] = r.exception_type;
          return a;
        }, {}),
    [calendarDateRows, cdServiceId]
  );

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
        }
      >
        <PickersDay
          {...other}
          day={day}
          outsideCurrentMonth={outsideCurrentMonth}
        />
      </Badge>
    );
  };

  const handleClickDay = (day) => {
    if (!cdServiceId || !day) return;
    const iso = formatDateISO(day);
    if (!iso) return;
    if (scenStart && new Date(iso) < new Date(formatDateISO(scenStart))) return;
    if (scenEnd && new Date(iso) > new Date(formatDateISO(scenEnd))) return;
    setCdSelectedDate(day);
    const idx = calendarDateRows.findIndex(
      (r) => r.service_id === cdServiceId && formatDateISO(r.date) === iso
    );
    if (idx === -1) {
      setCalendarDateRows((rows) => [
        ...rows,
        emptyCalendarDateRow({
          service_id: cdServiceId,
          date: day,
          exception_type: cdType,
        }),
      ]);
    } else {
      setCalendarDateRows((rows) => {
        const c = [...rows];
        const curr = c[idx];
        if (curr.exception_type === cdType) c.splice(idx, 1);
        else c[idx] = { ...curr, exception_type: cdType };
        return c;
      });
    }
  };

  const handleAddCalendarRow = () =>
    setCalendarRows((rows) => [
      ...rows,
      emptyCalendarRow({ start_date: scenStart, end_date: scenEnd }),
    ]);
  const handleRemoveCalendarRow = (idx) =>
    setCalendarRows((rows) => rows.filter((_, i) => i !== idx));
  const handleRemoveCalendarDateRow = (idx) =>
    setCalendarDateRows((rows) => rows.filter((_, i) => i !== idx));

  // bubble values
  const buildCalendarPayload = () =>
    normalizeCalendar(calendarRows, scenStart, scenEnd);
  const buildCalendarDatesPayload = () =>
    normalizeCalendarDates(calendarDateRows);
  useEffect(() => {
    onChange?.({
      calendar: buildCalendarPayload(),
      calendar_dates: buildCalendarDatesPayload(),
    });
    // eslint-disable-next-line
  }, [calendarRows, calendarDateRows, scenarioStart, scenarioEnd]);

  // diffs
  const baselineCalNormalized = useMemo(
    () => normalizeCalendar(baselineCal, scenStart, scenEnd),
    [baselineCal, scenStart, scenEnd]
  );
  const currentCalNormalized = useMemo(
    () => buildCalendarPayload(),
    // eslint-disable-next-line
    [calendarRows, scenStart, scenEnd]
  );
  const baselineCDNormalized = useMemo(
    () => normalizeCalendarDates(baselineCD),
    [baselineCD]
  );
  const currentCDNormalized = useMemo(
    () => buildCalendarDatesPayload(),
    [calendarDateRows]
  );

  function diffCalendar(prev, cur) {
    const pm = mapByService(prev),
      cm = mapByService(cur);
    const added = [],
      removed = [],
      updated = [];
    for (const [sid, now] of cm.entries()) {
      const before = pm.get(sid);
      if (!before) added.push(now);
      else {
        const ch = [];
        for (const k of [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
          "start_date",
          "end_date",
        ]) {
          if (String(now[k]) !== String(before[k]))
            ch.push({ field: k, before: before[k], after: now[k] });
        }
        if (ch.length)
          updated.push({ service_id: sid, changes: ch, before, after: now });
      }
    }
    for (const [sid, before] of pm.entries()) {
      if (!cm.has(sid)) removed.push(before);
    }
    return { added, removed, updated };
  }
  function diffCalendarDates(prev, cur) {
    const pm = mapCalendarDates(prev),
      cm = mapCalendarDates(cur);
    const added = [],
      removed = [],
      updated = [];
    for (const [k, now] of cm.entries()) {
      const b = pm.get(k);
      if (!b) added.push(now);
      else if (+b.exception_type !== +now.exception_type)
        updated.push({ key: k, before: b, after: now });
    }
    for (const [k, b] of pm.entries()) {
      if (!cm.has(k)) removed.push(b);
    }
    return { added, removed, updated };
  }

  const calDiff = useMemo(
    () => diffCalendar(baselineCalNormalized, currentCalNormalized),
    [baselineCalNormalized, currentCalNormalized]
  );
  const cdDiff = useMemo(
    () => diffCalendarDates(baselineCDNormalized, currentCDNormalized),
    [baselineCDNormalized, currentCDNormalized]
  );

  const hasCalChanges =
    calDiff.added.length + calDiff.removed.length + calDiff.updated.length > 0;
  const hasCDChanges =
    cdDiff.added.length + cdDiff.removed.length + cdDiff.updated.length > 0;

  const changedFieldsBySid = useMemo(() => {
    const m = new Map();
    calDiff.updated.forEach((u) =>
      m.set(u.service_id, new Set(u.changes.map((c) => String(c.field))))
    );
    calDiff.added.forEach((r) =>
      m.set(
        r.service_id,
        new Set([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
          "start_date",
          "end_date",
        ])
      )
    );
    return m;
  }, [calDiff]);

  // confirm/save
  const [confirmCalOpen, setConfirmCalOpen] = useState(false);
  const [confirmCDOpen, setConfirmCDOpen] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const [savingCD, setSavingCD] = useState(false);

  // calendar-specific error info (for delete-in-use case)
  const [calError, setCalError] = useState(null);

  const openConfirmCal = () => {
    setCalError(null);
    setConfirmCalOpen(true);
  };
  const closeConfirmCal = () => setConfirmCalOpen(false);
  const openConfirmCD = () => setConfirmCDOpen(true);
  const closeConfirmCD = () => setConfirmCDOpen(false);

  const handleSaveCalendar = async () => {
    const payload = currentCalNormalized;
    setSavingCal(true);
    setCalError(null);
    try {
      if (onSaveCalendar) await onSaveCalendar(payload);
      setBaselineCal(calendarRows);
      setConfirmCalOpen(false);
    } catch (err) {
      const parsed = parseCalendarServiceError(err.response?.data || null);
      setCalError(parsed);
    } finally {
      setSavingCal(false);
    }
  };

  const handleSaveCalendarDates = async () => {
    const payload = currentCDNormalized;
    setSavingCD(true);
    try {
      if (onSaveCalendarDates) await onSaveCalendarDates(payload);
      setBaselineCD(calendarDateRows);
      setConfirmCDOpen(false);
    } finally {
      setSavingCD(false);
    }
  };

  /* ---------- layout params ---------- */
  const compactSwitchSx = { transform: "scale(0.85)", mx: -0.5 };
  // grid: service | 7 days | start | end | trash
  const rowGridSx = {
    display: "grid",
    gridTemplateColumns: "160px repeat(7,56px) 150px 150px 56px",
    alignItems: "center",
    columnGap: 4,
  };
  const MIN_TABLE_WIDTH = 980;

  const headerRow = (
    <Box sx={{ ...rowGridSx, px: 1, py: 0.5, color: "text.secondary" }}>
      <HeaderJPWithSub jp={LABELS.common.serviceId} sub={LABELS.gtfs.serviceId} />
      <Box>{LABELS.days.monday}</Box>
      <Box>{LABELS.days.tuesday}</Box>
      <Box>{LABELS.days.wednesday}</Box>
      <Box>{LABELS.days.thursday}</Box>
      <Box>{LABELS.days.friday}</Box>
      <Box>{LABELS.days.saturday}</Box>
      <Box>{LABELS.days.sunday}</Box>
      <HeaderJPWithSub jp={LABELS.common.startDate} sub={LABELS.gtfs.startDate} />
      <HeaderJPWithSub jp={LABELS.common.endDate} sub={LABELS.gtfs.endDate} />
      <Box></Box>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Box sx={{ display: "grid", gap: 3 }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 1 }}>
          <Tab label={LABELS.calendar.tabCalendar} />
          <Tab label={LABELS.calendar.tabException} />
        </Tabs>

        {/* ---------- Tab 0: 運行カレンダー ---------- */}
        {tab === 0 && (
          <>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={openConfirmCal}
                disabled={!hasCalChanges || savingCal}
              >
                {savingCal ? BUTTONS.common.sending : BUTTONS.common.save}
              </Button>
              {hasCalChanges && (
                <Button
                  size="small"
                  onClick={() => setCalendarRows(baselineCal)}
                >
                  {BUTTONS.common.reset}
                </Button>
              )}
            </Box>

            {/* Editor */}
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ minWidth: MIN_TABLE_WIDTH }}>
                  <Box
                    sx={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      bgcolor: "background.default",
                      borderBottom: 1,
                      borderColor: "divider",
                    }}
                  >
                    {headerRow}
                  </Box>

                  <Box sx={{ p: 1 }}>
                    {calendarRows.map((row, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          ...rowGridSx,
                          py: 0.5,
                          "&:not(:last-child)": {
                            borderBottom: 1,
                            borderColor: "divider",
                          },
                        }}
                      >
                        {/* service id */}
                        <TextField
                          variant="standard"
                          placeholder={LABELS.calendar.exampleWeekday}
                          value={row.service_id}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCalendarRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, service_id: v } : r
                              )
                            );
                          }}
                        />

                        {/* days */}
                        {[
                          "monday",
                          "tuesday",
                          "wednesday",
                          "thursday",
                          "friday",
                          "saturday",
                          "sunday",
                        ].map((key) => (
                          <Box
                            key={key}
                            sx={{ display: "flex", alignItems: "center" }}
                          >
                            <Switch
                              size="small"
                              sx={compactSwitchSx}
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
                          </Box>
                        ))}

                        {/* start / end */}
                        <DatePicker
                          value={row.start_date || scenStart || null}
                          onChange={(val) =>
                            setCalendarRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, start_date: val } : r
                              )
                            )
                          }
                          minDate={scenStart || undefined}
                          maxDate={scenEnd || undefined}
                          format="yyyy/MM/dd"
                          slotProps={{
                            textField: {
                              variant: "standard",
                              fullWidth: true,
                            },
                          }}
                        />
                        <DatePicker
                          value={row.end_date || scenEnd || null}
                          onChange={(val) =>
                            setCalendarRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, end_date: val } : r
                              )
                            )
                          }
                          minDate={row.start_date || scenStart || undefined}
                          maxDate={scenEnd || undefined}
                          format="yyyy/MM/dd"
                          slotProps={{
                            textField: {
                              variant: "standard",
                              fullWidth: true,
                            },
                          }}
                        />

                        {/* delete */}
                        <Box sx={{ textAlign: "left" }}>
                          <Tooltip title={MESSAGES.calendar.deleteTooltip}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleRemoveCalendarRow(idx)}
                              sx={{
                                minWidth: 40,
                                height: 32,
                                p: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              aria-label={BUTTONS.common.delete}
                            >
                              <span className="material-symbols-outlined outlined">
                                delete
                              </span>
                            </Button>
                          </Tooltip>
                        </Box>
                      </Box>
                    ))}

                    {calendarRows.length === 0 && (
                      <Box sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {MESSAGES.calendar.noServices}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* + kiri bawah */}
            <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1 }}>
              <Tooltip title={MESSAGES.calendar.addServiceTooltip}>
                <IconButton size="small" onClick={handleAddCalendarRow}>
                  <span className="material-symbols-outlined outlined">
                    add
                  </span>
                </IconButton>
              </Tooltip>
            </Box>

            {/* Confirm (blue dot / dash) */}
            <Dialog
              open={confirmCalOpen}
              onClose={closeConfirmCal}
              fullWidth
              maxWidth="lg"
              scroll="paper"
              PaperProps={{ sx: { maxHeight: "80vh" } }}
            >
              <DialogTitle>{MESSAGES.common.confirmChanges}</DialogTitle>
              <DialogContent dividers sx={{ maxHeight: "70vh" }}>
                {calError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        mb: calError.rows && calError.rows.length ? 1 : 0,
                      }}
                    >
                      {calError.headerMessage || MESSAGES.calendar.serviceDeleteFailed}
                    </Typography>
                    {calError.rows && calError.rows.length > 0 && (
                      <Table size="small" sx={{ mt: 1 }}>
                        <TableBody>
                          <TableRow>
                            <TableCell>
                              <Box>
                                <Typography
                                  fontWeight="bold"
                                  fontSize={14}
                                  noWrap
                                >
                                  {LABELS.common.patternId}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography
                                  fontWeight="bold"
                                  fontSize={14}
                                  noWrap
                                >
                                  {LABELS.common.direction}
                                </Typography>
                                <Typography
                                  fontSize={12}
                                  color="text.secondary"
                                >
                                  direction_id
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography
                                  fontWeight="bold"
                                  fontSize={14}
                                  noWrap
                                >
                                  {LABELS.common.serviceId}
                                </Typography>
                                <Typography
                                  fontSize={12}
                                  color="text.secondary"
                                >
                                  service_id
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography
                                  fontWeight="bold"
                                  fontSize={14}
                                  noWrap
                                >
                                  {LABELS.common.section}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                          {calError.rows.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.pattern_id || ""}</TableCell>
                              <TableCell>
                                {(() => {
                                  const hasId =
                                    row.direction_id !== undefined &&
                                    row.direction_id !== null &&
                                    row.direction_id !== "";
                                  if (!hasId) return "";
                                  const idStr = String(row.direction_id);
                                  const label = directionMap?.[idStr] ?? "";
                                  const norm = String(label).replace(/\s/g, "");
                                  if (
                                    norm.startsWith(idStr) ||
                                    norm.startsWith(idStr + ":") ||
                                    norm.startsWith(idStr + "：")
                                  ) {
                                    return label;
                                  }
                                  return `${idStr}: ${label}`;
                                })()}
                              </TableCell>
                              <TableCell>{row.service_id || ""}</TableCell>
                              <TableCell>
                                {formatSectionLabel(
                                  row.first_and_last_stop_name
                                ) || ""}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Alert>
                )}

                {!calError &&
                  <Typography
                    variant="body2"
                    sx={{ mb: 1, color: "text.secondary" }}
                  >
                    <strong>黄色で強調</strong>
                    {MESSAGES.common.yellowHighlight.replace("黄色で強調", "")}
                  </Typography>
                }
                {!calError &&
                  <TableContainer
                    sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
                  >
                    <Table size="small" stickyHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ width: 180 }}>
                            <HeaderJPWithSub
                              jp={LABELS.common.serviceId}
                              sub={LABELS.gtfs.serviceId}
                            />
                          </TableCell>
                          <TableCell>{LABELS.days.monday}</TableCell>
                          <TableCell>{LABELS.days.tuesday}</TableCell>
                          <TableCell>{LABELS.days.wednesday}</TableCell>
                          <TableCell>{LABELS.days.thursday}</TableCell>
                          <TableCell>{LABELS.days.friday}</TableCell>
                          <TableCell>{LABELS.days.saturday}</TableCell>
                          <TableCell>{LABELS.days.sunday}</TableCell>
                          <TableCell>
                            <HeaderJPWithSub
                              jp={LABELS.common.startDate}
                              sub={LABELS.gtfs.startDate}
                            />
                          </TableCell>
                          <TableCell>
                            <HeaderJPWithSub
                              jp={LABELS.common.endDate}
                              sub={LABELS.gtfs.endDate}
                            />
                          </TableCell>
                          <TableCell sx={{ width: 80 }} align="center">
                            {LABELS.common.status}
                          </TableCell>
                        </TableRow>

                        {currentCalNormalized.map((r, i) => {
                          const changedSet =
                            changedFieldsBySid.get(r.service_id) || new Set();
                          const isNew = changedSet.size === 9; // 7 hari + start + end
                          const cellSx = (field) =>
                            changedSet.has(field)
                              ? {
                                bgcolor: (t) =>
                                  alpha(t.palette.warning.main, 0.18),
                              }
                              : undefined;
                          const DotOrDash = (v) => (v ? <BlueDot /> : "—");

                          return (
                            <TableRow key={`${r.service_id}-${i}`}>
                              <TableCell sx={{ fontWeight: 600 }}>
                                {r.service_id}
                              </TableCell>
                              <TableCell sx={cellSx("monday")}>
                                {DotOrDash(+r.monday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("tuesday")}>
                                {DotOrDash(+r.tuesday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("wednesday")}>
                                {DotOrDash(+r.wednesday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("thursday")}>
                                {DotOrDash(+r.thursday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("friday")}>
                                {DotOrDash(+r.friday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("saturday")}>
                                {DotOrDash(+r.saturday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("sunday")}>
                                {DotOrDash(+r.sunday === 1)}
                              </TableCell>
                              <TableCell sx={cellSx("start_date")}>
                                {safeStr(r.start_date)}
                              </TableCell>
                              <TableCell sx={cellSx("end_date")}>
                                {safeStr(r.end_date)}
                              </TableCell>
                              <TableCell align="center">
                                {isNew ? (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={MESSAGES.calendar.new}
                                  />
                                ) : changedSet.size > 0 ? (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={MESSAGES.calendar.edited}
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={MESSAGES.calendar.noEdit}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {currentCalNormalized.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={11}
                              sx={{ color: "text.secondary" }}
                            >
                              {MESSAGES.common.noData}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                }
              </DialogContent>
              <DialogActions sx={{ px: 2, py: 1.5 }}>
                <Button onClick={closeConfirmCal} disabled={savingCal}>
                  {BUTTONS.common.cancel}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveCalendar}
                  disabled={savingCal || calError}
                >
                  {savingCal ? BUTTONS.common.sending : BUTTONS.common.save}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}

        {/* ---------- Tab 1: 特例日 ---------- */}
        {tab === 1 && (
          <>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={openConfirmCD}
                disabled={!hasCDChanges || savingCD}
              >
                {savingCD ? BUTTONS.common.sending : BUTTONS.common.save}
              </Button>
              {hasCDChanges && (
                <Button
                  size="small"
                  onClick={() => setCalendarDateRows(baselineCD)}
                >
                  {BUTTONS.common.reset}
                </Button>
              )}
            </Box>

            <Box sx={{ display: "grid", gap: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="subtitle1">{LABELS.calendar.inputServiceId}</Typography>

                <Select
                  value={cdServiceId}
                  onChange={(e) => setCdServiceId(e.target.value)}
                  variant="standard"
                  displayEmpty
                  renderValue={(v) => (v ? v : LABELS.calendar.serviceIdSelect)}
                  sx={{ minWidth: 240 }}
                >
                  {serviceIdUnion.map((sid) => (
                    <MenuItem key={sid} value={sid}>
                      {sid}
                    </MenuItem>
                  ))}
                </Select>

                <ToggleButtonGroup
                  value={cdType}
                  exclusive
                  onChange={(_e, v) => v && setCdType(v)}
                  size="small"
                >
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
                    {MESSAGES.calendar.serviceAdded}
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
                    {MESSAGES.calendar.serviceRemoved}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {!cdServiceId ? (
                <Alert severity="info">
                  {MESSAGES.calendar.selectServiceId} {MESSAGES.calendar.selectServiceIdHint}
                </Alert>
              ) : (
                <>
                  <DateCalendar
                    value={cdSelectedDate}
                    onChange={handleClickDay}
                    minDate={scenStart || undefined}
                    maxDate={scenEnd || undefined}
                    slots={{ day: ServerDay }}
                  />

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {MESSAGES.calendar.selectedCount(
                        calendarDateRows.filter(
                          (r) => r.service_id === cdServiceId
                        ).length
                      )}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {calendarDateRows
                        .filter((r) => r.service_id === cdServiceId)
                        .sort((a, b) => (a.date || 0) - (b.date || 0))
                        .map((r, idx) => (
                          <Box
                            key={`${r.service_id}-${idx}-${formatDateISO(
                              r.date
                            )}`}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 1,
                              px: 1,
                              py: 0.5,
                              borderRadius: 2,
                              border: 1,
                              borderColor: "divider",
                            }}
                          >
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
                              {formatDateISO(r.date)}（
                              {r.exception_type === 1 ? MESSAGES.calendar.serviceAdded : MESSAGES.calendar.serviceRemoved}）
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                const idx2 = calendarDateRows.findIndex(
                                  (x) => x === r
                                );
                                if (idx2 >= 0) handleRemoveCalendarDateRow(idx2);
                              }}
                              sx={{
                                minWidth: 40,
                                height: 32,
                                p: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              aria-label={BUTTONS.common.delete}
                            >
                              <span className="material-symbols-outlined outlined">
                                delete
                              </span>
                            </Button>
                          </Box>
                        ))}
                      {calendarDateRows.filter(
                        (r) => r.service_id === cdServiceId
                      ).length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            {MESSAGES.calendar.noExceptions}
                          </Typography>
                        )}
                    </Box>
                  </Box>
                </>
              )}
            </Box>

            {/* Confirm 特例日 */}
            <Dialog
              open={confirmCDOpen}
              onClose={closeConfirmCD}
              fullWidth
              maxWidth="md"
              scroll="paper"
              PaperProps={{ sx: { maxHeight: "80vh" } }}
            >
              <DialogTitle>{MESSAGES.common.confirmChanges}</DialogTitle>
              <DialogContent dividers sx={{ maxHeight: "70vh", p: 0 }}>
                {cdDiff.added.length +
                  cdDiff.removed.length +
                  cdDiff.updated.length ===
                  0 ? (
                  <Box sx={{ p: 2 }}>
                    <Alert severity="info">{MESSAGES.common.noChanges}</Alert>
                  </Box>
                ) : (
                  <Box sx={{ p: 2, display: "grid", gap: 2 }}>
                    {cdDiff.added.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {MESSAGES.calendar.serviceAdded}（{cdDiff.added.length}）
                        </Typography>
                        <TableContainer sx={{ maxHeight: 240 }}>
                          <Table size="small" stickyHeader>
                            <TableBody>
                              {cdDiff.added.map((r, i) => (
                                <TableRow key={`cd-add-${i}`}>
                                  <TableCell
                                    sx={{ fontWeight: 600, width: 180 }}
                                  >
                                    {r.service_id}
                                  </TableCell>
                                  <TableCell sx={{ width: 160 }}>
                                    {r.date}
                                  </TableCell>
                                  <TableCell>
                                    {r.exception_type === 1
                                      ? MESSAGES.calendar.serviceAdded
                                      : MESSAGES.calendar.serviceRemoved}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                    {cdDiff.removed.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {BUTTONS.common.delete}（{cdDiff.removed.length}）
                        </Typography>
                        <TableContainer sx={{ maxHeight: 240 }}>
                          <Table size="small" stickyHeader>
                            <TableBody>
                              {cdDiff.removed.map((r, i) => (
                                <TableRow key={`cd-rm-${i}`}>
                                  <TableCell
                                    sx={{ fontWeight: 600, width: 180 }}
                                  >
                                    {r.service_id}
                                  </TableCell>
                                  <TableCell sx={{ width: 160 }}>
                                    {r.date}
                                  </TableCell>
                                  <TableCell>
                                    {r.exception_type === 1
                                      ? MESSAGES.calendar.serviceAdded
                                      : MESSAGES.calendar.serviceRemoved}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                    {cdDiff.updated.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {MESSAGES.calendar.edited}（{cdDiff.updated.length}）
                        </Typography>
                        <TableContainer sx={{ maxHeight: 240 }}>
                          <Table size="small" stickyHeader>
                            <TableBody>
                              {cdDiff.updated.map((u, i) => (
                                <TableRow key={`cd-upd-${i}`}>
                                  <TableCell
                                    sx={{ fontWeight: 600, width: 180 }}
                                  >
                                    {u.after.service_id}
                                  </TableCell>
                                  <TableCell sx={{ width: 160 }}>
                                    {u.after.date}
                                  </TableCell>
                                  <TableCell
                                    sx={{ width: 32, textAlign: "center" }}
                                  >
                                    →
                                  </TableCell>
                                  <TableCell>
                                    {u.before.exception_type === 1
                                      ? MESSAGES.calendar.serviceAdded
                                      : MESSAGES.calendar.serviceRemoved}{" "}
                                    {MESSAGES.calendar.from}{" "}
                                    {u.after.exception_type === 1
                                      ? MESSAGES.calendar.serviceAdded
                                      : MESSAGES.calendar.serviceRemoved}{" "}
                                    {MESSAGES.calendar.changedTo}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 2, py: 1.5 }}>
                <Button onClick={closeConfirmCD} disabled={savingCD}>
                  {BUTTONS.common.cancel}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveCalendarDates}
                  disabled={savingCD}
                >
                  {savingCD ? BUTTONS.common.sending : BUTTONS.common.save}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
}
