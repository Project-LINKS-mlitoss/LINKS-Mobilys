// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useEffect, useMemo, useRef } from "react";
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
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CreateTripConfirmDialog from "./CreateTripConfirmDialog";
import { useSnackbarStore } from "../../../state/snackbarStore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LargeTooltip from "../../../components/LargeTooltip";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const DRAG_DISABLED = true;

/* --- Two-line table header (JP + EN) --- */
const TwoLineHeader = ({ jp, en }) => (
  <Box>
    <Typography fontWeight="bold" fontSize={14} noWrap color="text.primary">
      {jp}
    </Typography>
    <Typography
      fontWeight="bold"
      fontSize={12}
      color="text.secondary"
      sx={{ display: "block", lineHeight: "16px", minHeight: "16px", whiteSpace: "nowrap" }}
    >
      {en || " "}
    </Typography>
  </Box>
);

/* --- helpers --- */

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


const normalizeHHMMSS = (t) => {
  if (!t) return "";
  return /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : `${t}:00`;
};

const toSeconds = (t) => {
  if (!t) return null;
  const [hh = "0", mm = "0", ss = "0"] = String(t).split(":");
  const h = parseInt(hh, 10), m = parseInt(mm, 10), s = parseInt(ss, 10);
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

/** format service-day seconds into GTFS extended time string (HH can be 24+). */
const toExtendedHHMMSS = (sec) => {
  const s = Math.max(0, Number(sec | 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const DAY_SEC = 24 * 3600;
const MAX_SEC = 27 * 3600;

const inferAbsAndFlags = (seq) => {
  let dayOffset = 0; // 0 or 86400 (cap is 27h)
  let prevDepAbs = null;

  const abs = [];
  const out = seq.map((row, idx) => {
    const arrBase = toSeconds(normalizeHHMMSS(row.arrival_time));
    const depBase = toSeconds(normalizeHHMMSS(row.departure_time));

    // first row is always same-day in UI flags
    if (idx === 0) {
      const arrAbs = arrBase == null ? null : arrBase;
      let depAbs = depBase == null ? null : depBase;

      // same-stop rollover ONLY for first row (allowed to cross midnight)
      if (arrAbs !== null && depAbs !== null && depAbs < arrAbs) depAbs += DAY_SEC;

      abs.push({ arrAbs, depAbs });
      if (depAbs !== null) prevDepAbs = depAbs;

      return {
        ...row,
        is_arrival_time_next_day: false,
        is_departure_time_next_day: false, // first stop never shows 翌日 in UI
      };
    }

    // Once we enter 翌日, we stay 翌日 for the rest
    let localOffset = dayOffset;

    let arrAbs = arrBase == null ? null : arrBase + localOffset;

    // If not yet 翌日, decide if we need to roll based on previous departure
    if (dayOffset === 0 && arrAbs !== null && prevDepAbs !== null && arrAbs < prevDepAbs) {
      const shouldRollover = isMidnightRolloverBetweenStops(prevDepAbs, arrBase);
      if (shouldRollover) {
        localOffset += DAY_SEC;
        dayOffset = DAY_SEC; // lock into 翌日 for the rest
        arrAbs += DAY_SEC;
      }
      // else: keep same-day; validator will show "前の停留所の出発時刻より早いです"
    }


    let depAbs = depBase == null ? null : depBase + localOffset;

    // same-stop rollover:
    // - If we are still same-day, allow dep to roll to next day (23:59 -> 00:10)
    // - If we are already 翌日, DO NOT add another DAY (that creates 48:xx and spreads errors)
    if (arrAbs !== null && depAbs !== null && depAbs < arrAbs) {
      // Only treat as midnight rollover if it's really 23:xx -> 00-03:xx
      const shouldRollover = isMidnightRolloverWithinStop(arrAbs, depBase);

      if (localOffset === 0 && shouldRollover) {
        depAbs += DAY_SEC;
        dayOffset = DAY_SEC; // now we are in 翌日 timeline
      }
      // else: keep same-day; validator will show "到着時刻が出発時刻を超えています"
    }



    abs.push({ arrAbs, depAbs });
    if (depAbs !== null) prevDepAbs = depAbs;

    return {
      ...row,
      is_arrival_time_next_day: arrAbs != null ? arrAbs >= DAY_SEC : false,
      is_departure_time_next_day: depAbs != null ? depAbs >= DAY_SEC : false,
    };
  });

  return { seqWithFlags: out, abs };
};


/**
 * Validate exactly what you requested:
 * 1) current arrival <= current departure
 * 2) current departure <= next arrival
 * 3) no inferred absolute time exceeds 27:00:00
 */
const validateAllStopTimes = (seq) => {
  const errors = {};
  const { abs } = inferAbsAndFlags(seq);

  for (let i = 0; i < seq.length; i++) {
    errors[i] = { arrival: null, departure: null };

    const { arrAbs, depAbs } = abs[i] || { arrAbs: null, depAbs: null };

    // rule 3: cap 27:00:00
    if (arrAbs !== null && arrAbs > MAX_SEC) {
      errors[i].arrival = MESSAGES.trip.timeLimitError;
    }
    if (depAbs !== null && depAbs > MAX_SEC) {
      errors[i].departure = MESSAGES.trip.timeLimitError;
    }

    // rule 1: arrival <= departure
    if (arrAbs !== null && depAbs !== null && arrAbs > depAbs) {
      // prefer this message over others for arrival field
      errors[i].arrival = MESSAGES.trip.arrivalAfterDepartureError;
    }

    // rule 2: departure <= next arrival
    if (i < seq.length - 1) {
      const nextArrAbs = abs[i + 1]?.arrAbs ?? null;
      if (depAbs !== null && nextArrAbs !== null && depAbs > nextArrAbs) {
        errors[i].departure = MESSAGES.trip.departureAfterNextArrivalError;
      }
    }

    // sequence sanity: arrival should not be before previous departure (helps UX; matches your #2 intent)
    if (i > 0) {
      const prevDepAbs = abs[i - 1]?.depAbs ?? null;
      if (arrAbs !== null && prevDepAbs !== null && arrAbs < prevDepAbs) {
        errors[i].arrival = MESSAGES.trip.arrivalAfterPrevDepartureError;
      }
    }
  }

  return errors;
};

const hasValidationErrors = (errors) =>
  Object.values(errors).some((e) => e?.arrival || e?.departure);

/* --- GREY highlight for first arrival input --- */
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
    boxShadow: "none",
    transition: "box-shadow 120ms ease",
  },
};

/* --- Error field styling --- */
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

const EditTripForm = ({
  stops_list,
  service_id_list,
  onCancel,
  onEdit,
  scenarioId,
  onSuccess,
  tripData,
  loadingTripActions,
  shapeData,
  previewShapeData,
}) => {
  const [tripInfo, setTripInfo] = useState({
    trip_id: "",
    old_trip_id: "",
    trip_interval: "",
    direction_id: "",
    service_id: "",
  });

  // Global snackbar
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const showError = (msg) => showSnackbar({ title: msg, severity: "error" });

  if (!tripData) {
    return <Typography>{MESSAGES.trip.loadingData}</Typography>;
  }

  const [stopSequence, setStopSequence] = useState([]);
  const [reverseSequence, setReverseSequence] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const didAutofillRef = useRef(false);

  // show ※翌日 hints after load / autofill / save click
  const [showDayHints, setShowDayHints] = useState(false);

  // Validation errors state - only shown after clicking save
  const [validationErrors, setValidationErrors] = useState({});

  const enrichedStopSequence = stopSequence.map((stop) => {
    const full = stops_list.find((s) => s.stop_id === stop.stop_id);
    return {
      ...stop,
      stop_latlng: full ? [full.stop_latlng[0], full.stop_latlng[1]] : null,
    };
  });

  /* -------- Template deltas (from the LOADED trip) for autofill -------- */
  const templateStopTimes = useMemo(
    () => (Array.isArray(tripData?.stop_times) ? tripData.stop_times : []),
    [tripData]
  );

  const templateDeltas = useMemo(() => {
    if (!templateStopTimes.length) return null;
    const baseArr = toSeconds(templateStopTimes[0]?.arrival_time);
    const baseDep = toSeconds(templateStopTimes[0]?.departure_time);
    if (baseArr == null || baseDep == null) return null;

    return templateStopTimes.map((row) => {
      const a = toSeconds(row?.arrival_time);
      const d = toSeconds(row?.departure_time);
      return {
        arr: a == null ? 0 : a - baseArr,
        dep: d == null ? 0 : d - baseDep,
      };
    });
  }, [templateStopTimes]);

  // Load tripData -> initialize stopSequence.
  // If BE flags exist, keep them; otherwise infer flags from sequence.
  useEffect(() => {
    if (tripData && tripData.trip && tripData.stop_times) {
      setTripInfo({
        trip_id: tripData.trip.trip_id,
        old_trip_id: tripData.trip.trip_id,
        trip_short_name: tripData.trip.trip_short_name || "",
        trip_headsign: tripData.trip.trip_headsign || "",
        trip_interval: "",
        direction_id: String(tripData.trip.direction_id),
        service_id: tripData.trip.service_id || "",
      });

      const formattedStops = tripData.stop_times.map((stop) => ({
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        arrival_time: stop.arrival_time,
        departure_time: stop.departure_time,
        stop_sequence: stop.stop_sequence,
        is_arrival_time_next_day: !!stop.is_arrival_time_next_day,
        is_departure_time_next_day: !!stop.is_departure_time_next_day,
      }));

      const hasAnyBEFlag = formattedStops.some(
        (s) => s.is_arrival_time_next_day || s.is_departure_time_next_day
      );

      const initSeq = hasAnyBEFlag ? formattedStops : inferAbsAndFlags(formattedStops).seqWithFlags;

      setStopSequence(initSeq);

      // show ※翌日 immediately if BE had flags OR inference finds next-day
      const hasNextDayAfterInit = initSeq.some(
        (s) => s.is_arrival_time_next_day || s.is_departure_time_next_day
      );
      if (hasNextDayAfterInit) setShowDayHints(true);
    }
  }, [tripData]);

  // Auto-fill only once (existing behavior) + then infer flags from the result
  useEffect(() => {
    if (didAutofillRef.current) return;
    if (!stopSequence?.length) return;

    const first = normalizeHHMMSS(stopSequence[0]?.arrival_time);
    if (!first) return;

    const hasBlanks = stopSequence.slice(1).some((s) => !s.arrival_time || !s.departure_time);
    if (!hasBlanks) return;

    autofillFromFirstArrival();
    didAutofillRef.current = true;
  }, [stopSequence?.[0]?.arrival_time, templateDeltas]);

  // Clear validation errors when stop sequence changes (keep your current UX)
  useEffect(() => {
    if (Object.keys(validationErrors).length > 0) {
      setValidationErrors({});
    }
  }, [stopSequence]);

  const isFormValid =
    tripInfo.trip_id.trim() &&
    tripInfo.direction_id !== "" &&
    tripInfo.service_id.trim() &&
    stopSequence.length > 0 &&
    stopSequence.every(
      (stop) => (stop.arrival_time || "").trim() && (stop.departure_time || "").trim()
    );

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

    // After reorder, re-infer flags from the whole sequence
    const { seqWithFlags } = inferAbsAndFlags(updatedWithTimes);
    setStopSequence(seqWithFlags);
    setShowDayHints(seqWithFlags.some(s => s.is_arrival_time_next_day || s.is_departure_time_next_day));
  };

  const toggleReverse = () => {
    const times = stopSequence.map((stop) => ({
      arrival_time: stop.arrival_time,
      departure_time: stop.departure_time,
    }));
    const reversedStops = [...stopSequence].reverse();
    const updated = reversedStops.map((stop, index) => ({
      ...stop,
      arrival_time: times[index].arrival_time,
      departure_time: times[index].departure_time,
    }));

    const { seqWithFlags } = inferAbsAndFlags(updated);
    setStopSequence(seqWithFlags);
    setReverseSequence((prev) => !prev);
    setShowDayHints(seqWithFlags.some(s => s.is_arrival_time_next_day || s.is_departure_time_next_day));
  };

  const autofillFromFirstArrival = () => {
    if (!Array.isArray(stopSequence) || stopSequence.length === 0) return;
    const firstArrStr = normalizeHHMMSS(stopSequence[0]?.arrival_time);
    const base = toSeconds(firstArrStr);
    let prevDepAbs = base;
    if (base == null) return;

    const next = stopSequence.map((s, idx) => {
      if (idx === 0) {
        // first row: same arrival/departure, never 翌日
        return {
          ...s,
          arrival_time: firstArrStr,
          departure_time: firstArrStr,
          is_arrival_time_next_day: false,
          is_departure_time_next_day: false,
        };
      }

      const td = templateDeltas?.[idx];
      const arrDelta = Number.isFinite(td?.arr) ? td.arr : 60 * idx;
      const depDelta = Number.isFinite(td?.dep) ? td.dep : 60 * idx;

      // 1) Build "candidate" absolute times (not yet rolled)
      let arrAbs = base + arrDelta;
      let depAbs = base + depDelta;

      // 2) Roll over to next day based on previous stop (timeline rule)
      //    We track previous departure on the absolute timeline.
      //    (store it in a closure variable outside map; see below)
      //    If arrival goes backwards, push it to next day.
      if (prevDepAbs != null && arrAbs < prevDepAbs) arrAbs += DAY_SEC;

      // 3) Same-stop rule: arrival <= departure, allow departure to roll once
      if (depAbs < arrAbs) depAbs += DAY_SEC;

      // 4) Clamp ONLY for autofill (cap at 27:00:00)
      arrAbs = Math.min(arrAbs, MAX_SEC);
      depAbs = Math.min(depAbs, MAX_SEC);

      // 5) Update prevDepAbs for the next row
      prevDepAbs = depAbs;

      // 6) Convert to UI time (00–23) + 翌日 flags
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


    const { seqWithFlags } = inferAbsAndFlags(next);
    setShowDayHints(seqWithFlags.some(s => s.is_arrival_time_next_day || s.is_departure_time_next_day));
    setStopSequence(seqWithFlags);
    setValidationErrors({});
  };

  // Save click: validate with the SAME inference rules used for flags
  const handleSaveClick = async () => {
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
  };

  const getFieldSx = (index, fieldType) => {
    const hasError = validationErrors[index]?.[fieldType];
    if (hasError) return errorFieldSx;
    if (index === 0 && fieldType === "arrival") return firstArrivalSx;
    return undefined;
  };

  // For confirmation popup display (show 24+)
  const confirmStopSequence = useMemo(() => {
    const { abs } = inferAbsAndFlags(enrichedStopSequence);

    return enrichedStopSequence.map((stop, index) => {
      const arrAbs = abs[index]?.arrAbs ?? null;
      const depAbs = abs[index]?.depAbs ?? null;

      return {
        ...stop,
        arrival_time: arrAbs == null ? "" : toExtendedHHMMSS(arrAbs),
        departure_time: depAbs == null ? "" : toExtendedHHMMSS(depAbs),
      };
    });
  }, [enrichedStopSequence]);

  return (
    <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
      {/* Header Buttons */}
      <Box display="flex" gap={2} justifyContent="flex-start" mb={2}>
        <Button variant="outlined" size="small" onClick={handleSaveClick} disabled={!isFormValid}>
          {BUTTONS.common.save}
        </Button>
        <Button variant="outlined" size="small" onClick={onCancel}>
          {BUTTONS.common.back}
        </Button>
      </Box>

      <Box display="flex" gap={3} width="100%">
        {/* Trip Info Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {LABELS.trip.tripInfo}
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label={`${LABELS.trip.tripId} ${LABELS.gtfs.tripId} *`}
              value={tripInfo.trip_id}
              onChange={(e) => setTripInfo({ ...tripInfo, trip_id: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={`${LABELS.trip.tripShortName} ${LABELS.gtfs.tripShortName}`}
              value={tripInfo.trip_short_name}
              onChange={(e) => setTripInfo({ ...tripInfo, trip_short_name: e.target.value })}
              disabled
            />
            <TextField
              label={`${LABELS.trip.tripHeadsign} ${LABELS.gtfs.tripHeadsign}`}
              value={tripInfo.trip_headsign}
              onChange={(e) => setTripInfo({ ...tripInfo, trip_headsign: e.target.value })}
              disabled
            />
            <Box display="flex" gap={1}></Box>
            <Box display="flex" gap={1}>
              <TextField
                select
                label={`${LABELS.common.direction} ${LABELS.gtfs.directionId} *`}
                value={tripInfo.direction_id}
                onChange={(e) => setTripInfo({ ...tripInfo, direction_id: e.target.value })}
                fullWidth
                disabled
              >
                <MenuItem value="0">{LABELS.trip.directionLabel("0", LABELS.trip.inbound)}</MenuItem>
                <MenuItem value="1">{LABELS.trip.directionLabel("1", LABELS.trip.outbound)}</MenuItem>
              </TextField>
              <TextField
                select
                label={`${LABELS.common.serviceId} ${LABELS.gtfs.serviceId} *`}
                value={tripInfo.service_id}
                onChange={(e) => setTripInfo({ ...tripInfo, service_id: e.target.value })}
                fullWidth
                disabled
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

        {/* Stop Sequence Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {LABELS.trip.stopSettings}
          </Typography>

          <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
            <Box display="flex" alignItems="center" gap={1} sx={{ ml: 1 }}>
              <Button variant="outlined" size="small" onClick={() => autofillFromFirstArrival()}>
                {LABELS.trip.autofillTimes}
              </Button>
              <LargeTooltip title={LABELS.trip.autofillHint}>
                <IconButton size="small" sx={{ ml: 0.5 }}>
                  <InfoOutlinedIcon fontSize="inherit" />
                </IconButton>
              </LargeTooltip>
            </Box>
          </Box>

          <DragDropContext onDragEnd={DRAG_DISABLED ? () => { } : handleDragEnd}>
            <Droppable droppableId="stopsTable" isDropDisabled={DRAG_DISABLED}>
              {(provided) => (
                <Table size="small" sx={{ mt: 2 }} ref={provided.innerRef} {...provided.droppableProps}>
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
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {stopSequence.map((stop, index) => (
                      <Draggable
                        key={`${stop.stop_id}-${index}`}
                        draggableId={`${stop.stop_id}-${index}`}
                        index={index}
                        isDragDisabled={DRAG_DISABLED}
                      >
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...(DRAG_DISABLED ? {} : { ...provided.draggableProps, ...provided.dragHandleProps })}
                            sx={{ cursor: DRAG_DISABLED ? "default" : "grab" }}
                          >
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{stop.stop_id}</TableCell>
                            <TableCell>{stop.stop_name}</TableCell>

                            {/* Arrival */}
                            <TableCell>
                              <TextField
                                type="time"
                                value={stop.arrival_time || ""}
                                onChange={(e) => {
                                  const newArrival = normalizeHHMMSS(e.target.value);
                                  const next = [...stopSequence];

                                  if (index === 0) {
                                    next[0] = {
                                      ...next[0],
                                      arrival_time: newArrival,
                                      departure_time: newArrival,
                                    };
                                  } else {
                                    next[index] = { ...next[index], arrival_time: newArrival };
                                  }

                                  const { seqWithFlags } = inferAbsAndFlags(next);
                                  setStopSequence(seqWithFlags);
                                  setShowDayHints(seqWithFlags.some(s => s.is_arrival_time_next_day || s.is_departure_time_next_day));
                                }}
                                inputProps={{
                                  step: 1,
                                  lang: "ja-JP",
                                  inputMode: "numeric",
                                  pattern: "[0-9:]*",
                                }}
                                size="small"
                                fullWidth
                                sx={getFieldSx(index, "arrival")}
                                error={!!validationErrors[index]?.arrival}
                                helperText={
                                  validationErrors[index]?.arrival ||
                                  (showDayHints && stop?.is_arrival_time_next_day ? LABELS.trip.nextDay : "")
                                }
                                FormHelperTextProps={{
                                  sx: { mx: 0, mt: 0.5, fontSize: "11px" },
                                }}
                              />
                            </TableCell>

                            {/* Departure */}
                            <TableCell>
                              <TextField
                                type="time"
                                value={stop.departure_time || ""}
                                onChange={(e) => {
                                  const newDeparture = normalizeHHMMSS(e.target.value);
                                  const next = [...stopSequence];

                                  if (index === 0) {
                                    next[0] = {
                                      ...next[0],
                                      arrival_time: newDeparture,
                                      departure_time: newDeparture,
                                    };
                                  } else {
                                    next[index] = { ...next[index], departure_time: newDeparture };
                                  }

                                  const { seqWithFlags } = inferAbsAndFlags(next);
                                  setStopSequence(seqWithFlags);
                                  setShowDayHints(seqWithFlags.some(s => s.is_arrival_time_next_day || s.is_departure_time_next_day));
                                }}
                                inputProps={{
                                  step: 1,
                                  lang: "ja-JP",
                                  inputMode: "numeric",
                                  pattern: "[0-9:]*",
                                }}
                                size="small"
                                fullWidth
                                sx={getFieldSx(index, "departure")}
                                error={!!validationErrors[index]?.departure}
                                helperText={
                                  validationErrors[index]?.departure ||
                                  (showDayHints && stop?.is_departure_time_next_day ? LABELS.trip.nextDay : "")
                                }
                                FormHelperTextProps={{
                                  sx: { mx: 0, mt: 0.5, fontSize: "11px" },
                                }}
                              />
                            </TableCell>
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

      {/* Confirmation Dialog */}
      <CreateTripConfirmDialog
        open={showConfirm}
        onClose={() => {
          if (!loadingTripActions) setShowConfirm(false);
        }}
        onConfirm={async () => {
          // build stop_times with extended hour strings so BE sets next-day flags correctly
          const { abs } = inferAbsAndFlags(enrichedStopSequence);

          const stop_times = enrichedStopSequence.map((stop, index) => {
            const arrAbs = abs[index]?.arrAbs ?? null;
            const depAbs = abs[index]?.depAbs ?? null;
            return {
              stop_sequence: index + 1,
              stop_id: stop.stop_id,
              arrival_time: arrAbs == null ? "" : toExtendedHHMMSS(arrAbs),
              departure_time: depAbs == null ? "" : toExtendedHHMMSS(depAbs),
            };
          });

          const payload = {
            old_trip_id: tripInfo.old_trip_id,
            service_id: tripInfo.service_id,
            direction_id: parseInt(tripInfo.direction_id, 10),
            stop_times,
          };

          try {
            await onEdit(tripInfo.trip_id, payload);
            setShowConfirm(false);
            onSuccess?.();
          } catch (error) {
            console.error("Save failed:", error);
          }
        }}
        tripInfo={tripInfo}
        stopSequence={confirmStopSequence}
        reverseSequence={reverseSequence}
        scenarioId={scenarioId}
        shapeData={shapeData}
        loadingTripActions={loadingTripActions}
      />
    </Box>
  );
};

export default EditTripForm;
