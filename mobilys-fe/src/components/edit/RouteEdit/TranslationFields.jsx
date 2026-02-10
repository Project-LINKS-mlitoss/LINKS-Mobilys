import React from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Close";
import { LABELS } from "../../../strings";

export default function TranslationFields({
  translations,
  setTranslations,
  fields = [{ value: "route_short_name", label: LABELS.route.routeShortName }, { value: "route_long_name", label: LABELS.route.routeLongName }],
  languages = ["en", "ja", "ja-Hrkt"],
  originalValues = {
    route_short_name: "",
    route_long_name: "",
  },
}) {
  const addRow = () => {
    setTranslations([
      ...translations,
      { field_name: "", field_value: "", language: "", translation: "" },
    ]);
  };

  const updateRow = (index, key, value) => {
    const copy = [...translations];
    copy[index][key] = value;

    if (key === "field_name") {
      copy[index].field_value = originalValues[value] || "";
    }
    setTranslations(copy);
  };

  const removeRow = (index) => {
    setTranslations(translations.filter((_, i) => i !== index));
  };

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" mb={1}>
        {LABELS.translation.addTranslation}
      </Typography>
      <Button size="small" variant="outlined" onClick={addRow}>
        {LABELS.translation.addTranslation}
      </Button>

      {/* Rows Container */}
      <Box mt={2} sx={{ overflowX: "auto" }}>
        {translations.map((t, i) => (
          <Box
            key={i}
            display="flex"
            flexWrap="wrap"
            gap={1}
            alignItems="center"
            mt={1}
          >
            {/* Field selector */}
            <TextField
              select
              label={LABELS.translation.fieldName}
              value={t.field_name}
              onChange={(e) => updateRow(i, "field_name", e.target.value)}
              sx={{ width: 180 }}
              SelectProps={{
                renderValue: () => {
                  //originalValues[t.field_name] || t.field_name || "",
                  const field = fields.find((f) => (typeof f === "string" ? f : f.value) === t.field_name);
                  const label = typeof field === "string" ? field : field?.label || "";
                  return originalValues[t.field_name] || label;
                },
              }}
            >
              {fields.map((field) => {
                const value = typeof field === "string" ? field : field.value;
                const label = typeof field === "string" ? field : field.label;
                const original = originalValues?.[value];
                const isDisabled = !original;
                const displayLabel = original ? `${label} (${original})` : label;
                return (
                  <MenuItem
                    key={value}
                    value={value}
                    disabled={isDisabled}
                    sx={{
                      color: isDisabled ? "gray" : "inherit", // grey if disabled, black otherwise
                    }}
                  >
                    {displayLabel}
                  </MenuItem>
                );
              })}
            </TextField>

            {/* Language selector */}
            <TextField
              select
              label={LABELS.translation.language}
              value={t.language}
              onChange={(e) => updateRow(i, "language", e.target.value)}
              sx={{ width: 90 }}
            >
              {languages.map((code) => (
                <MenuItem key={code} value={code}>
                  {code}
                </MenuItem>
              ))}
            </TextField>

            {/* Translation input */}
            <TextField
              label={LABELS.translation.translation}
              value={t.translation}
              onChange={(e) => updateRow(i, "translation", e.target.value)}
              sx={{ flex: 1, minWidth: 120, maxWidth: 200 }}
            />

            {/* Delete button */}
            <IconButton size="small" onClick={() => removeRow(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
