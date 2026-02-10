import React from "react";
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Tooltip,
  Button,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ScenarioAutocomplete from "../../components/shared/ScenarioAutocomplete";
import { useSnackbarStore } from "../../state/snackbarStore";
import { UI } from "../../constant";
import { SCENARIO } from "../../strings";
import { useGtfsScenarios } from "./hooks/useGtfsScenarios";

const TILE_HEIGHT_PX = UI.homeTile.heightPx;
const TILE_WIDTH_PX = UI.homeTile.widthPx;

function ScenarioInlinePickerTile({
  title,
  desc,
  scenarioOptions,
  loading,
  selectedScenarioId,
  setSelectedScenarioId,
  refreshScenarios,
  existingScenarioNames,
  cloneScenario,
}) {
  const selectedObj = React.useMemo(
    () =>
      scenarioOptions.find(
        (s) => String(s.id) === String(selectedScenarioId)
      ) || null,
    [scenarioOptions, selectedScenarioId]
  );
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [cloneSourceId, setCloneSourceId] = React.useState("");
  const [newScenarioName, setNewScenarioName] = React.useState("");
  const [cloning, setCloning] = React.useState(false);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [newScenarioNameError, setNewScenarioNameError] = React.useState("");

  const validateScenarioName = React.useCallback(
    (name) => {
      const v = (name || "").trim();
      if (!v) return SCENARIO.pickerTile.validation.requiredScenarioName;
      if (existingScenarioNames.has(v.toLowerCase())) {
        return SCENARIO.pickerTile.validation.duplicateScenarioName;
      }
      return null;
    },
    [existingScenarioNames]
  );

  const openCloneDialog = () => {
    setCloneSourceId(selectedObj ? String(selectedObj.id) : "");
    setNewScenarioName("");
    setNewScenarioNameError("");
    setCloneOpen(true);
  };

  const handleCloseCloneDialog = () => {
    setCloneOpen(false);
    setNewScenarioNameError("");
  };

  const handleClone = async () => {
    if (!cloneSourceId) return;

    const errorMsg = validateScenarioName(newScenarioName);
    if (errorMsg) {
      setNewScenarioNameError(errorMsg);
      return;
    }

    try {
      setCloning(true);
      const sid = await cloneScenario(cloneSourceId, newScenarioName.trim());

      if (sid) {
        await refreshScenarios();
        setSelectedScenarioId(String(sid));
      }

      setCloneOpen(false);
      setNewScenarioName("");
      setNewScenarioNameError("");
      showSnackbar({
        title: SCENARIO.pickerTile.snackbar.cloneSuccess,
        severity: "success",
      });
    } catch (e) {
      showSnackbar({
        title: SCENARIO.pickerTile.snackbar.internalError,
        detail: e?.message || "",
        severity: "error",
      });
    } finally {
      setCloning(false);
    }
  };


  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        height: `${TILE_HEIGHT_PX}px !important`,
        minHeight: `${TILE_HEIGHT_PX}px !important`,
        width: `${TILE_WIDTH_PX}px !important`,
        "&:hover": { boxShadow: 2 },
      }}
    >
      <CardContent
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 0.75,
          "& .tile-title": {
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          },
          "& .tile-desc": {
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          },
        }}
      >
        <Typography
          className="tile-title"
          variant="subtitle1"
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>

        {desc && (
          <Typography
            className="tile-desc"
            variant="body2"
            color="text.secondary"
          >
            {desc}
          </Typography>
        )}

        <Box sx={{ mt: 1 }}>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {SCENARIO.pickerTile.loading}
              </Typography>
            </Box>
          ) : (
            <>
              <ScenarioAutocomplete
                options={scenarioOptions}
                valueId={selectedScenarioId}
                onChangeId={setSelectedScenarioId}
                placeholder={SCENARIO.pickerTile.placeholder}
                size="small"
                fullWidth
                sourceLabelRequiresProject={true}
              />

              <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={openCloneDialog}
                  sx={{ width: "100%" }}
                >
                  {SCENARIO.pickerTile.cloneButton}
                </Button>
              </Box>

              {/* Clone dialog */}
              <Dialog
                open={cloneOpen}
                onClose={cloning ? undefined : handleCloseCloneDialog}
                fullWidth
                maxWidth="sm"
              >
                <DialogTitle>{SCENARIO.pickerTile.cloneDialog.title}</DialogTitle>
                <DialogContent>
                  <Box sx={{ mt: 1, display: "grid", gap: 2 }}>
                    <ScenarioAutocomplete
                      options={scenarioOptions}
                      valueId={cloneSourceId}
                      onChangeId={setCloneSourceId}
                      label={SCENARIO.pickerTile.cloneDialog.sourceLabel}
                      placeholder={
                        SCENARIO.pickerTile.cloneDialog.sourcePlaceholder
                      }
                      size="large"
                      sourceLabelRequiresProject={true}
                    />
                    <TextField
                      label={SCENARIO.pickerTile.cloneDialog.nameLabel}
                      placeholder={SCENARIO.pickerTile.cloneDialog.namePlaceholder}
                      value={newScenarioName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewScenarioName(value);
                        setNewScenarioNameError(validateScenarioName(value));
                      }}
                      error={Boolean(newScenarioNameError)}
                      helperText={newScenarioNameError || " "}
                    />
                  </Box>
                </DialogContent>
                <DialogActions>
                  <Button onClick={handleCloseCloneDialog} disabled={cloning}>
                    {SCENARIO.pickerTile.cloneDialog.cancel}
                  </Button>
                   <Button
                    variant="contained"
                    onClick={handleClone}
                    disabled={
                      !cloneSourceId ||
                      !newScenarioName.trim() ||
                      Boolean(newScenarioNameError) ||
                      cloning
                    }
                  >
                    {cloning
                      ? SCENARIO.pickerTile.cloneDialog.submitting
                      : SCENARIO.pickerTile.cloneDialog.submit}
                  </Button>
                </DialogActions>
                <Backdrop
                  open={cloning}
                  sx={{
                    position: "absolute",
                    zIndex: (theme) => theme.zIndex.modal + 1,
                  }}
                >
                  <CircularProgress />
                </Backdrop>
              </Dialog>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function HomeTiles({ sections = [], heading = "", selectedScenarioId, hasValidScenario }) {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {heading && (
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
          {heading}
        </Typography>
      )}

      {sections.map((sec, i) => (
        <Box key={`section-${i}`} sx={{ mb: 4 }}>
          {sec.title && (
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              {sec.title}
            </Typography>
          )}

          <Grid container spacing={2} alignItems="stretch">
            {sec.tiles.map((t, idx) => {
              const key =
                typeof t.to === "string"
                  ? t.to
                  : `${t.to?.pathname || ""}${t.to?.search || ""}` ||
                    `tile-${i}-${idx}`;

              if (!t.scenarioInlinePicker) {
                const disabled = Boolean(t.requiresScenario && !hasValidScenario);
                const go = (e) => {
                  if (disabled) {
                    e.preventDefault();
                    return;
                  }
                  if (!t.buildTo) return;
                  e.preventDefault();
                  const dest = t.buildTo(selectedScenarioId);
                  navigate(dest);
                };

                const card = (
                  <Card
                    elevation={0}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      display: "flex",
                      flexDirection: "column",
                      height: `${TILE_HEIGHT_PX}px !important`,
                      minHeight: `${TILE_HEIGHT_PX}px !important`,
                      width: `${TILE_WIDTH_PX}px !important`,
                      "&:hover": { boxShadow: 2 },
                    }}
                  >
                    <CardActionArea
                      component={t.buildTo ? "div" : RouterLink}
                      to={t.buildTo ? undefined : t.to}
                      onClick={go}
                      disabled={disabled}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") go(e);
                      }}
                      sx={{ flex: 1, display: "flex" }}
                    >
                      <CardContent
                        sx={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: 0.75,
                          "& .tile-title": {
                            display: "-webkit-box",
                            lineHeight: 1.35,
                            maxHeight: "2.7em",    // 2 lines * 1.35 line-height
                            wordBreak:"break-word",
                          },
                          "& .tile-desc": {
                            display: "-webkit-box",
                            lineHeight: 1.5,
                            maxHeight: "3em",      
                            wordBreak:"break-word",
                          },
                        }}
                      >
                        <Typography
                          className="tile-title"
                          variant="subtitle1"
                          sx={{ fontWeight: 600 }}
                        >
                          {t.title}
                        </Typography>
                        {t.desc && (
                          <Typography
                            className="tile-desc"
                            variant="body2"
                            color="text.secondary"
                          >
                            {t.desc}
                          </Typography>
                        )}
                        {disabled && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            {SCENARIO.common.selectScenarioFirst}
                          </Typography>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );

                return (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={4}
                    key={key}
                    sx={{ display: "flex" }}
                  >
                    {disabled ? (
                      <Tooltip title={SCENARIO.common.selectScenarioFirst}>
                        <span style={{ width: "100%", display: "flex" }}>
                          {card}
                        </span>
                      </Tooltip>
                    ) : (
                      card
                    )}
                  </Grid>
                );
              }

              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  key={key}
                  sx={{ display: "flex" }}
                >
                  {t.element}
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}

export default function Scenarios() {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const {
    scenarioOptions,
    loadingScenario,
    selectedScenarioId,
    setSelectedScenarioId,
    hasValidScenario,
    refreshScenarios,
    existingScenarioNames,
    cloneScenario,
    loadError,
  } = useGtfsScenarios();

  React.useEffect(() => {
    if (!loadError) return;
    showSnackbar({
      title: SCENARIO.pickerTile.snackbar.internalError,
      detail: loadError?.message || "",
      severity: "error",
    });
  }, [loadError, showSnackbar]);

  const sections = [
    {
      title: SCENARIO.home.sections.import.title,
      tiles: [
        {
          title: SCENARIO.home.sections.import.tiles.fromRepo.title,
          desc: SCENARIO.home.sections.import.tiles.fromRepo.desc,
          to: { pathname: "/import-data", search: "?tab=0" },
        },
        {
          title: SCENARIO.home.sections.import.tiles.fromLocal.title,
          desc: (
            <>
              {SCENARIO.home.sections.import.tiles.fromLocal.descLine1}
              <br />
              {SCENARIO.home.sections.import.tiles.fromLocal.descLine2}
            </>
          ),
          to: { pathname: "/import-data", search: "?tab=1" },
        },
      ],
    },
    {
      title: SCENARIO.home.sections.analysis.title,
      tiles: [
        {
          title: SCENARIO.home.sections.analysis.tiles.visualization.title,
          desc: SCENARIO.home.sections.analysis.tiles.visualization.desc,
          to: "/route-timetable",
        },
        {
          title: SCENARIO.home.sections.analysis.tiles.boardingAlighting.title,
          desc:
            SCENARIO.home.sections.analysis.tiles.boardingAlighting.desc,
          to: "/boarding-alighting-analysis",
        },
        {
          title: SCENARIO.home.sections.analysis.tiles.odAnalysis.title,
          desc: (
            <>
              {SCENARIO.home.sections.analysis.tiles.odAnalysis.descLine1}
              <br />
              {SCENARIO.home.sections.analysis.tiles.odAnalysis.descLine2}
            </>
          ),
          to: "/od-analysis",
        },
      ],
    },
    {
      title: SCENARIO.home.sections.simulation.title,
      tiles: [
        {
          title: SCENARIO.home.sections.simulation.tiles.simple.title,
          desc:
            SCENARIO.home.sections.simulation.tiles.simple.desc,
          to: "/sim/simple",
        },
        {
          title: SCENARIO.home.sections.simulation.tiles.full.title,
          desc:
            SCENARIO.home.sections.simulation.tiles.full.desc,
          to: "/simulation",
        },
      ],
    },
    {
      title: SCENARIO.home.sections.guidedEdit.title,
      tiles: [
        {
          scenarioInlinePicker: true,
          element: (
            <ScenarioInlinePickerTile
              title={SCENARIO.home.sections.guidedEdit.tiles.picker.title}
              desc={SCENARIO.home.sections.guidedEdit.tiles.picker.desc}
              scenarioOptions={scenarioOptions}
              loading={loadingScenario}
              selectedScenarioId={selectedScenarioId}
              setSelectedScenarioId={setSelectedScenarioId}
              refreshScenarios={refreshScenarios}
              existingScenarioNames={existingScenarioNames}
              cloneScenario={cloneScenario}
            />
          ),
        },
        {
          title: SCENARIO.home.sections.guidedEdit.tiles.timetable.title,
          desc: SCENARIO.home.sections.guidedEdit.tiles.timetable.desc,
          requiresScenario: true,
          buildTo: (id) => ({
            pathname: `/edit-data/${id}`,
            search: `?flow=timetable`,
          }),
        },
        {
          title: SCENARIO.home.sections.guidedEdit.tiles.route.title,
          desc: SCENARIO.home.sections.guidedEdit.tiles.route.desc,
          requiresScenario: true,
          buildTo: (id) => ({
            pathname: `/edit-data/${id}`,
            search: `?flow=route`,
          }),
        },
        {
          title: SCENARIO.home.sections.guidedEdit.tiles.stops.title,
          desc: SCENARIO.home.sections.guidedEdit.tiles.stops.desc,
          requiresScenario: true,
          buildTo: (id) => ({
            pathname: `/edit-data/${id}`,
            search: `?flow=stops`,
          }),
        },
      ],
    },
    {
      title: SCENARIO.home.sections.edit.title,
      tiles: [
        {
          title: SCENARIO.home.sections.edit.tiles.edit.title,
          desc: SCENARIO.home.sections.edit.tiles.edit.desc,
          requiresScenario: false,
          to: "/edit-data",
        },
      ],
    },
  ];

  return (
    <HomeTiles
      sections={sections}
      selectedScenarioId={selectedScenarioId}
      hasValidScenario={hasValidScenario}
    />
  );
}
