// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { MapTileLayer } from "../../MapTileLayer";
import { useState, useEffect } from "react";
import TranslationFields from "../RouteEdit/TranslationFields";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";


function SelectableMarker({ value, onChange }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onChange({ lat: Number(lat).toFixed(6), lon: Number(lng).toFixed(6) });
    },
  });
  return value.lat && value.lon ? <Marker position={[value.lat, value.lon]} icon={blueStopDivIcon} /> : null;
}

const StopSchema = Yup.object().shape({
  stop_name: Yup.string().required(MESSAGES.validation.required),
  stop_id: Yup.string().required(MESSAGES.validation.required),
  stop_lat: Yup.number()
    .typeError(MESSAGES.validation.numberOnly)
    .required(MESSAGES.validation.required)
    .min(17, MESSAGES.validation.latRange)
    .max(48, MESSAGES.validation.latRange),
  stop_lon: Yup.number()
    .typeError(MESSAGES.validation.numberOnly)
    .required(MESSAGES.validation.required)
    .min(120, MESSAGES.validation.lonRange)
    .max(156, MESSAGES.validation.lonRange),
});

const blueStopDivIcon = L.divIcon({
  className: "",
  html: `
    <span class="material-symbols-outlined"
      style="
        color:#1976D2;
        font-size:35px;
        line-height:1;
        display:inline-block;
        font-variation-settings: 'FILL' 1;
      ">
      location_on
    </span>
  `,
  iconAnchor: [14, 28],
});


export default function StopFormModal({
  open,
  mode = "create", // 'create' | 'edit'
  initialValues = {
    parent_stop_id_label: "",
    parent_stop_name_label: "",
    stop_name: "",
    stop_id: "",
    stop_lat: "",
    stop_lon: "",
    stop_code: "",
  },
  onClose,
  onSubmit,
  disableFields = [],
  scenarioId,
  stopNameGroupId,
  stopIdGroupId,
}) {
  const [existingTranslations, setExistingTranslations] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft] = useState({ language: "", translation: "" });
  const [pendingEdits, setPendingEdits] = useState([]);
  const [newTranslations, setNewTranslations] = useState([]);

  useEffect(() => {
    setExistingTranslations(Array.isArray(initialValues?.translations) ? initialValues.translations : []);
    setEditingIdx(null);
    setDraft({ language: "", translation: "" });
    setPendingEdits([]);
    setNewTranslations([]);
  }, [open, initialValues]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{mode === "edit" ? MESSAGES.stop.editDialogTitle : MESSAGES.stop.createDialogTitle}</DialogTitle>

      <Formik
        initialValues={initialValues}
        validationSchema={StopSchema}
        enableReinitialize
        onSubmit={async (values, { setSubmitting }) => {
          // Build payload for parent handler
          const payload = {
            ...values,
            stop_lat: Number(values.stop_lat),
            stop_lon: Number(values.stop_lon),
            scenario_id: scenarioId,
            stop_name_group_id: stopNameGroupId,
            stop_id_group_id: stopIdGroupId,
            translations: [
              ...(mode === "edit" ? pendingEdits : []),
              ...newTranslations.map((t) => ({
                table_name: "stops",
                field_name: t.field_name || "stop_name",
                field_value: t.field_value ?? values.stop_name,
                language: t.language,
                translation: t.translation,
              })),
            ],
          };

          try {
            // Await parent submit to ensure we correctly toggle submitting state
            await onSubmit(payload);
          } finally {
            // Always re-enable the button even if submit throws or validation fails upstream
            setSubmitting(false);
          }
        }}
      >
        {({ values, setFieldValue, errors, touched, isSubmitting }) => (
          <Form>
            <DialogContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                {/* Map */}
                <Stack flex={1}>
                  <div style={{ height: 300, width: "100%" }}>
                    <MapContainer
                      center={[Number(values.stop_lat || 35.6812), Number(values.stop_lon || 139.7671)]}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <MapTileLayer />
                      <SelectableMarker
                        value={{
                          lat: Number(values.stop_lat).toFixed(6),
                          lon: Number(values.stop_lon).toFixed(6),
                        }}
                        onChange={({ lat, lon }) => {
                          setFieldValue("stop_lat", Number(lat).toFixed(6));
                          setFieldValue("stop_lon", Number(lon).toFixed(6));
                        }}
                      />
                    </MapContainer>
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{LABELS.stop.clickMapHint}</div>
                </Stack>

                {/* Right side form */}
                <Stack flex={1} spacing={2} sx={{ minWidth: 260 }}>
                  {/* Readonly parent stop info */}
                  <Box>
                    <Stack direction="row" spacing={2} sx={{ mb: 0.5 }}>
                      <Field
                        as={TextField}
                        label={LABELS.common.stopId}
                        name="parent_stop_id_label"
                        size="small"
                        fullWidth
                        disabled
                        value={values.parent_stop_id_label || ""}
                      />
                      <Field
                        as={TextField}
                        label={LABELS.common.stopName}
                        name="parent_stop_name_label"
                        size="small"
                        fullWidth
                        disabled
                        value={values.parent_stop_name_label || ""}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      {LABELS.stop.parentStopAutoHint}
                    </Typography>
                  </Box>

                  {/* Stop ID */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.poleId} ${LABELS.gtfs.stopId}`}
                    name="stop_id"
                    size="small"
                    fullWidth
                    disabled={mode === "edit" || disableFields.includes("stop_id")}
                    error={touched.stop_id && !!errors.stop_id}
                    helperText={touched.stop_id && errors.stop_id}
                  />

                  {/* Stop Name */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.poleName} ${LABELS.gtfs.stopName}`}
                    name="stop_name"
                    size="small"
                    fullWidth
                    disabled={disableFields.includes("stop_name")}
                    error={touched.stop_name && !!errors.stop_name}
                    helperText={touched.stop_name && errors.stop_name}
                  />

                  {/* Latitude */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.latitude} ${LABELS.gtfs.stopLat}`}
                    name="stop_lat"
                    size="small"
                    type="number"
                    inputProps={{ step: 0.000001, min: 17, max: 48 }}
                    fullWidth
                    disabled={disableFields.includes("stop_lat")}
                    error={touched.stop_lat && !!errors.stop_lat}
                    helperText={touched.stop_lat && errors.stop_lat}
                  />

                  {/* Longitude */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.longitude} ${LABELS.gtfs.stopLon}`}
                    name="stop_lon"
                    size="small"
                    type="number"
                    inputProps={{ step: 0.000001, min: 120, max: 156 }}
                    fullWidth
                    disabled={disableFields.includes("stop_lon")}
                    error={touched.stop_lon && !!errors.stop_lon}
                    helperText={touched.stop_lon && errors.stop_lon}
                  />

                  {/* Stop Code */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.stopCode} ${LABELS.gtfs.stopCode}`}
                    name="stop_code"
                    size="small"
                    type="text"
                    fullWidth
                    disabled={disableFields.includes("stop_code")}
                    error={touched.stop_code && !!errors.stop_code}
                    helperText={touched.stop_code && errors.stop_code}
                  />

                  {/* Existing translations (edit mode) */}
                  {mode === "edit" && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                        {LABELS.translation.listTitle(existingTranslations.length)}
                      </Typography>

                      {existingTranslations.length > 0 ? (
                        <Table size="small" sx={{ mt: 0.5, border: 1, borderColor: "divider", minWidth: 700 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, width: 140 }}>{LABELS.translation.fieldName}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{LABELS.translation.originalValue}</TableCell>
                              <TableCell sx={{ fontWeight: 700, width: 110 }}>{LABELS.translation.language}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{LABELS.translation.translation}</TableCell>
                              <TableCell sx={{ width: 120 }} />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {existingTranslations.map((t, idx) => {
                              const isEditing = editingIdx === idx;
                              return (
                                <TableRow key={`${t.field_name}-${t.field_value}-${idx}`}>
                                  <TableCell>{t.field_name}</TableCell>
                                  <TableCell sx={{ whiteSpace: "pre-wrap" }}>{t.field_value}</TableCell>
                                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                                    {isEditing ? (
                                      <TextField
                                        select
                                        size="small"
                                        value={draft.language}
                                        onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}
                                        sx={{ minWidth: 100 }}
                                      >
                                        {["en", "ja", "ja-Hrkt"].map((code) => (
                                          <MenuItem key={code} value={code}>
                                            {code}
                                          </MenuItem>
                                        ))}
                                      </TextField>
                                    ) : (
                                      t.language
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        value={draft.translation}
                                        onChange={(e) => setDraft((d) => ({ ...d, translation: e.target.value }))}
                                      />
                                    ) : (
                                      <span style={{ whiteSpace: "pre-wrap" }}>{t.translation}</span>
                                    )}
                                  </TableCell>
                                  <TableCell align="right">
                                    {isEditing ? (
                                      <>
                                        <Button
                                          size="small"
                                          sx={{ mr: 1 }}
                                          onClick={() => {
                                            const next = [...existingTranslations];
                                            next[idx] = { ...t, language: draft.language, translation: draft.translation };
                                            setExistingTranslations(next);
                                            setPendingEdits((list) => [
                                              ...list.filter((_, i) => !(i === idx)),
                                              {
                                                table_name: "stops",
                                                field_name: t.field_name,
                                                field_value: t.field_value,
                                                language: draft.language,
                                                translation: draft.translation,
                                                id: t.id,
                                              },
                                            ]);
                                            setEditingIdx(null);
                                          }}
                                        >
                                          {BUTTONS.common.save}
                                        </Button>
                                        <Button
                                          size="small"
                                          color="inherit"
                                          onClick={() => {
                                            setEditingIdx(null);
                                            setDraft({ language: "", translation: "" });
                                          }}
                                        >
                                          {BUTTONS.common.cancel}
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="small"
                                        onClick={() => {
                                          setEditingIdx(idx);
                                          setDraft({ language: t.language || "ja", translation: t.translation || "" });
                                        }}
                                      >
                                        {BUTTONS.common.edit}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <Typography variant="body2" color="text.secondary">{MESSAGES.translation.noTranslations}</Typography>
                      )}
                      <Box sx={{ borderBottom: "1px dashed #ddd", my: 1 }} />
                    </Box>
                  )}

                  {/* New translations editor */}
                  <Box sx={{ mt: 2 }}>
                    <TranslationFields
                      translations={newTranslations}
                      setTranslations={setNewTranslations}
                      fields={[{ value: "stop_name", label: LABELS.translation.itemStop }]}
                      languages={["en", "ja", "ja-Hrkt"]}
                      originalValues={{ stop_name: values.stop_name || "" }}
                    />
                  </Box>
                </Stack>
              </Stack>
            </DialogContent>

            <DialogActions>
              <Button onClick={onClose} color="primary" variant="text">
                {BUTTONS.common.cancel}
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSubmitting} // Only disabled while an actual submit is in-flight
              >
                {mode === "edit" ? BUTTONS.common.save : BUTTONS.common.create}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}
