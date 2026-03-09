// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// components/gtfs/scenario/ScenarioFeedInfoForm.jsx
import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Grid,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TableContainer,
    Paper,
    Typography,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import ja from "date-fns/locale/ja";
import { useFormik } from "formik";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

/* Helpers */
function formatDateISO(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function formatJP(value) {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    const yyyy = d.getFullYear();
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    return `${yyyy}/${mm}/${dd}`;
}

const defaultInitialValues = {
    // For the form we keep start/end at the root level
    start_date: null,
    end_date: null,
    feed_info: {
        publisher_name: "",
        publisher_url: "",
        version: "",
        language: "",
    },
};

const MAX_TEXT = 80;
const safeStr = (v) =>
    v === null || v === undefined || v === "" ? "—" : String(v);
const trunc = (v, n = MAX_TEXT) => {
    const s = safeStr(v);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
};

// Normalize both initialValues (which come in as feed_info.*) and formik values
function normalize(values) {
    const fi = values?.feed_info || {};
    const rawStart =
        values && Object.prototype.hasOwnProperty.call(values, "start_date")
            ? values.start_date
            : fi.start_date;
    const rawEnd =
        values && Object.prototype.hasOwnProperty.call(values, "end_date")
            ? values.end_date
            : fi.end_date;

    return {
        start_date: formatDateISO(rawStart) || null,
        end_date: formatDateISO(rawEnd) || null,
        feed_info: {
            publisher_name: (fi.publisher_name || "").trim(),
            publisher_url: (fi.publisher_url || "").trim(),
            version: (fi.version || "").trim(),
            language: (fi.language || "").trim(),
        },
    };
}

export default function ScenarioFeedInfoForm({
    initialValues = defaultInitialValues,
    onChange,
    onSubmit,
    submitting = false,
    submitLabel = BUTTONS.common.save,
    fullWidth = true,
}) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    // scenario_name is not edited in this form
    const { scenario_name: _omit, ...restInit } = initialValues || {};

    // Map backend shape -> form shape
    const formik = useFormik({
        initialValues: {
            ...defaultInitialValues,
            ...restInit,
            start_date:
                restInit?.start_date ??
                restInit?.feed_info?.start_date ??
                defaultInitialValues.start_date,
            end_date:
                restInit?.end_date ??
                restInit?.feed_info?.end_date ??
                defaultInitialValues.end_date,
            feed_info: {
                publisher_name: restInit?.feed_info?.publisher_name || "",
                publisher_url: restInit?.feed_info?.publisher_url || "",
                version: restInit?.feed_info?.version || "",
                language:
                    restInit?.feed_info?.language ??
                    defaultInitialValues.feed_info.language,
            },
        },
        enableReinitialize: true,
        validate: (values) => {
            const errs = {};
            const s = values.start_date ? new Date(values.start_date) : null;
            const e = values.end_date ? new Date(values.end_date) : null;
            if (s && e && e <= s) {
                errs.end_date = MESSAGES.validation.endDateAfterStartDate;
            }
            return errs;
        },
        onSubmit: async () => { },
    });

    useEffect(() => {
        onChange?.(formik.values);
    }, [formik.values, onChange]);

    const fieldDefs = [
        {
            key: "feed_info.publisher_name",
            label: LABELS.feedInfo.publisherName,
            type: "text",
            gtfsField: "feed_publisher_name",
        },
        {
            key: "feed_info.publisher_url",
            label: LABELS.feedInfo.publisherUrl,
            type: "text",
            gtfsField: "feed_publisher_url",
        },
        {
            key: "feed_info.language",
            label: LABELS.feedInfo.language,
            type: "text",
            gtfsField: "feed_lang",
            readOnly: true,
        },
        {
            key: "start_date",
            label: LABELS.feedInfo.periodStart,
            type: "date",
            gtfsField: "feed_start_date",
        },
        {
            key: "end_date",
            label: LABELS.feedInfo.periodEnd,
            type: "date",
            gtfsField: "feed_end_date",
        },
        {
            key: "feed_info.version",
            label: LABELS.feedInfo.version,
            type: "text",
            gtfsField: "feed_version",
            readOnly: true,
        },
    ];


    const getValue = (path) => {
        const parts = path.split(".");
        let cur = formik.values;
        for (const p of parts) cur = cur?.[p];
        return cur;
    };

    const setValue = (path, val) => {
        const parts = path.split(".");
        if (parts.length === 1) {
            formik.setFieldValue(parts[0], val);
            return;
        }
        const [a, b] = parts;
        formik.setFieldValue(a, { ...(formik.values?.[a] || {}), [b]: val });
    };

    const normInitial = useMemo(() => normalize(restInit), [restInit]);
    const normCurrent = useMemo(
        () => normalize(formik.values),
        [formik.values]
    );

    const changes = useMemo(() => {
        const list = [];

        if (normInitial.start_date !== normCurrent.start_date) {
            list.push({
                label: LABELS.common.startDate,
                beforeRaw: normInitial.start_date
                    ? formatJP(normInitial.start_date)
                    : "—",
                afterRaw: normCurrent.start_date
                    ? formatJP(normCurrent.start_date)
                    : "—",
            });
        }

        if (normInitial.end_date !== normCurrent.end_date) {
            list.push({
                label: LABELS.common.endDate,
                beforeRaw: normInitial.end_date
                    ? formatJP(normInitial.end_date)
                    : "—",
                afterRaw: normCurrent.end_date
                    ? formatJP(normCurrent.end_date)
                    : "—",
            });
        }

        if (
            normInitial.feed_info.publisher_name !==
            normCurrent.feed_info.publisher_name
        ) {
            list.push({
                label: LABELS.feedInfo.publisherNameShort,
                beforeRaw: normInitial.feed_info.publisher_name || "—",
                afterRaw: normCurrent.feed_info.publisher_name || "—",
            });
        }

        if (
            normInitial.feed_info.publisher_url !==
            normCurrent.feed_info.publisher_url
        ) {
            list.push({
                label: LABELS.feedInfo.publisherUrlShort,
                beforeRaw: normInitial.feed_info.publisher_url || "—",
                afterRaw: normCurrent.feed_info.publisher_url || "—",
            });
        }

        if (normInitial.feed_info.version !== normCurrent.feed_info.version) {
            list.push({
                label: LABELS.feedInfo.versionShort,
                beforeRaw: normInitial.feed_info.version || "—",
                afterRaw: normCurrent.feed_info.version || "—",
            });
        }

        return list.map((c) => ({
            ...c,
            before: trunc(c.beforeRaw),
            after: trunc(c.afterRaw),
        }));
    }, [normInitial, normCurrent]);

    const hasErrors = Object.keys(formik.errors || {}).length > 0;
    const hasChanges = changes.length > 0;

    const buildPayload = () => ({
        feed_info: {
            publisher_name: normCurrent.feed_info.publisher_name,
            publisher_url: normCurrent.feed_info.publisher_url,
            version: normCurrent.feed_info.version,
            language: normCurrent.feed_info.language,
            start_date: normCurrent.start_date,
            end_date: normCurrent.end_date,
        },
    });

    const openConfirm = () => setConfirmOpen(true);
    const closeConfirm = () => setConfirmOpen(false);

    const handleConfirmUpdate = async () => {
        const payload = buildPayload();
        await onSubmit?.(payload);
        setConfirmOpen(false);
    };

    const tryOpenConfirm = () => {
        formik.validateForm().then((errs) => {
            if (Object.keys(errs).length === 0) openConfirm();
        });
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
            <Box sx={{ width: fullWidth ? "100%" : 720, display: "grid", gap: 2 }}>
                {/* Save + Reset */}
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={tryOpenConfirm}
                        disabled={hasErrors || !hasChanges || submitting}
                    >
                        {submitting ? BUTTONS.common.sending : submitLabel}
                    </Button>
                    {hasChanges && (
                        <Button
                            size="small"
                            onClick={() => formik.resetForm()}
                            disabled={submitting}
                        >
                            {BUTTONS.common.reset}
                        </Button>
                    )}
                </Box>

                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
                >
                    <Table size="small" aria-label="feed-info-edit-table">
                        <TableBody>
                            {fieldDefs.map((f) => {
                                const val = getValue(f.key);
                                const err =
                                    f.key === "end_date" ? formik.errors.end_date : undefined;

                                const underLabel = f.gtfsField || null;
                                const description = f.description || null;

                                return (
                                    <TableRow key={f.key} hover>
                                        {/* Left cell: labels */}
                                        <TableCell sx={{ width: 240 }}>
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {f.label}
                                                </Typography>

                                                {underLabel && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: "text.secondary",
                                                            display: "block",
                                                            mt: 0.5,
                                                        }}
                                                    >
                                                        {underLabel}
                                                    </Typography>
                                                )}

                                                {description && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: "text.secondary",
                                                            display: "block",
                                                        }}
                                                    >
                                                        {description}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>

                                        {/* Right cell: field */}
                                        <TableCell sx={{ wordBreak: "break-word" }}>
                                            {f.type === "text" ? (
                                                <TextField
                                                    variant="standard"
                                                    fullWidth
                                                    value={val || ""}
                                                    onChange={
                                                        f.readOnly
                                                            ? undefined
                                                            : (e) => setValue(f.key, e.target.value)
                                                    }
                                                    disabled={!!f.readOnly}
                                                    InputProps={{
                                                        readOnly: !!f.readOnly,
                                                    }}
                                                    error={!!err}
                                                    helperText={err || ""}
                                                    placeholder={
                                                        f.key.endsWith("version")
                                                            ? `${LABELS.common.placeholder}20170401_A0015`
                                                            : ""
                                                    }
                                                />
                                            ) : (
                                                <Grid container>
                                                    <Grid item xs={12} md={6} lg={4}>
                                                        <DatePicker
                                                            value={val}
                                                            onChange={(newValue) => {
                                                                setValue(f.key, newValue);
                                                                if (f.key === "start_date") {
                                                                    const e =
                                                                        formik.values.end_date
                                                                            ? new Date(
                                                                                formik.values.end_date
                                                                            )
                                                                            : null;
                                                                    if (
                                                                        newValue &&
                                                                        e &&
                                                                        new Date(e) <=
                                                                        new Date(newValue)
                                                                    ) {
                                                                        formik.setFieldValue(
                                                                            "end_date",
                                                                            null
                                                                        );
                                                                    }
                                                                }
                                                            }}
                                                            minDate={
                                                                f.key === "end_date" &&
                                                                    formik.values.start_date
                                                                    ? new Date(
                                                                        new Date(
                                                                            formik.values.start_date
                                                                        ).getTime() +
                                                                        24 * 60 * 60 * 1000
                                                                    )
                                                                    : undefined
                                                            }
                                                            format="yyyy/MM/dd"
                                                            slotProps={{
                                                                textField: {
                                                                    variant: "standard",
                                                                    fullWidth: true,
                                                                    error: !!err,
                                                                    helperText: err || "",
                                                                },
                                                            }}
                                                        />
                                                    </Grid>
                                                </Grid>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>

                    </Table>
                </TableContainer>
            </Box>

            {/* Confirm dialog */}
            <Dialog
                open={confirmOpen}
                onClose={closeConfirm}
                fullWidth
                maxWidth="md"
                scroll="paper"
                aria-labelledby="feed-info-confirm-title"
                PaperProps={{ sx: { maxHeight: "80vh" } }}
            >
                <DialogTitle id="feed-info-confirm-title">{MESSAGES.common.confirmChanges}</DialogTitle>
                <DialogContent dividers sx={{ maxHeight: "70vh", p: 0 }}>
                    {!hasChanges ? (
                        <Box sx={{ p: 2 }}>
                            <Alert severity="info">{MESSAGES.common.noChanges}</Alert>
                        </Box>
                    ) : (
                        <TableContainer sx={{ maxHeight: "70vh" }}>
                            <Table size="small" stickyHeader aria-label="diff-table">
                                <TableBody>
                                    {changes.map((c, i) => (
                                        <TableRow
                                            key={`${c.label}-${i}`}
                                            sx={{
                                                "& td": {
                                                    verticalAlign: "top",
                                                },
                                            }}
                                        >
                                            <TableCell
                                                sx={{
                                                    width: 180,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {c.label}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    color: "text.secondary",
                                                    wordBreak: "break-word",
                                                }}
                                            >
                                                <Tooltip
                                                    title={safeStr(c.beforeRaw)}
                                                    arrow
                                                    placement="top-start"
                                                >
                                                    <span>{c.before}</span>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="center" sx={{ width: 32 }}>
                                                →
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    wordBreak: "break-word",
                                                }}
                                            >
                                                <Tooltip
                                                    title={safeStr(c.afterRaw)}
                                                    arrow
                                                    placement="top-start"
                                                >
                                                    <span>{c.after}</span>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 2, py: 1.5 }}>
                    <Button onClick={closeConfirm} disabled={submitting}>
                        {BUTTONS.common.cancel}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmUpdate}
                        disabled={!hasChanges || submitting}
                    >
                        {submitting ? BUTTONS.common.sending : BUTTONS.common.save}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}
