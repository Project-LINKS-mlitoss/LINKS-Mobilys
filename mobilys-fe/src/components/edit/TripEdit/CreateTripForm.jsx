// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Typography,
  Paper,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LargeTooltip from "../../LargeTooltip";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CreateTripConfirmDialog from "./CreateTripConfirmDialog";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

import { useSnackbarStore } from "../../../state/snackbarStore";
import { Form } from "formik";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

/* --- Two-line table header (JP + EN), same as DuplicateTrip --- */
const TwoLineHeader = ({ jp, en }) => (
  <Box>
    <Typography fontWeight="bold" fontSize={14} noWrap color="text.primary">
      {jp}
    </Typography>
    <Typography
      fontWeight="bold"
      fontSize={12}
      color="text.secondary"
      sx={{
        display: "block",
        lineHeight: "16px",
        minHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      {en || " "}
    </Typography>
  </Box>
);

/* --- helpers --- */

const DAY_SEC = 24 * 3600;

// midnight rollover threshold 
const ROLLOVER_PREV_MIN = 23 * 3600; // 23:00:00
const ROLLOVER_CURR_MAX = 3 * 3600;  // 03:00:00

const baseOfDay = (absSec) => ((absSec % DAY_SEC) + DAY_SEC) % DAY_SEC;

// between stops: prev departure late night AND current arrival early morning
const isMidnightRolloverBetweenStops = (prevDepAbs, currArrBase) => {
  if (prevDepAbs == null || currArrBase == null) return false;
  const prevBase = baseOfDay(prevDepAbs);
  return prevBase >= ROLLOVER_PREV_MIN && currArrBase <= ROLLOVER_CURR_MAX;
};

// within stop: arrival late night AND departure early morning
const isMidnightRolloverWithinStop = (arrAbs, depBase) => {
  if (arrAbs == null || depBase == null) return false;
  const arrBase = baseOfDay(arrAbs);
  return arrBase >= ROLLOVER_PREV_MIN && depBase <= ROLLOVER_CURR_MAX;
};

const nextDayLabel = (off) => {
  if (off <= 0) return "";
  if (off === 1) return LABELS.trip.nextDay;
  if (off === 2) return LABELS.trip.nextNextDay;
  return LABELS.trip.daysAfter(off);
};

// wrap to 00–23 so <input type="time"> stays valid
const wrapToDayHHMMSS = (sec) => {
  const s = ((Number(sec) % 86400) + 86400) % 86400;
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
};

const parseTime = (t) => (t ? dayjs(t, ["HH:mm:ss", "HH:mm"]) : null);
const formatTime = (d) =>
  d && typeof d.isValid === "function" && d.isValid() ? d.format("HH:mm:ss") : "";

// Always return "HH:mm:ss" (append :00 if seconds omitted by the browser)
const normalizeHHMMSS = (t) =>
  !t ? "" : /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : `${t}:00`;

const toSeconds = (t) => {
  if (!t) return null;
  const [hh = "0", mm = "0", ss = "0"] = String(t).split(":");
  const h = parseInt(hh, 10),
    m = parseInt(mm, 10),
    s = parseInt(ss, 10);
  if ([h, m, s].some(Number.isNaN)) return null;
  return h * 3600 + m * 60 + s;
};

const fromSeconds = (sec) => {
  const s = Math.max(0, Number(sec | 0));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
};

// format absolute seconds into GTFS extended time string
const toExtendedHHMMSS = (sec) => {
  const s = Math.max(0, Number(sec | 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

// 27:00:00 cap (inclusive)
const MAX_EXT_SECONDS = 27 * 3600;

/**
 * single-source inference for:
 * - absolute timeline seconds (0..27h)
 * - is_*_next_day flags (for ※翌日 display before 保存)
 *
 * ✅ Same gating as EditTripForm:
 * - Only roll to 翌日 when it looks like a real midnight rollover (23:xx -> 00-03:xx)
 * - Otherwise keep same-day and let validation show errors (do not auto-cascade 翌日)
 */
const inferAbsAndFlags = (seq) => {
  let dayOffset = 0;     // 0 or 86400
  let prevDepAbs = null; // timeline anchor

  return seq.map((row, idx) => {
    const arrBase = row.arrival_time ? toSeconds(normalizeHHMMSS(row.arrival_time)) : null;
    const depBase = row.departure_time ? toSeconds(normalizeHHMMSS(row.departure_time)) : null;

    // first row is always same-day in UI flags
    if (idx === 0) {
      const arrAbs = arrBase == null ? null : arrBase;
      let depAbs = depBase == null ? null : depBase;

      // allow same-stop rollover only here (rare, but consistent)
      if (arrAbs !== null && depAbs !== null && depAbs < arrAbs) depAbs += DAY_SEC;

      if (depAbs != null) prevDepAbs = depAbs;
      else if (arrAbs != null) prevDepAbs = arrAbs;

      return {
        ...row,
        _abs: { arrAbs, depAbs },
        is_arrival_time_next_day: false,
        is_departure_time_next_day: false,
      };
    }

    // once next-day happens, stay next-day forever
    let localOffset = dayOffset;

    let arrAbs = arrBase == null ? null : arrBase + localOffset;

    // If not yet 翌日, decide rollover ONLY when it looks like midnight rollover
    if (dayOffset === 0 && arrAbs !== null && prevDepAbs !== null && arrAbs < prevDepAbs) {
      const shouldRollover = isMidnightRolloverBetweenStops(prevDepAbs, arrBase);
      if (shouldRollover) {
        localOffset += DAY_SEC;
        dayOffset = DAY_SEC;
        arrAbs += DAY_SEC;
      }
      // else: keep same-day; validator will show "前の停留所の出発時刻より早いです"
    }

    let depAbs = depBase == null ? null : depBase + localOffset;

    // same-stop rollover ONLY when it looks like midnight rollover
    if (arrAbs !== null && depAbs !== null && depAbs < arrAbs) {
      const shouldRollover = isMidnightRolloverWithinStop(arrAbs, depBase);
      if (localOffset === 0 && shouldRollover) {
        depAbs += DAY_SEC;
        dayOffset = DAY_SEC;
      }
      // else: keep same-day; validator will show "到着時刻が出発時刻を超えています"
    }

    if (depAbs != null) prevDepAbs = depAbs;
    else if (arrAbs != null) prevDepAbs = arrAbs;

    return {
      ...row,
      _abs: { arrAbs, depAbs },
      is_arrival_time_next_day: arrAbs != null ? arrAbs >= DAY_SEC : false,
      is_departure_time_next_day: depAbs != null ? depAbs >= DAY_SEC : false,
    };
  });
};

/**
 * ✅ Validation aligned with EditTripForm:
 * 1) current arrival <= current departure
 * 2) current departure <= next arrival
 * 3) no inferred abs time exceeds 27:00:00
 * 4) arrival should not be before previous departure (unless rollover; inference already gated)
 */
const validateAllStopTimes = (seq) => {
  const errors = {};
  const inferred = inferAbsAndFlags(seq);

  for (let i = 0; i < inferred.length; i++) {
    errors[i] = { arrival: null, departure: null };

    const arrAbs = inferred[i]?._abs?.arrAbs ?? null;
    const depAbs = inferred[i]?._abs?.depAbs ?? null;

    // rule 3: cap 27:00:00
    if (arrAbs !== null && arrAbs > MAX_EXT_SECONDS) {
      errors[i].arrival = MESSAGES.trip.timeLimitError;
    }
    if (depAbs !== null && depAbs > MAX_EXT_SECONDS) {
      errors[i].departure = MESSAGES.trip.timeLimitError;
    }

    // rule 1: arrival <= departure
    if (arrAbs !== null && depAbs !== null && arrAbs > depAbs) {
      errors[i].arrival = MESSAGES.trip.arrivalAfterDepartureError;
    }

    // rule 2: departure <= next arrival
    if (i < inferred.length - 1) {
      const nextArrAbs = inferred[i + 1]?._abs?.arrAbs ?? null;
      if (depAbs !== null && nextArrAbs !== null && depAbs > nextArrAbs) {
        errors[i].departure = MESSAGES.trip.departureAfterNextArrivalError;
      }
    }

    // rule 4: arrival >= previous departure (same-day; if rollover was valid, inference would have rolled)
    if (i > 0) {
      const prevDepAbs = inferred[i - 1]?._abs?.depAbs ?? null;
      if (arrAbs !== null && prevDepAbs !== null && arrAbs < prevDepAbs) {
        errors[i].arrival = MESSAGES.trip.arrivalAfterPrevDepartureError;
      }
    }

    // if we are already in 翌日, UI time must stay <= 03:00 (because 24:00–27:00)
    if (i > 0) {
      const prev = inferred[i - 1];
      const prevWasNextDay =
        !!prev?.is_arrival_time_next_day || !!prev?.is_departure_time_next_day;

      const aBase = seq[i]?.arrival_time
        ? toSeconds(normalizeHHMMSS(seq[i].arrival_time))
        : null;
      const dBase = seq[i]?.departure_time
        ? toSeconds(normalizeHHMMSS(seq[i].departure_time))
        : null;

      if (prevWasNextDay) {
        if (aBase != null && aBase > 3 * 3600) {
          errors[i].arrival = MESSAGES.trip.timeLimitError;
        }
        if (dBase != null && dBase > 3 * 3600) {
          errors[i].departure = MESSAGES.trip.timeLimitError;
        }
      }
    }
  }

  return errors;
};

const hasValidationErrors = (errors) =>
  Object.values(errors).some((e) => e?.arrival || e?.departure);

// --- field styling for error display ---
const errorFieldSx = {
  "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
    borderColor: "error.main",
    borderWidth: "2px",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "error.dark",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "error.main",
  },
};

const CreateTripForm = ({
  stops_list,
  service_id_list,
  onCancel,
  onSave,
  scenarioId,
  onSuccess,
  route_id,
  loadingTripActions,
  selectedRoutePattern,
  shapeData,
  previewShapeData,
  templateTripData,
  duplicateLock = false,
}) => {
  const [tripInfo, setTripInfo] = useState({
    trip_id: "",
    trip_short_name: "",
    trip_headsign: "",
    direction_id: "",
    service_id: "",
  });

  // Global snackbar (same style as SideNavbar)
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const showError = (title) => showSnackbar({ title, severity: "error" });

  const [selectedStop, setSelectedStop] = useState("");
  const [stopSequence, setStopSequence] = useState([]);
  const [reverseSequence, setReverseSequence] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDayHints, setShowDayHints] = useState(false); // show ※翌日 after edits/autofill/save click
  const [validationErrors, setValidationErrors] = useState({});

  // derive day offsets from inferred absolute seconds (prevents "fake 翌日 cascade")
  const dayOffsets = useMemo(() => {
    const inferred = inferAbsAndFlags(stopSequence);
    return inferred.map((row) => {
      const a = row?._abs?.arrAbs ?? null;
      const d = row?._abs?.depAbs ?? null;
      return {
        arr_off: a != null ? Math.floor(a / DAY_SEC) : 0,
        dep_off: d != null ? Math.floor(d / DAY_SEC) : 0,
      };
    });
  }, [stopSequence]);

  const enrichedStopSequence = stopSequence.map((stop) => {
    const full = stops_list.find((s) => s.stop_id === stop.stop_id);
    return {
      ...stop,
      stop_latlng: full ? [full.stop_latlng[0], full.stop_latlng[1]] : null,
    };
  });

  const templateTripId = templateTripData?.trip?.trip_id;

  const templateStopTimes = useMemo(() => {
    const st0 = Array.isArray(templateTripData?.stop_times)
      ? templateTripData.stop_times
      : [];
    if (!st0.length) return [];

    if (templateTripId != null) {
      const same = st0.filter((r) => String(r?.trip_id ?? "") === String(templateTripId));
      if (same.length) return same;
    }

    if (st0.some((r) => r?.trip_id != null)) {
      const firstId = st0[0]?.trip_id;
      return st0.filter((r) => String(r?.trip_id ?? "") === String(firstId ?? ""));
    }

    let end = st0.length;
    for (let i = 1; i < st0.length; i++) {
      const prev = Number(st0[i - 1]?.stop_sequence ?? i - 1);
      const curr = Number(st0[i]?.stop_sequence ?? i);
      if (Number.isFinite(prev) && Number.isFinite(curr) && curr <= prev) {
        end = i;
        break;
      }
    }
    return st0.slice(0, end);
  }, [templateTripId, templateTripData]);

  const isFormValid =
    (tripInfo.trip_id || "").trim() &&
    tripInfo.direction_id !== "" &&
    (tripInfo.service_id || "").trim() &&
    stopSequence.length > 0 &&
    stopSequence.every(
      (stop) => (stop.arrival_time || "").trim() && (stop.departure_time || "").trim()
    );

  const handleAddStop = () => {
    if (stopSequence.find((s) => s.stop_id === selectedStop)) return;
    const stop = stops_list.find((s) => s.stop_id === selectedStop);
    if (stop) {
      setStopSequence((prev) => [
        ...prev,
        {
          ...stop,
          arrival_time: "08:00:00",
          departure_time: "08:00:00",
          stop_sequence: prev.length + 1,
          is_arrival_time_next_day: false,
          is_departure_time_next_day: false,
        },
      ]);
      setSelectedStop("");
    }
  };

  const handleRemoveStop = (index) => {
    setStopSequence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const times = stopSequence.map((stop) => ({
      arrival_time: stop.arrival_time,
      departure_time: stop.departure_time,
    }));

    const updated = Array.from(stopSequence);
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);

    const updatedWithTimes = updated.map((stop, index) => ({
      ...stop,
      arrival_time: times[index].arrival_time,
      departure_time: times[index].departure_time,
    }));

    const inferred = inferAbsAndFlags(updatedWithTimes);
    setStopSequence(inferred.map(({ _abs, ...row }) => row));
  };

  const templateDeltas = useMemo(() => {
    const st = templateStopTimes;
    if (!Array.isArray(st) || st.length === 0) return null;
    const baseArr = toSeconds(st[0]?.arrival_time);
    const baseDep = toSeconds(st[0]?.departure_time);
    if (baseArr == null || baseDep == null) return null;

    return st.map((row) => {
      const a = toSeconds(row?.arrival_time);
      const d = toSeconds(row?.departure_time);
      return {
        arr: a == null ? 0 : a - baseArr,
        dep: d == null ? 0 : d - baseDep,
        stop_id: row?.stop_id,
        stop_name: row?.stop_name,
      };
    });
  }, [templateStopTimes]);

  useEffect(() => {
    if (templateTripData?.trip && templateStopTimes.length) {
      setTripInfo((prev) => ({
        ...prev,
        trip_id: templateTripData.trip.trip_id || "",
        trip_short_name: templateTripData.trip.trip_short_name || "",
        trip_headsign: templateTripData.trip.trip_headsign || "",
        direction_id: String(templateTripData.trip.direction_id ?? ""),
        service_id: templateTripData.trip.service_id || "",
      }));

      const baseSeq = templateStopTimes.map((st) => ({
        stop_id: st.stop_id,
        stop_name: st.stop_name,
        arrival_time: st.arrival_time || "",
        departure_time: st.departure_time || "",
        is_arrival_time_next_day: false,
        is_departure_time_next_day: false,
      }));

      const inferred = inferAbsAndFlags(baseSeq);
      const cleaned = inferred.map(({ _abs, ...row }) => row);
      setStopSequence(cleaned);

      if (cleaned.some((r) => r.is_arrival_time_next_day || r.is_departure_time_next_day)) {
        setShowDayHints(true);
      }
    }
  }, [templateTripData, templateStopTimes]);

  useEffect(() => {
    if (Object.keys(validationErrors).length > 0) {
      setValidationErrors({});
    }
  }, [stopSequence]);

  const firstArrivalSx = {
    "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
      borderColor: "grey.400",
      borderWidth: "2px",
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "grey.600",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "grey.700",
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: 1.5,
      boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.10)",
      transition: "box-shadow 120ms ease",
    },
  };

  // Confirmation popup: show 24+ times based on inferred absolute seconds
  const confirmStopSequence = useMemo(() => {
    const inferred = inferAbsAndFlags(enrichedStopSequence);
    return inferred.map((s) => {
      const arrAbs = s?._abs?.arrAbs ?? null;
      const depAbs = s?._abs?.depAbs ?? null;
      const { _abs, ...rest } = s;
      return {
        ...rest,
        arrival_time: arrAbs == null ? "" : toExtendedHHMMSS(arrAbs),
        departure_time: depAbs == null ? "" : toExtendedHHMMSS(depAbs),
      };
    });
  }, [enrichedStopSequence]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
        <Box display="flex" gap={2} justifyContent="flex-start" mb={2}>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              setShowDayHints(true);

              const errors = validateAllStopTimes(stopSequence);
              if (hasValidationErrors(errors)) {
                setValidationErrors(errors);
                showError(MESSAGES.trip.saveValidationError);
                return;
              }

              setValidationErrors({});
              const stop_ids = enrichedStopSequence.map((stop) => stop.stop_id);
              const payload = { scenario_id: scenarioId, stop_ids };
              await previewShapeData(payload);
              setShowConfirm(true);
            }}
            disabled={!isFormValid}
          >
            {BUTTONS.common.save}
          </Button>
          <Button variant="outlined" size="small" onClick={onCancel}>
            {BUTTONS.common.back}
          </Button>
        </Box>

        <Box display="flex" gap={3} width="100%">
          <Paper sx={{ p: 2, flex: 1 }}>
            <Box mb={2}>
              <Typography fontWeight="bold" fontSize={16}>
                {LABELS.trip.tripInfo}
              </Typography>
            </Box>

            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                label={`${LABELS.trip.tripId} ${LABELS.gtfs.tripId}*`}
                value={tripInfo.trip_id}
                onChange={(e) => setTripInfo({ ...tripInfo, trip_id: e.target.value })}
                helperText={LABELS.stop.uniqueIdHint}
                slotProps={{ formHelperText: { sx: { ml: 0, pl: 0, mt: 0.5 } } }}
              />

              <TextField
                label={`${LABELS.trip.tripShortName} ${LABELS.gtfs.tripShortName}`}
                value={tripInfo.trip_short_name || ""}
                onChange={(e) => setTripInfo({ ...tripInfo, trip_short_name: e.target.value })}
                disabled={duplicateLock}
              />

              <TextField
                label={`${LABELS.trip.tripHeadsign} ${LABELS.gtfs.tripHeadsign}`}
                value={tripInfo.trip_headsign || ""}
                onChange={(e) => setTripInfo({ ...tripInfo, trip_headsign: e.target.value })}
                disabled={duplicateLock}
              />

              <Box display="flex" gap={1}>
                <TextField
                  select
                  label={`${LABELS.common.direction} ${LABELS.gtfs.directionId} *`}
                  value={tripInfo.direction_id}
                  onChange={(e) => setTripInfo({ ...tripInfo, direction_id: e.target.value })}
                  fullWidth
                  disabled={duplicateLock}
                >
                  <MenuItem value="0">{LABELS.trip.directionLabel("0", LABELS.trip.inbound)}</MenuItem>
                  <MenuItem value="1">{LABELS.trip.directionLabel("1", LABELS.trip.outbound)}</MenuItem>
                </TextField>

                <TextField
                  select
                  label={`${LABELS.common.serviceId} ${LABELS.gtfs.serviceId}*`}
                  value={tripInfo.service_id}
                  onChange={(e) => setTripInfo({ ...tripInfo, service_id: e.target.value })}
                  fullWidth
                  disabled={duplicateLock}
                >
                  {service_id_list.map((id) => (
                    <MenuItem key={id} value={id}>
                      {id}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold" mb={2}>
              {LABELS.trip.stopOrder}
            </Typography>

            {!duplicateLock && (
              <>
                <FormControl fullWidth>
                  <InputLabel>{`${LABELS.trip.stopInput} *`}</InputLabel>
                  <Select
                    value={selectedStop}
                    label={`${LABELS.trip.stopInput} *`}
                    onChange={(e) => setSelectedStop(e.target.value)}
                    size="small"
                  >
                    {stops_list.map((s) => (
                      <MenuItem key={s.stop_id} value={s.stop_id}>
                        {`${s.stop_id} ${s.stop_name}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={handleAddStop}
                  disabled={!selectedStop}
                >
                  {BUTTONS.common.add}
                </Button>
              </>
            )}

            {Boolean(duplicateLock && Array.isArray(templateDeltas) && templateDeltas.length > 0) && (
              <Box sx={{ mt: 1, ml: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    if (!Array.isArray(stopSequence) || stopSequence.length === 0) return;
                    if (!Array.isArray(templateDeltas) || templateDeltas.length === 0) return;

                    const firstArrStr = normalizeHHMMSS(stopSequence[0]?.arrival_time);
                    const base = toSeconds(firstArrStr);
                    if (base == null) return;

                    let prevDepAbs = base; // timeline anchor starts from first stop

                    const next = stopSequence.map((s, idx) => {
                      if (idx === 0) {
                        return {
                          ...s,
                          arrival_time: firstArrStr,
                          departure_time: firstArrStr,
                          is_arrival_time_next_day: false,
                          is_departure_time_next_day: false,
                        };
                      }

                      const td = templateDeltas[idx];

                      // base-day seconds (0..86399) relative to first arrival
                      const arrBase = base + (td && Number.isFinite(td.arr) ? td.arr : 0);
                      const depBase = base + (td && Number.isFinite(td.dep) ? td.dep : 0);

                      // 1) roll arrival forward if it goes earlier than previous departure on timeline
                      let arrAbs = arrBase;
                      if (prevDepAbs != null && arrAbs < prevDepAbs) arrAbs += DAY_SEC;

                      // 2) same-stop rule: departure must be >= arrival (allow one rollover)
                      let depAbs = depBase;
                      if (depAbs < arrAbs) depAbs += DAY_SEC;

                      // 3) clamp ONLY for autofill
                      arrAbs = Math.min(arrAbs, MAX_EXT_SECONDS);
                      depAbs = Math.min(depAbs, MAX_EXT_SECONDS);

                      // 4) update anchor
                      prevDepAbs = depAbs;

                      // 5) convert to UI time + flags
                      const arr = fromSeconds(((arrAbs % DAY_SEC) + DAY_SEC) % DAY_SEC);
                      const dep = fromSeconds(((depAbs % DAY_SEC) + DAY_SEC) % DAY_SEC);

                      return {
                        ...s,
                        arrival_time: arr,
                        departure_time: dep,
                        is_arrival_time_next_day: arrAbs >= DAY_SEC,
                        is_departure_time_next_day: depAbs >= DAY_SEC,
                      };
                    });

                    const inferred = inferAbsAndFlags(next);
                    if (
                      inferred.some(
                        (r) =>
                          (r?._abs?.arrAbs ?? 0) > MAX_EXT_SECONDS ||
                          (r?._abs?.depAbs ?? 0) > MAX_EXT_SECONDS
                      )
                    ) {
                      showError(MESSAGES.trip.autofillTimeLimitError);
                      return;
                    }

                    setShowDayHints(true);
                    setStopSequence(inferred.map(({ _abs, ...row }) => row));
                  }}
                >
                  {LABELS.trip.autofillTimes}
                </Button>
                <LargeTooltip
                  title={LABELS.trip.autofillHint}
                >
                  <IconButton size="small" sx={{ ml: 0.5 }}>
                    <InfoOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </LargeTooltip>
              </Box>
            )}

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="stopsTable" isDropDisabled={duplicateLock}>
                {(provided) => (
                  <Table
                    size="small"
                    sx={{ mt: 2 }}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} />
                        </TableCell>
                        <TableCell>
                          <TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} />
                        </TableCell>
                        <TableCell>
                          <TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} />
                        </TableCell>
                        <TableCell>
                          <TwoLineHeader jp={LABELS.trip.arrivalTime} en={LABELS.gtfs.arrivalTime} />
                        </TableCell>
                        <TableCell>
                          <TwoLineHeader jp={LABELS.trip.departureTime} en={LABELS.gtfs.departureTime} />
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {stopSequence.map((stop, index) => (
                        <Draggable
                          key={stop.stop_id}
                          draggableId={stop.stop_id.toString()}
                          index={index}
                          isDragDisabled={duplicateLock}
                        >
                          {(provided) => (
                            <TableRow
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              sx={{ cursor: "default" }}
                            >
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{stop.stop_id}</TableCell>
                              <TableCell>{stop.stop_name}</TableCell>

                              {/* Arrival */}
                              <TableCell>
                                <TextField
                                  type="time"
                                  value={stop.arrival_time || ""}
                                  sx={
                                    validationErrors[index]?.arrival
                                      ? errorFieldSx
                                      : index === 0
                                        ? firstArrivalSx
                                        : undefined
                                  }
                                  error={!!validationErrors[index]?.arrival}
                                  onChange={(e) => {
                                    const newArrival = normalizeHHMMSS(e.target.value);
                                    const next = [...stopSequence];

                                    if (index === 0) {
                                      next[0] = {
                                        ...next[0],
                                        arrival_time: newArrival,
                                        departure_time: newArrival,
                                        is_arrival_time_next_day: false,
                                        is_departure_time_next_day: false,
                                      };
                                    } else {
                                      next[index] = { ...next[index], arrival_time: newArrival };
                                    }

                                    const inferred = inferAbsAndFlags(next);
                                    setShowDayHints(true);
                                    setStopSequence(inferred.map(({ _abs, ...row }) => row));
                                  }}
                                  inputProps={{
                                    step: 1,
                                    lang: "ja-JP",
                                    inputMode: "numeric",
                                    pattern: "[0-9:]*",
                                  }}
                                  size="small"
                                  fullWidth
                                  helperText={
                                    validationErrors[index]?.arrival ||
                                    (showDayHints &&
                                      (stop?.is_arrival_time_next_day
                                        ? LABELS.trip.nextDay
                                        : nextDayLabel(dayOffsets[index]?.arr_off)))
                                  }
                                  slotProps={{
                                    formHelperText: {
                                      sx: { mx: 0, mt: 0.5, color: "text.secondary", fontSize: "11px" },
                                    },
                                  }}
                                />
                              </TableCell>

                              {/* Departure */}
                              <TableCell>
                                <TextField
                                  type="time"
                                  value={stop.departure_time || ""}
                                  sx={validationErrors[index]?.departure ? errorFieldSx : undefined}
                                  error={!!validationErrors[index]?.departure}
                                  onChange={(e) => {
                                    const newDeparture = normalizeHHMMSS(e.target.value);
                                    const next = [...stopSequence];

                                    if (index === 0) {
                                      next[0] = {
                                        ...next[0],
                                        arrival_time: newDeparture,
                                        departure_time: newDeparture,
                                        is_arrival_time_next_day: false,
                                        is_departure_time_next_day: false,
                                      };
                                    } else {
                                      next[index] = {
                                        ...next[index],
                                        departure_time: newDeparture,
                                      };
                                    }

                                    const inferred = inferAbsAndFlags(next);
                                    setShowDayHints(true);
                                    setStopSequence(inferred.map(({ _abs, ...row }) => row));
                                  }}
                                  inputProps={{
                                    step: 1,
                                    lang: "ja-JP",
                                    inputMode: "numeric",
                                    pattern: "[0-9:]*",
                                  }}
                                  size="small"
                                  fullWidth
                                  helperText={
                                    validationErrors[index]?.departure ||
                                    (showDayHints &&
                                      (stop?.is_departure_time_next_day
                                        ? LABELS.trip.nextDay
                                        : nextDayLabel(dayOffsets[index]?.dep_off)))
                                  }
                                  slotProps={{
                                    formHelperText: {
                                      sx: { mx: 0, mt: 0.5, color: "text.secondary", fontSize: "11px" },
                                    },
                                  }}
                                />
                              </TableCell>

                              {!duplicateLock && (
                                <TableCell>
                                  <IconButton size="small" onClick={() => handleRemoveStop(index)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </TableBody>
                  </Table>
                )}
              </Droppable>
            </DragDropContext>
          </Paper>
        </Box>

        <CreateTripConfirmDialog
          open={showConfirm}
          onClose={() => {
            if (!loadingTripActions) {
              setShowConfirm(false);
            }
          }}
          onSave={onSave}
          onConfirm={async () => {
            const inferred = inferAbsAndFlags(enrichedStopSequence);

            const stop_times = inferred.map((stop, index) => ({
              stop_sequence: index + 1,
              arrival_time:
                stop?._abs?.arrAbs == null ? "" : toExtendedHHMMSS(stop._abs.arrAbs),
              departure_time:
                stop?._abs?.depAbs == null ? "" : toExtendedHHMMSS(stop._abs.depAbs),
              stop_id: stop.stop_id,
            }));

            const payload = {
              scenario_id: scenarioId,
              route_id: route_id,
              trip_short_name: tripInfo.trip_short_name || "",
              trip_headsign: tripInfo.trip_headsign || "",
              service_id: tripInfo.service_id,
              trip_id: tripInfo.trip_id,
              direction_id: parseInt(tripInfo.direction_id, 10),
              stop_times,
            };

            try {
              await onSave(payload);
              setShowConfirm(false);
              onSuccess?.();
            } catch (error) {
              console.error("Save failed:", error);
            }
          }}
          loadingTripActions={loadingTripActions}
          tripInfo={tripInfo}
          stopSequence={confirmStopSequence}
          scenarioId={scenarioId}
          shapeData={shapeData}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default CreateTripForm;
