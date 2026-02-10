import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Box,
  Button,
  Typography,
  TextField,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { trimText } from "../../utils/text";
import { formatJPDate, formatJPDateTime } from "../../utils/date";
import { GTFS } from "../../strings/domains/gtfs";
import { UI } from "../../constant/ui";

// Feed ID helper: extract feed id from filename
function getFeedId(filename) {
  const feedRegex = /^feed_([a-zA-Z0-9_]+)_[0-9]{8}_[0-9]{14}\.zip$/;
  const match = filename?.match?.(feedRegex);
  if (match) return match[1];
  return filename ? filename.replace(/\.zip$/, "") : UI.gtfs.fallbackDash;
}

const scenarioTableUi = GTFS.scenario.table;

// Mapping for scenario creation method
function formatCreationMethod(sc) {
  const t = (sc?.source_type || "").toLowerCase();
  if (t.includes("api")) return scenarioTableUi.creationMethod.api;
  if (t.includes("local")) return scenarioTableUi.creationMethod.local;
  if (t.includes("clone")) {
    const original =
      sc?.cloned_from_scenario_name ||
      sc?.parent_scenario_name ||
      sc?.source_scenario_name ||
      sc?.source_name ||
      "";
    return original
      ? scenarioTableUi.creationMethod.cloneFromTemplate.replace("{original}", original)
      : scenarioTableUi.creationMethod.clone;
  }
  return sc?.source_type || UI.gtfs.fallbackDash;
}

export default function ScenarioTable({
  scenarios,
  onRenameScenario,
  showDetailScenario,
  showEditGTFSData,
  showDeleteScenario,
  onDelete,
  showExportScenario,
  onExportScenario,
}) {
  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (sc) => {
    setEditingId(sc.id);
    setNameDraft(sc.scenario_name || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNameDraft("");
  };

  const saveEdit = async () => {
    if (!onRenameScenario || !editingId) return;
    if (!nameDraft?.trim()) {
      cancelEdit();
      return;
    }
    try {
      setSaving(true);
      await onRenameScenario(editingId, nameDraft.trim());
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  // Style for icon-only outlined buttons so height matches other outlined buttons
  const iconOutlinedButtonSx = (theme) => ({
    minWidth: 40,          // compact width but keep full button height
    height: 36,            // MUI "medium" button height
    p: "6px",              // comfortable padding for the icon
    borderColor: alpha(theme.palette.primary.main, 0.5),
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
  });

  const getSourceLabel = (source) => {
    const raw = source || UI.gtfs.fallbackDash;
    if (!source) return raw;
    return String(source).toLowerCase() === "owned scenario"
      ? scenarioTableUi.source.owned
      : raw;
  };

  const shouldShowSource = (sc) => sc.scenario_source && sc.project_name != null;


  return (
    <Paper sx={{ width: "100%", overflowX: "auto", mx: "auto" }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{scenarioTableUi.headers.scenarioName}</TableCell>
            <TableCell>{scenarioTableUi.headers.feedName}</TableCell>
            <TableCell>{scenarioTableUi.headers.startDate}</TableCell>
            <TableCell>{scenarioTableUi.headers.endDate}</TableCell>
            <TableCell>{scenarioTableUi.headers.createdAt}</TableCell>
            <TableCell>{scenarioTableUi.headers.updatedAt}</TableCell>
            <TableCell>{scenarioTableUi.headers.creationMethod}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {scenarios?.length > 0 ? (
            scenarios.map((sc) => (
              <TableRow key={sc.id ?? sc.scenario_name}>
                <TableCell sx={{ minWidth: 280 }}>
                  {editingId === sc.id ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        size="small"
                        value={nameDraft}
                        autoFocus
                        disabled={saving}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        sx={{ maxWidth: 320 }}
                      />
                      <Button aria-label={GTFS.common.actions.save} onClick={saveEdit}>
                        <CheckIcon />
                      </Button>
                      <Button aria-label={GTFS.common.actions.cancel} onClick={cancelEdit}>
                        <CloseIcon />
                      </Button>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      {/* left: scenario name + source stacked vertically */}
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          flexGrow: 1,
                          minWidth: 0,
                        }}
                      >
                        <Typography noWrap sx={{ maxWidth: "100%" }}>
                          {trimText(sc.scenario_name)}
                        </Typography>

                        {shouldShowSource(sc) && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ maxWidth: "100%" }}
                            title={sc.scenario_source}
                          >
                            {getSourceLabel(sc.scenario_source)}
                          </Typography>
                        )}
                      </Box>

                      {/* right: edit button stays on the side */}
                      <Tooltip title={scenarioTableUi.actions.startInlineRename}>
                        <Button
                          size="small"
                          aria-label={scenarioTableUi.actions.startInlineRename}
                          onClick={() => startEdit(sc)}
                          sx={{ minWidth: 32, p: 0.5 }}
                        >
                          {onRenameScenario && (
                            <span className="material-symbols-outlined outlined">
                              edit
                            </span>
                          )}
                        </Button>
                      </Tooltip>
                    </Box>
                  )}
                </TableCell>


                <TableCell>{getFeedId(sc.gtfs_filename)}</TableCell>
                <TableCell>{formatJPDate(sc.start_date)}</TableCell>
                <TableCell>{formatJPDate(sc.end_date)}</TableCell>
                <TableCell>{formatJPDateTime(sc.created_datetime)}</TableCell>
                <TableCell>
                  {sc.edit_state === "original"
                    ? UI.gtfs.fallbackDash
                    : formatJPDateTime(sc.updated_datetime)}
                </TableCell>
                <TableCell>{formatCreationMethod(sc)}</TableCell>

                <TableCell>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    {showDetailScenario && (
                      <Button
                        component={RouterLink}
                        to={`/scenario/${sc.id}`}
                        variant="outlined"
                        color="primary"
                        style={{ textDecoration: "none" }}
                      >
                        {GTFS.common.actions.detail}
                      </Button>
                    )}

                    {showEditGTFSData && (
                      <Button
                        component={RouterLink}
                        to={`/edit-data/${sc.id}`}
                        variant="outlined"
                        color="primary"
                        style={{ textDecoration: "none" }}
                      >
                        {scenarioTableUi.actions.startEdit}
                      </Button>
                    )}

                    {/* Export: outlined icon-only button */}
                    {showExportScenario && (
                      <Tooltip title={GTFS.common.actions.export}>
                        <Button
                          aria-label={GTFS.common.actions.export}
                          variant="outlined"
                          color="primary"
                          onClick={() => onExportScenario?.(sc)}
                          sx={iconOutlinedButtonSx}
                        >
                          <span className="material-symbols-outlined outlined">
                          download
                          </span>
                        </Button>
                      </Tooltip>
                    )}

                    {/* Delete: outlined icon-only button */}
                    {showDeleteScenario && (
                      <Tooltip title={GTFS.common.actions.delete}>
                        <Button
                          aria-label={GTFS.common.actions.delete}
                          variant="outlined"
                          color="primary"
                          onClick={() => onDelete?.(sc)}
                          sx={iconOutlinedButtonSx}
                        >
                          <span className="material-symbols-outlined outlined">
                          delete
                          </span>
                        </Button>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary">{scenarioTableUi.empty.noScenarios}</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
