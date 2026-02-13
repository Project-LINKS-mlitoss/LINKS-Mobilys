// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Box,
} from "@mui/material";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { MapTileLayer } from "../../MapTileLayer";
import TranslationFields from "../RouteEdit/TranslationFields";
import L from "leaflet";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

function TwoLineLabel({ primary, secondary }) {
  return (
    <Box sx={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.1 }}>
      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{primary}</Typography>
      <Typography variant="caption" color="text.secondary">{secondary}</Typography>
    </Box>
  );
}

// Selectable marker for map
function SelectableMarker({ value, onChange }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onChange({ lat, lon: lng });
    },
  });
  const lat = Number(value.lat);
  const lon = Number(value.lon);
  return Number.isFinite(lat) && Number.isFinite(lon)
    ? <Marker position={[lat, lon]} icon={blueStopDivIcon} />
    : null;

}

const blueStopDivIcon = L.divIcon({
  className: "",
  html: `
    <span class="material-symbols-outlined filled"
      style="
        color:#1976D2;      /* MUI blue */
        font-size:35px;
        line-height:1;
        display:inline-block;
      ">
      location_on
    </span>
  `,
  iconAnchor: [14, 28],
});


const StopSchema = Yup.object().shape({
  parent_stop_name_label: Yup.string().required(),
  parent_stop_id_label: Yup.string().required(),
  parent_stop_source_id: Yup.string().required(),
  stop_name: Yup.string().required(`${LABELS.stop.poleName}${MESSAGES.validation.required}`),
  stop_id: Yup.string().required(`${LABELS.stop.poleId}${MESSAGES.validation.required}`),
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




export default function StopFormChildModal({
  open,
  onClose,
  onSubmit,
  initialValues = {
    parent_stop_name_label: "",
    parent_stop_id_label: "",
    parent_stop_source_id: "",
    stop_name: "",
    stop_id: "",
    stop_lat: 0,
    stop_lon: 0,
    stop_code: "",
  },
}) {
  const [translations, setTranslations] = useState([]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{MESSAGES.stop.createDialogTitle}</DialogTitle>

      <Formik
        initialValues={initialValues}
        validationSchema={StopSchema}
        enableReinitialize
        onSubmit={async (values, { setSubmitting }) => {
          // Build payload for parent handler (uses child API)
          const payload = {
            parent_stop_id: values.parent_stop_source_id,
            stop_id: values.stop_id,
            stop_name: values.stop_name,
            stop_lat: Number(values.stop_lat),
            stop_lon: Number(values.stop_lon),
            stop_code: values.stop_code,
            translations,
          };
          try {
            await onSubmit(payload);
          } finally {
            // Always re-enable the button even if submit throws or validation fails upstream
            setSubmitting(false);
          }
        }}
      >
        {({
          values,
          setFieldValue,
          errors,
          touched,
          isSubmitting,
          submitCount,
        }) => (
          <Form>
            <DialogContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                {/* MAP */}
                <Stack flex={1}>
                  <div style={{ height: 300, width: "100%" }}>
                    <MapContainer
                      center={[
                        values.stop_lat || 35.6812,
                        values.stop_lon || 139.7671,
                      ]}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <MapTileLayer />
                      <SelectableMarker
                        value={{ lat: values.stop_lat, lon: values.stop_lon }}
                        onChange={({ lat, lon }) => {
                          setFieldValue("stop_lat", Number(Number(lat).toFixed(6)));
                          setFieldValue("stop_lon", Number(Number(lon).toFixed(6)));
                        }}
                      />
                    </MapContainer>
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    {LABELS.stop.clickMapHint}
                  </div>
                </Stack>

                {/* RIGHT SIDE FORM */}
                <Stack flex={1} spacing={2} sx={{ minWidth: 260 }}>
                  <Stack direction="row" spacing={2}>
                    <Field
                      as={TextField}
                      label={LABELS.common.stopId}
                      name="parent_stop_id_label"
                      size="small"
                      fullWidth
                      disabled
                    />
                    <Field
                      as={TextField}
                      label={LABELS.common.stopName}
                      name="parent_stop_name_label"
                      size="small"
                      fullWidth
                      disabled
                    />
                  </Stack>

                  {/* 標柱ID */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.poleId} ${LABELS.gtfs.stopId}`}
                    name="stop_id"
                    size="small"
                    fullWidth
                    error={touched.stop_id && !!errors.stop_id}
                    helperText={
                      touched.stop_id && errors.stop_id
                        ? errors.stop_id
                        : LABELS.stop.uniqueIdHint
                    }
                    FormHelperTextProps={{ sx: { ml: 0, pl: 0, mt: 0.5 } }}
                  />

                  {/* 標柱名称 */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.poleName} ${LABELS.gtfs.stopName}`}
                    name="stop_name"
                    size="small"
                    fullWidth
                    error={touched.stop_name && !!errors.stop_name}
                    helperText={touched.stop_name && errors.stop_name}
                  />

                  {/* 緯度 */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.latitude} ${LABELS.gtfs.stopLat}`}
                    name="stop_lat"
                    size="small"
                    type="number"
                    inputProps={{ step: 0.000001, min: 17, max: 48 }}
                    fullWidth
                    error={touched.stop_lat && !!errors.stop_lat}
                    helperText={touched.stop_lat && errors.stop_lat}
                  />

                  {/* 経度 */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.longitude} ${LABELS.gtfs.stopLon}`}
                    name="stop_lon"
                    size="small"
                    type="number"
                    inputProps={{ step: 0.000001, min: 120, max: 156 }}
                    fullWidth
                    error={touched.stop_lon && !!errors.stop_lon}
                    helperText={touched.stop_lon && errors.stop_lon}
                  />

                  {/* 標柱番号 */}
                  <Field
                    as={TextField}
                    label={`${LABELS.stop.stopCode} ${LABELS.gtfs.stopCode}`}
                    name="stop_code"
                    size="small"
                    type="text"
                    fullWidth
                    error={touched.stop_code && !!errors.stop_code}
                    helperText={touched.stop_code && errors.stop_code}
                  />

                  {/* hidden carrier for backend */}
                  <Field type="hidden" name="parent_stop_source_id" />

                  {/* Translations */}
                  <Box sx={{ overflowX: "auto", minWidth: 0 }}>
                    <TranslationFields
                      translations={translations}
                      table_name={"stops"}
                      setTranslations={setTranslations}
                      fields={[{ value: "stop_name", label: LABELS.translation.itemStop }]}
                      languages={["en", "ja", "ja-Hrkt"]}
                      originalValues={{ stop_name: values.stop_name || "" }}
                    />
                  </Box>
                </Stack>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 4, pb: 3 }}>
              <Button onClick={onClose} color="primary">
                {BUTTONS.common.cancel}
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSubmitting}
              >
                {BUTTONS.common.create}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}
