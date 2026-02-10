import React from "react";
import {
  Box,
  Typography,
  Stack,
  Alert,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { red, green } from "@mui/material/colors";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.csvValidation;
const directionMap = strings.tables.tripCountComparison.directionMap;

export default function CsvValidationTab({
  title = strings.title,
  showTitle = true,
  validationLoading = false,
  validationError = "",
  validationResult = null,
  comparisonsWithDiff = [],
  comparisonsNoDiff = [],
  invalidGroupedByRoute = [],
}) {
  // Trip diff data (with / without external array)
  const { withDiff, noDiff } = React.useMemo(() => {
    const rawComparisons = validationResult?.trip_count_comparisons ?? [];
    const hasExternalComparisons =
      (comparisonsWithDiff?.length ?? 0) > 0 ||
      (comparisonsNoDiff?.length ?? 0) > 0;

    if (hasExternalComparisons) {
      return {
        withDiff: comparisonsWithDiff || [],
        noDiff: comparisonsNoDiff || [],
      };
    }

    if (!Array.isArray(rawComparisons)) {
      return { withDiff: [], noDiff: [] };
    }

    const sorted = [...rawComparisons].sort((a, b) => {
      const da = Number(a.difference ?? 0);
      const db = Number(b.difference ?? 0);
      return Math.abs(db) - Math.abs(da);
    });
    return {
      withDiff: sorted.filter((r) => Number(r.difference ?? 0) !== 0),
      noDiff: sorted.filter((r) => Number(r.difference ?? 0) === 0),
    };
  }, [comparisonsNoDiff, comparisonsWithDiff, validationResult]);

  const hasDirectionColumn = React.useMemo(() => {
    const merged = [...(withDiff || []), ...(noDiff || [])];
    return merged.some(
      (r) =>
        (r?.direction_label !== undefined &&
          r?.direction_label !== null &&
          r?.direction_label !== "") ||
        (r?.direction_id !== undefined && r?.direction_id !== null)
    );
  }, [withDiff, noDiff]);

  // Invalid rows: prefer prop, fallback to validationResult
  const groupedInvalid =
    invalidGroupedByRoute && invalidGroupedByRoute.length
      ? invalidGroupedByRoute
      : validationResult?.invalid_rows_by_route ?? [];

  const hasResult =
    !!validationResult ||
    (withDiff?.length ?? 0) > 0 ||
    (noDiff?.length ?? 0) > 0 ||
    (groupedInvalid?.length ?? 0) > 0;

  return (
    <Box sx={{ p: 2 }}>
      {showTitle && (
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {title}
        </Typography>
      )}

      {/* Loading */}
      {validationLoading && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 4,
          }}
        >
          <CircularProgress size={32} sx={{ mb: 2 }} />
          <Typography sx={{ mt: 2 }}>{strings.loading}</Typography>
        </Box>
      )}

      {/* Error */}
      {!validationLoading && validationError && (
        <Alert severity="error">{validationError}</Alert>
      )}

      {/* Content */}
      {!validationLoading && !validationError && hasResult && (
        <Stack spacing={3}>
          {/* 差分あり */}
          <Section
            title={`${strings.sections.withDiff}${countSuffix(withDiff.length)}`}
          >
              <Table size="small" sx={{ mb: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <LabelStack top={strings.tables.tripCountComparison.patternId} />
                    </TableCell>
                    {hasDirectionColumn && (
                      <TableCell align="center">
                        <LabelStack
                          top={strings.tables.tripCountComparison.direction}
                          bottom={strings.tables.tripCountComparison.directionId}
                          align="center"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <LabelStack
                        top={strings.tables.tripCountComparison.serviceId}
                        bottom={strings.tables.tripCountComparison.serviceIdKey}
                      />
                    </TableCell>
                    <TableCell>
                      <LabelStack
                        top={strings.tables.tripCountComparison.segment}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <LabelStack
                        top={strings.tables.tripCountComparison.before}
                        align="right"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <LabelStack
                        top={strings.tables.tripCountComparison.after}
                        align="right"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <LabelStack
                        top={strings.tables.tripCountComparison.diff}
                        align="right"
                      />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {withDiff.map((r, idx) => (
                    <TableRow
                      key={
                        r.pattern_id ??
                        r.pattern_hash ??
                        `${r.service_id ?? "row"}-${idx}`
                      }
                    >
                      <TableCell sx={{ maxWidth: 220, wordBreak: "break-all" }}>
                        {r.pattern_id ?? "-"}
                      </TableCell>

                      {hasDirectionColumn && (
                        <TableCell
                          align="center"
                          sx={
                            r.is_direction_id_generated
                              ? { color: "primary.main", fontWeight: 700 }
                              : undefined
                          }
                        >
                          <Tooltip
                            arrow
                            title={
                              r.is_direction_id_generated
                                ? strings.tables.tripCountComparison
                                    .directionGeneratedTooltip
                                : directionMap[r.direction_id] ||
                                  strings.tables.tripCountComparison.unknown
                            }
                          >
                            <Box
                              component="span"
                              sx={{
                                display: "inline-block",
                                maxWidth: 120,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatDirectionLabel(r)}
                            </Box>
                          </Tooltip>
                        </TableCell>
                      )}
                      <TableCell>{r.service_id ?? "-"}</TableCell>

                      <TableCell sx={{ maxWidth: 220, wordBreak: "break-word" }}>
                        {r.first_and_last_stop_name ?? "-"}
                      </TableCell>

                      <TableCell align="right">
                        {r.original_trip_count}
                      </TableCell>
                      <TableCell align="right">
                        {r.duplicated_trip_count}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: "primary.main", fontWeight: 700 }}
                      >
                        {r.difference}
                      </TableCell>
                    </TableRow>
                  ))}

                  {withDiff.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={hasDirectionColumn ? 7 : 6}
                        align="center"
                        sx={{ color: "#888" }}
                      >
                        {strings.tables.tripCountComparison.empty}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          </Section>

          {/* 差分なし */}
          <Section
            title={`${strings.sections.noDiff}${countSuffix(noDiff.length)}`}
            defaultOpen={false}
          >
              <Table size="small" sx={{ mb: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <LabelStack top={strings.tables.tripCountComparison.patternId} />
                    </TableCell>
                    {hasDirectionColumn && (
                      <TableCell align="center">
                        <LabelStack
                          top={strings.tables.tripCountComparison.direction}
                          bottom={strings.tables.tripCountComparison.directionId}
                          align="center"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <LabelStack
                        top={strings.tables.tripCountComparison.serviceId}
                        bottom={strings.tables.tripCountComparison.serviceIdKey}
                      />
                    </TableCell>
                    <TableCell>
                      <LabelStack
                        top={strings.tables.tripCountComparison.segment}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <LabelStack
                        top={strings.tables.tripCountComparison.before}
                        align="right"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <LabelStack
                        top={strings.tables.tripCountComparison.after}
                        align="right"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <LabelStack
                        top={strings.tables.tripCountComparison.diff}
                        align="right"
                      />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {noDiff.map((r, idx) => (
                    <TableRow
                      key={
                        r.pattern_id ??
                        r.pattern_hash ??
                        `${r.service_id ?? "row"}-${idx}`
                      }
                    >
                      <TableCell sx={{ maxWidth: 220, wordBreak: "break-all" }}>
                        {r.pattern_id ?? "-"}
                      </TableCell>

                      {hasDirectionColumn && (
                        <TableCell
                          align="center"
                          sx={
                            r.is_direction_id_generated
                              ? { color: "primary.main", fontWeight: 700 }
                              : undefined
                          }
                        >
                          <Tooltip
                            arrow
                            title={
                              r.is_direction_id_generated
                                ? strings.tables.tripCountComparison
                                    .directionGeneratedTooltip
                                : directionMap[r.direction_id] ||
                                  strings.tables.tripCountComparison.unknown
                            }
                          >
                            <Box
                              component="span"
                              sx={{
                                display: "inline-block",
                                maxWidth: 120,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatDirectionLabel(r)}
                            </Box>
                          </Tooltip>
                        </TableCell>
                      )}

                      <TableCell>{r.service_id ?? "-"}</TableCell>

                      <TableCell sx={{ maxWidth: 220, wordBreak: "break-word" }}>
                        {r.first_and_last_stop_name ?? "-"}
                      </TableCell>

                      <TableCell align="right">
                        {r.original_trip_count}
                      </TableCell>
                      <TableCell align="right">
                        {r.duplicated_trip_count}
                      </TableCell>
                      <TableCell align="right">{r.difference}</TableCell>
                    </TableRow>
                  ))}

                  {noDiff.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={hasDirectionColumn ? 7 : 6}
                        align="center"
                        sx={{ color: "#888" }}
                      >
                        {strings.tables.tripCountComparison.empty}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          </Section>

          {/* 無効行 */}
          <Section
            title={`${strings.sections.invalidRows}${countSuffix(
              totalInvalidRows(groupedInvalid)
            )}`}
            defaultOpen={false}
          >
            {groupedInvalid && groupedInvalid.length > 0 ? (
              <Stack spacing={2}>
                {groupedInvalid.map(([routeId, rows]) => (
                  <Box key={routeId}>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, mb: 0.5 }}
                    >
                      {strings.tables.invalidRows.routeIdPrefix}
                      {routeId}
                    </Typography>

                    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
                      <Table size="small" sx={{ mb: 1 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              <LabelStack top={strings.tables.invalidRows.row} />
                            </TableCell>
                            <TableCell>
                              <LabelStack top={strings.tables.invalidRows.tripId} bottom={"trip_id"} />
                            </TableCell>
                            <TableCell>
                              <LabelStack top={strings.tables.invalidRows.issues} />
                            </TableCell>
                            <TableCell align="center">
                              <LabelStack
                                top={strings.tables.invalidRows.status}
                                bottom=""
                                align="center"
                              />
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((r, idx) => {
                            const issues = r.issues ?? [];
                            const hasIssues = issues.length > 0;
                            return (
                              <TableRow
                                key={`${routeId}-${r.row_number}-${
                                  r.trip_id ?? idx
                                }`}
                              >
                                <TableCell>{r.row_number}</TableCell>
                                <TableCell>{r.trip_id}</TableCell>
                                <TableCell>
                                  <Box
                                    component="ul"
                                    sx={{ pl: 2, mb: 0, mt: 0 }}
                                  >
                                    {issues.map((issue, j) => (
                                      <Box
                                        key={`${routeId}-${r.row_number}-${j}`}
                                        component="li"
                                        sx={{ mb: 0.5 }}
                                      >
                                        {issue.type}（{issue.scenario}）
                                      </Box>
                                    ))}
                                    {issues.length === 0 && (
                                      <Box
                                        component="li"
                                        sx={{ color: "#888" }}
                                      >
                                        {strings.tables.invalidRows.issueEmpty}
                                      </Box>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  {hasIssues ? (
                                    <Box
                                      sx={{
                                        color: red[600],
                                        fontWeight: 700,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                      }}
                                    >
                                      <CancelIcon sx={{ fontSize: 18 }} />{" "}
                                      {strings.tables.invalidRows.statusInvalid}
                                    </Box>
                                  ) : (
                                    <Box
                                      sx={{
                                        color: green[600],
                                        fontWeight: 700,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                      }}
                                    >
                                      <CheckCircleIcon sx={{ fontSize: 18 }} />{" "}
                                      {strings.tables.invalidRows.statusValid}
                                    </Box>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Paper>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ color: "#888" }}>
                {strings.tables.invalidRows.empty}
              </Typography>
            )}
          </Section>
        </Stack>
      )}

      {!validationLoading && !validationError && !hasResult && (
        <Typography sx={{ color: "text.secondary" }}>
          {strings.noResult}
        </Typography>
      )}
    </Box>
  );
}

// Collapsible section
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: open ? 1 : 0.5,
          cursor: "pointer",
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconButton size="small" sx={{ p: 0.5 }}>
          {open ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      {open && <Box>{children}</Box>}
    </Box>
  );
}

const LabelStack = ({ top, bottom, align = "left" }) => (
  <Box sx={{ textAlign: align, lineHeight: 1.2 }}>
    <Typography
      sx={{
        fontWeight: 700,
        whiteSpace: "nowrap",
        fontSize: "0.875rem",
      }}
    >
      {top}
    </Typography>
    {bottom && (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
      >
        {bottom}
      </Typography>
    )}
  </Box>
);

// utils
function countSuffix(n) {
  if (!Number.isFinite(n)) return "";
  return `（${n}件）`;
}

function totalInvalidRows(grouped) {
  if (!Array.isArray(grouped)) return 0;
  return grouped.reduce((sum, [, rows]) => sum + (rows?.length || 0), 0);
}

function formatDirectionLabel(row) {
  if (row?.direction_label) return row.direction_label;
  const dir = row?.direction_id;
  if (dir === 0 || dir === 1 || typeof dir === "number") {
    const label = directionMap?.[dir] ?? String(dir);
    return `${dir}: ${label}`;
  }
  return strings.tables.tripCountComparison.unknown;
}
