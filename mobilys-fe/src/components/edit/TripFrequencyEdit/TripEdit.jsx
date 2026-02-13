// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Paper,
  Switch,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  MenuItem,
  Select,
  CircularProgress,
  Backdrop,
  Popover,
  Tooltip,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { directionMap } from "../../../constant/gtfs";
import { LABELS, BUTTONS } from "../../../strings";

const calcFinal = (initial, op, value) => {
  if (value === undefined || value === null || value === "") return initial;
  const num = Number(value);
  if (op === "pm") return initial + num < 0 ? 0 : initial + num;
  if (op === "*") return initial * num;
  return initial;
};

const getAllTrips = (route) => [
  ...(route.trips_edit_enabled || []),
  ...(route.trips_edit_disabled || []),
];

const TripEdit = ({ routeGroups, onChange, scenarioId, handleSubmit }) => {
  const [loadingTripEdit, setLoadingTripEdit] = useState(false);
  const [openGroup, setOpenGroup] = useState({});

  const [openRoute, setOpenRoute] = useState({});

  const [switchRoute, setSwitchRoute] = useState({}); // route_id: true=>per trip, false=>per route
  const [groupMulti, setGroupMulti] = useState({});
  const [routeMulti, setRouteMulti] = useState({});
  const [tripOp, setTripOp] = useState({});
  const [tripVal, setTripVal] = useState({});
  const [routeTripFilter, setRouteTripFilter] = useState({});

  const [filterPopover, setFilterPopover] = useState({
    anchorEl: null,
    routeId: null,
  });

  const handleToggleGroup = useCallback((groupId) => {
    setOpenGroup((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const handleToggleRoute = useCallback((routeId) => {
    setOpenRoute((prev) => ({ ...prev, [routeId]: !prev[routeId] }));
  }, []);

  const handleTripVal = useCallback((stdId, op, val) => {
    setTripOp((prev) => (prev[stdId] === op ? prev : { ...prev, [stdId]: op }));
    setTripVal((prev) =>
      prev[stdId] === val ? prev : { ...prev, [stdId]: val }
    );
  }, []);

  // --- Main performance refactor for switch ---
  const handleSwitch = useCallback((routeId, groupId) => {
    setLoadingTripEdit(true);
    setTimeout(() => {
      setSwitchRoute((prevSwitchRoute) => {
        const next = !prevSwitchRoute[routeId];

        if (next) setOpenRoute((prev) => ({ ...prev, [routeId]: true }));

        // Find group and route only once
        const group = routeGroups.find((g) => g.group_route_id === groupId);
        const route = group?.routes.find((r) => r.route_id === routeId);
        if (!route) return { ...prevSwitchRoute, [routeId]: next };

        const tripIds = getAllTrips(route).map((trip) => {
          const isTripEditMode = !!switchRoute[route.route_id];
          const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
          return tripKey;
        });

        if (!next) {
          // Switch OFF (route mode): reset trip ops/vals, set routeMulti from groupMulti if available
          setTripOp((prevOp) => {
            const update = { ...prevOp };
            tripIds.forEach((stdId) => delete update[stdId]);
            return update;
          });
          setTripVal((prevVal) => {
            const update = { ...prevVal };
            tripIds.forEach((stdId) => delete update[stdId]);
            return update;
          });
          setRouteMulti((prevRouteMulti) => ({
            ...prevRouteMulti,
            [routeId]: groupMulti[groupId] || "",
          }));
        } else {
          // Switch ON (trip mode): clear routeMulti, set default trip ops/vals
          setRouteMulti((prevRouteMulti) => ({
            ...prevRouteMulti,
            [routeId]: "",
          }));
          setTripOp((prevOp) => {
            const update = { ...prevOp };
            tripIds.forEach((stdId) => {
              if (!update[stdId]) update[stdId] = "+";
            });
            return update;
          });
          setTripVal((prevVal) => {
            const update = { ...prevVal };
            tripIds.forEach((stdId) => {
              if (!update[stdId]) update[stdId] = "";
            });
            return update;
          });
        }

        return { ...prevSwitchRoute, [routeId]: next };
      });
    }, 0);
  }, []);

  useEffect(() => {
    if (loadingTripEdit) {
      const to = setTimeout(() => setLoadingTripEdit(false), 300);
      return () => clearTimeout(to);
    }
  }, [switchRoute, loadingTripEdit]);

  // --- Group multiplier: set all child routes unless trip mode ---
  const handleGroupMulti = useCallback(
    (groupId, val) => {
      setGroupMulti((prev) => ({ ...prev, [groupId]: val }));

      const group = routeGroups.find((g) => g.group_route_id === groupId);
      if (!group) return;

      setRouteMulti((prev) => {
        const update = { ...prev };
        group.routes.forEach((route) => {
          if (!switchRoute[route.route_id]) {
            update[route.route_id] = val;
          }
        });
        return update;
      });
      const isTripEditMode = !!switchRoute[route.route_id];

      // Reset trip values (for all non-tripmode routes)
      setTripOp((prev) => {
        const update = { ...prev };
        group.routes.forEach((route) => {
          if (!switchRoute[route.route_id]) {
            getAllTrips(route).forEach((trip) => {
              const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
              delete update[tripKey];
            });
          }
        });
        return update;
      });
      setTripVal((prev) => {
        const update = { ...prev };
        group.routes.forEach((route) => {
          if (!switchRoute[route.route_id]) {
            getAllTrips(route).forEach((trip) => {
              const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
              delete update[tripKey];
            });
          }
        });
        return update;
      });
    },
    [routeGroups, switchRoute]
  );

  // --- Route multiplier: reset all trip values under route unless in trip mode ---
  const handleRouteMulti = useCallback(
    (routeId, val) => {
      setRouteMulti((prev) => ({ ...prev, [routeId]: val }));
      if (!switchRoute[routeId]) {
        // Find route only once
        const route = routeGroups
          .flatMap((g) => g.routes)
          .find((r) => r.route_id === routeId);
        if (route) {
          const isTripEditMode = !!switchRoute[route.route_id];

          const tripIds = getAllTrips(route).map((trip) => {
            const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
            return tripKey;
          });
          setTripOp((prev) => {
            const update = { ...prev };
            tripIds.forEach((stdId) => delete update[stdId]);
            return update;
          });
          setTripVal((prev) => {
            const update = { ...prev };
            tripIds.forEach((stdId) => delete update[stdId]);
            return update;
          });
        }
      }
    },
    [routeGroups, switchRoute]
  );

  const filterTrips = (trips, filter = {}) => {
    let arr = trips || [];
    if (filter.first_and_last_stop_name)
      arr = arr.filter((trip) =>
        (trip.first_and_last_stop_name || "").includes(
          filter.first_and_last_stop_name
        )
      );
    if (filter.direction_id !== "" && filter.direction_id !== undefined)
      arr = arr.filter(
        (trip) => String(trip.direction_id) === String(filter.direction_id)
      );
    if (filter.service_id)
      arr = arr.filter((trip) => trip.service_id === filter.service_id);
    return arr;
  };

  const calculateGroupTotal = (group) =>
    Math.max(
      group.routes.reduce((total, route) => {
        const filter = routeTripFilter[route.route_id] || {};
        return total + calculateRouteTotal(route, filter);
      }, 0),
      0
    );

  const calculateRouteTotal = (route, filter = {}) => {
    const trips = switchRoute[route.route_id]
      ? route.trips_edit_enabled
      : route.trips_edit_disabled;
    const filteredTrips = filterTrips(trips, filter);
    return Math.max(
      filteredTrips.reduce((sum, trip) => sum + (trip.interval || 0), 0),
      0
    );
  };

  const calculateGroupAfter = (group) =>
    Math.max(
      group.routes.reduce((total, route) => {
        const trips =
          (switchRoute[route.route_id]
            ? route.trips_edit_enabled
            : route.trips_edit_disabled) || [];
        const filter = routeTripFilter[route.route_id] || {};
        const filteredTrips = filterTrips(trips, filter);
        if (switchRoute[route.route_id]) {
          const isTripEditMode = !!switchRoute[route.route_id];
          return (
            total +
            filteredTrips.reduce((sum, trip) => {
              const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
              const op = tripOp[tripKey] || "pm";
              const val = tripVal[tripKey] || 0;
              return sum + calcFinal(trip.interval, op, val);
            }, 0)
          );
        } else {
          const multiplier = Number(routeMulti[route.route_id] || 1);
          return total + calculateRouteTotal(route, filter) * multiplier;
        }
      }, 0),
      0
    );

  const calculateRouteAfter = (route, filter = {}) => {
    const trips = switchRoute[route.route_id]
      ? route.trips_edit_enabled
      : route.trips_edit_disabled;
    const filteredTrips = filterTrips(trips, filter);

    if (switchRoute[route.route_id]) {
      const isTripEditMode = !!switchRoute[route.route_id];
      return Math.max(
        filteredTrips.reduce((sum, trip) => {
          const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
          const op = tripOp[tripKey] || "pm";
          const val = tripVal[tripKey] || 0;
          return sum + calcFinal(trip.interval, op, val);
        }, 0),
        0
      );
    } else {
      const multiplier = Number(routeMulti[route.route_id] || 1);
      return Math.max(
        filteredTrips.reduce((sum, trip) => sum + (trip.interval || 0), 0) *
        multiplier,
        0
      );
    }
  };

  const renderTrips = (route, filter = {}) => {
    let trips =
      (switchRoute[route.route_id]
        ? route.trips_edit_enabled
        : route.trips_edit_disabled) || [];

    if (filter.first_and_last_stop_name)
      trips = trips.filter((trip) =>
        (trip.first_and_last_stop_name || "").includes(
          filter.first_and_last_stop_name
        )
      );

    if (filter.direction_id !== "" && filter.direction_id !== undefined)
      trips = trips.filter(
        (trip) => String(trip.direction_id) === String(filter.direction_id)
      );

    if (filter.service_id)
      trips = trips.filter((trip) => trip.service_id === filter.service_id);

    return trips.map((trip) => {
      const isTripEditMode = !!switchRoute[route.route_id];
      const tripKey = `${isTripEditMode ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;

      const stdId = tripKey;
      const initial = trip.interval;
      const op = tripOp[stdId] || "pm";
      const val = tripVal[stdId] || "";
      const final = switchRoute[route.route_id]
        ? calcFinal(initial, op, val)
        : initial * (routeMulti[route.route_id] || 1) < 0
          ? 0
          : initial * (routeMulti[route.route_id] || 1);

      return (
        <TableRow key={stdId}>
          <TableCell sx={{ pl: 8 }}>
            {trip.standardized_trip_id} /{" "}
            {directionMap[trip.direction_id] || LABELS.common.unknown}
          </TableCell>
          <TableCell align="center"></TableCell>
          <TableCell align="center">{trip.interval}</TableCell>
          <TableCell align="center">
            {switchRoute[route.route_id] && (
              <Stack direction="row" spacing={1} justifyContent="center">
                <Select
                  size="small"
                  value={tripOp[stdId] || "pm"}
                  renderValue={(value) => (value === "pm" ? "+/-" : "×")}
                  onChange={(e) =>
                    handleTripVal(stdId, e.target.value, tripVal[stdId] || "")
                  }
                  sx={{ width: 80 }}>
                  <MenuItem value="pm">+/-</MenuItem>
                  <MenuItem value="*">×</MenuItem>
                </Select>
                <TextField
                  size="small"
                  type="number"
                  sx={{ width: 80 }}
                  value={val}
                  onChange={(e) => handleTripVal(stdId, op, e.target.value)}
                />
              </Stack>
            )}
          </TableCell>
          <TableCell align="center">{final}</TableCell>
        </TableRow>
      );
    });
  };

  const updatedData = useMemo(() => {
    return routeGroups?.map((group) => ({
      scenario_id: scenarioId,
      group_route_id: group.group_route_id,
      group_route_name: group.group_route_name,
      routes: group.routes.map((route) => {
        const isTripLevel = !!switchRoute[route.route_id];
        const filterRaw = routeTripFilter[route.route_id] || {};

        const trips =
          (switchRoute[route.route_id]
            ? route.trips_edit_enabled
            : route.trips_edit_disabled) || [];

        return {
          route_id: route.route_id,
          isEditOnTripsLevel: isTripLevel,
          value: !isTripLevel ? Number(routeMulti[route.route_id] || 1) : null,
          filter: {
            service_id:
              filterRaw.service_id === "" ? null : filterRaw.service_id,
            direction_id:
              filterRaw.direction_id === "" ? null : filterRaw.direction_id,
            first_and_last_stop_name:
              filterRaw.first_and_last_stop_name === ""
                ? null
                : filterRaw.first_and_last_stop_name,
          },
          trips: isTripLevel
            ? trips?.map((trip) => {
              const tripKey = `${isTripLevel ? "enabled" : "disabled"}-${trip.id}-${trip.standardized_trip_id}`;
              const newInterval = calcFinal(
                trip.interval || 0,
                tripOp[tripKey] || "+",
                tripVal[tripKey] || ""
              );
              return {
                trip_id: trip.trip_id,
                current_interval: trip.interval || 0,
                new_interval: newInterval,
                service_id: trip.service_id,
              };
            })
            : null,
        };
      }),
    }));
  }, [routeGroups, switchRoute, routeMulti, tripOp, tripVal]);

  useEffect(() => {
    onChange(updatedData);
  }, [updatedData, onChange]);
  return (
    <Box sx={{ py: 3, maxWidth: "90%", mx: "auto" }}>
      <Paper elevation={0} sx={{ p: 2 }}>
        <Backdrop open={loadingTripEdit} sx={{ zIndex: 1200 }}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Table sx={{ width: "100%" }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 180 }}>{LABELS.trip.routeNameTable}</TableCell>
              <TableCell align="center">{LABELS.trip.editMode}</TableCell>
              <TableCell align="center">{LABELS.trip.totalTrips}</TableCell>
              <TableCell align="center">{LABELS.trip.freqAdjustment}</TableCell>
              <TableCell align="center">{LABELS.trip.totalTripsAfter}</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {routeGroups?.map((group) => (
              <React.Fragment key={group.group_route_id}>
                {/* Level 1 */}
                <TableRow>
                  <TableCell>
                    <IconButton
                      onClick={() => handleToggleGroup(group.group_route_id)}>
                      {openGroup[group.group_route_id] ? (
                        <ExpandLess />
                      ) : (
                        <ExpandMore />
                      )}
                    </IconButton>
                    <Typography component="span" fontWeight="bold">
                      {group.group_route_name}
                    </Typography>
                  </TableCell>
                  <TableCell align="center"></TableCell>
                  <TableCell align="center">
                    {calculateGroupTotal(group)}
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      type="number"
                      sx={{ width: 80 }}
                      value={groupMulti[group.group_route_id] || ""}
                      onChange={(e) =>
                        handleGroupMulti(group.group_route_id, e.target.value)
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">×</InputAdornment>
                        ),
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {calculateGroupAfter(group)}
                  </TableCell>
                </TableRow>

                {openGroup[group.group_route_id] &&
                  group.routes.map((route) => (
                    <React.Fragment key={route.route_id}>
                      {/* Level 2 */}
                      <TableRow>
                        <TableCell
                          sx={{ pl: 4, display: "flex", alignItems: "center" }}>
                          <IconButton
                            onClick={() => handleToggleRoute(route.route_id)}>
                            {openRoute[route.route_id] ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </IconButton>
                          <Typography component="span" sx={{ ml: 1 }}>
                            {route.route_long_name || route.route_id}
                          </Typography>
                          <Tooltip title={LABELS.common.filter}>
                            <IconButton
                              size="small"
                              sx={{ ml: 1 }}
                              onClick={(e) =>
                                setFilterPopover({
                                  anchorEl: e.currentTarget,
                                  routeId: route.route_id,
                                })
                              }>
                              <FilterListIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>

                        <TableCell align="center">
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="center"
                            spacing={0.5}>
                            <Typography variant="caption" color="textSecondary">
                              {LABELS.trip.perRoute}
                            </Typography>

                            <Switch
                              checked={!!switchRoute[route.route_id]}
                              onChange={() =>
                                handleSwitch(
                                  route.route_id,
                                  group.group_route_id
                                )
                              }
                            />
                            <Typography variant="caption" color="textSecondary">
                              {LABELS.trip.perTrip}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell align="center">
                          {calculateRouteTotal(
                            route,
                            routeTripFilter[route.route_id] || {}
                          )}
                        </TableCell>

                        <TableCell align="center">
                          {!switchRoute[route.route_id] && (
                            <TextField
                              size="small"
                              type="number"
                              sx={{ width: 80 }}
                              value={routeMulti[route.route_id] || ""}
                              onChange={(e) =>
                                handleRouteMulti(route.route_id, e.target.value)
                              }
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    ×
                                  </InputAdornment>
                                ),
                              }}
                            />
                          )}
                          {switchRoute[route.route_id] && (
                            <Typography variant="body2" color="textSecondary">
                              {LABELS.trip.perTripEditing}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="center">
                          {calculateRouteAfter(
                            route,
                            routeTripFilter[route.route_id] || {}
                          )}
                        </TableCell>
                      </TableRow>

                      <Popover
                        open={Boolean(filterPopover.anchorEl)}
                        anchorEl={filterPopover.anchorEl}
                        onClose={() =>
                          setFilterPopover({ anchorEl: null, routeId: null })
                        }
                        anchorOrigin={{
                          vertical: "bottom",
                          horizontal: "left",
                        }}
                        transformOrigin={{
                          vertical: "top",
                          horizontal: "left",
                        }}>
                        {filterPopover.routeId &&
                          (() => {
                            const route =
                              group.routes.find(
                                (r) => r.route_id === filterPopover.routeId
                              ) ||
                              routeGroups
                                ?.flatMap((g) => g.routes)
                                .find(
                                  (r) => r.route_id === filterPopover.routeId
                                ); // fallback
                            if (!route) return null;
                            const trips = [
                              ...(route.trips_edit_enabled ?? []),
                              ...(route.trips_edit_disabled ?? []),
                            ];
                            const uniqueServiceIds = Array.from(
                              new Set(trips.map((t) => t.service_id))
                            ).filter(Boolean);
                            const uniqueDirections = Array.from(
                              new Set(trips.map((t) => t.direction_id))
                            ).filter((v) => v !== undefined && v !== null);
                            const uniqueStopNames = Array.from(
                              new Set(
                                trips.map((t) => t.first_and_last_stop_name)
                              )
                            ).filter(Boolean);

                            return (
                              <Box sx={{ p: 2, minWidth: 250 }}>
                                <Typography fontWeight="bold" gutterBottom>
                                  {LABELS.common.filter}
                                </Typography>
                                <Stack direction="column" spacing={2}>
                                  <Select
                                    displayEmpty
                                    size="small"
                                    fullWidth
                                    value={
                                      routeTripFilter[filterPopover.routeId]
                                        ?.first_and_last_stop_name ?? ""
                                    }
                                    onChange={(e) =>
                                      setRouteTripFilter((prev) => ({
                                        ...prev,
                                        [filterPopover.routeId]: {
                                          ...prev[filterPopover.routeId],
                                          first_and_last_stop_name:
                                            e.target.value,
                                        },
                                      }))
                                    }>
                                    <MenuItem value="">{LABELS.trip.allSections}</MenuItem>
                                    {uniqueStopNames.map((name) => (
                                      <MenuItem key={name} value={name}>
                                        {name}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                  <Select
                                    displayEmpty
                                    size="small"
                                    fullWidth
                                    value={
                                      routeTripFilter[filterPopover.routeId]
                                        ?.direction_id ?? ""
                                    }
                                    onChange={(e) =>
                                      setRouteTripFilter((prev) => ({
                                        ...prev,
                                        [filterPopover.routeId]: {
                                          ...prev[filterPopover.routeId],
                                          direction_id: e.target.value,
                                        },
                                      }))
                                    }>
                                    <MenuItem value="">{LABELS.trip.allDirections}</MenuItem>
                                    {uniqueDirections.map((dir) => (
                                      <MenuItem key={dir} value={dir}>
                                        {`${directionMap?.[dir] ?? dir} (${dir})`}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                  <Select
                                    displayEmpty
                                    size="small"
                                    fullWidth
                                    value={
                                      routeTripFilter[filterPopover.routeId]
                                        ?.service_id ?? ""
                                    }
                                    onChange={(e) =>
                                      setRouteTripFilter((prev) => ({
                                        ...prev,
                                        [filterPopover.routeId]: {
                                          ...prev[filterPopover.routeId],
                                          service_id: e.target.value,
                                        },
                                      }))
                                    }>
                                    <MenuItem value="">{LABELS.trip.allServices}</MenuItem>
                                    {uniqueServiceIds.map((sid) => (
                                      <MenuItem key={sid} value={sid}>
                                        {sid}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </Stack>
                                <Box sx={{ textAlign: "right", mt: 2 }}>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      setRouteTripFilter((prev) => ({
                                        ...prev,
                                        [filterPopover.routeId]: {
                                          first_and_last_stop_name: "",
                                          direction_id: "",
                                          service_id: "",
                                        },
                                      }))
                                    }>
                                    {BUTTONS.common.reset}
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      setFilterPopover({
                                        anchorEl: null,
                                        routeId: null,
                                      })
                                    }>
                                    {BUTTONS.common.close}
                                  </Button>
                                </Box>
                              </Box>
                            );
                          })()}
                      </Popover>
                      {/* LEVEL 3 */}
                      {openRoute[route.route_id] &&
                        renderTrips(
                          route,
                          routeTripFilter[route.route_id] || {}
                        )}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>

        <Box
          sx={{
            textAlign: "right",
            position: "sticky",
            bottom: 0,
            zIndex: 10,
            bgcolor: "#fff",
            borderTop: "1px solid #eee",
            p: 2,
          }}>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {BUTTONS.common.save}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default TripEdit;
