// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
} from "@mui/material";
import { useFormik } from "formik";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import ja from "date-fns/locale/ja";
import { GTFS } from "../../strings/domains/gtfs";

export default function EditScenarioModal({
  open,
  onClose,
  onSubmit,
  initialValues = { scenario_name: "", start_date: null, end_date: null },
}) {
  const ui = GTFS.scenario.editModal;
  const common = GTFS.common;
  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    onSubmit: (values) => {
      onSubmit(values);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{ui.title}</DialogTitle>
      <form onSubmit={formik.handleSubmit}>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label={ui.fields.scenarioName}
                  name="scenario_name"
                  value={formik.values.scenario_name}
                  onChange={formik.handleChange}
                  fullWidth
                  required
                  variant="standard"
                />
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label={ui.fields.startDate}
                  value={formik.values.start_date}
                  onChange={(newValue) => {
                    formik.setFieldValue("start_date", newValue);
                    if (
                      newValue &&
                      formik.values.end_date &&
                      new Date(formik.values.end_date) <= new Date(newValue)
                    ) {
                      formik.setFieldValue("end_date", null);
                    }
                  }}
                  format="yyyy/MM/dd"
                  slotProps={{
                    textField: {
                      variant: "standard",
                      fullWidth: true,
                      required: false,
                      error: false,
                      helperText: "",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label={ui.fields.endDate}
                  value={formik.values.end_date}
                  minDate={
                    formik.values.start_date
                      ? new Date(
                          new Date(formik.values.start_date).getTime() +
                            24 * 60 * 60 * 1000
                        )
                      : undefined
                  }
                  onChange={(newValue) =>
                    formik.setFieldValue("end_date", newValue)
                  }
                  format="yyyy/MM/dd"
                  slotProps={{
                    textField: {
                      variant: "standard",
                      fullWidth: true,
                      required: false,
                      error: false,
                      helperText: "",
                    },
                  }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary">
            {common.actions.cancel}
          </Button>
          <Button type="submit" color="primary" variant="contained">
            {common.actions.update}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
