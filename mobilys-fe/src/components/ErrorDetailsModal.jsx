import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { UI } from "../constant/ui.js";
import { BUTTONS, NOTIFICATION } from "../strings/index.js";


// Map severity to Japanese label for display
const severityToJaLabel = (severity) => {
  switch (severity) {
    case "ERROR":
      return NOTIFICATION.errorDetails.severity.error;
    case "WARNING":
      return NOTIFICATION.errorDetails.severity.warning;
    case "INFO":
      return NOTIFICATION.errorDetails.severity.info;
    default:
      return severity || "-";
  }
};

// severity to MUI chip color
const severityToColor = (severity) => {
  if (!severity) return "default";
  if (severity === "ERROR") return "error";
  if (severity === "WARNING") return "warning";
  return "info";
};


// Helper: get count field from notice
const getCountValue = (notice) => {
  if (!notice) return "-";
  if (notice.count != null) return notice.count;
  if (notice.total_notices != null) return notice.total_notices;
  if (notice.totalNotices != null) return notice.totalNotices;
  if (notice.notice_count != null) return notice.notice_count;
  return "-";
};

// Helper: description text
const getDescriptionValue = (notice) => {
  if (!notice) return "-";
  return (
    notice.description ||
    notice.message ||
    notice.summary ||
    "-"
  );
};

// Helper: Japan-specific note field
const getJapanNoteValue = (notice) => {
  if (!notice) return "";
  return (
    notice.jp_notice ||
    notice.jp_note ||
    notice.japan_note ||
    notice.japanese_note ||
    ""
  );
};

const renderSampleTable = (notice) => {
  const samples = notice.sampleNotices || [];
  if (!samples.length) return null;
  const maxSampleRows = UI.gtfs.validator.maxSampleRows;
  const limitedSamples = samples.slice(0, maxSampleRows);

  const keySet = new Set();
  limitedSamples.forEach((s) => {
    Object.keys(s || {}).forEach((k) => {
      if (k === "filename") return;
      keySet.add(k);
    });
  });
  const keys = Array.from(keySet);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, mb: 1 }}
      >
        {NOTIFICATION.errorDetails.sampleTitleTemplate({
          max: maxSampleRows,
          total: samples.length,
        })}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>
                {NOTIFICATION.errorDetails.fileName}
              </TableCell>
              {keys.map((key) => (
                <TableCell
                  key={key}
                  sx={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}
                >
                  {key}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {limitedSamples.map((s, idx) => (
              <TableRow key={idx} hover>
                <TableCell sx={{ fontSize: 12 }}>{idx + 1}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {s.filename ?? "-"}
                </TableCell>
                {keys.map((key) => (
                  <TableCell key={key} sx={{ fontSize: 12 }}>
                    {s[key] != null ? String(s[key]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};


// Generic renderer for a list of notices (one card = one notice)
function NoticeTable({ items }) {
  const [expandedCodes, setExpandedCodes] = React.useState([]);

  if (!items || items.length === 0) return null;

  const handleToggle = (noticeCode, hasBody) => {
    if (!hasBody) return;

    setExpandedCodes((prev) =>
      prev.includes(noticeCode)
        ? prev.filter((code) => code !== noticeCode)
        : [...prev, noticeCode]
    );
  };

  // Description + Japan note + sample data
  const renderNoticeBody = (notice) => {
    const description = getDescriptionValue(notice);
    const jpNote = getJapanNoteValue(notice);

    return (
      <Box sx={{ p: 2, pt: 1 }}>
        {/* 説明 */}
        {description && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1 }}
            >
              {NOTIFICATION.errorDetails.description}
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: 2, bgcolor: "#fafafa" }}
            >
              <Box
                component="div"
                sx={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  "& table": {
                    borderCollapse: "collapse",
                    marginTop: 1,
                  },
                  "& th, & td": {
                    border: "1px solid #ddd",
                    padding: "4px 8px",
                    fontSize: 12,
                  },

                  "& code": {
                    fontFamily: "monospace",
                    backgroundColor: "#f3f3f3",
                    padding: "0 3px",
                    borderRadius: 0.5,
                  },
                }}
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </Paper>
          </Box>
        )}



        {/* 日本向け注 */}
        {jpNote && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 0.5 }}
            >
              {NOTIFICATION.errorDetails.japanNote}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 13 }}>
              {jpNote}
            </Typography>
          </Box>
        )}

        {/* サンプルデータ */}
        {renderSampleTable(notice)}
      </Box>
    );
  };

  return (
    <Box sx={{ mt: 1 }}>
      {items.map((n) => {
        const hasSamples = !!n.sampleNotices?.length;
        const hasBody =
          hasSamples ||
          !!getDescriptionValue(n) ||
          !!getJapanNoteValue(n);
        const isExpanded = expandedCodes.includes(n.code);
        const severity = n.severity || "INFO";

        return (
          <Paper
            key={n.code}
            variant="outlined"
            sx={{
              mb: 2,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {/* Header (collapsed view) */}
            <Box
              onClick={() => handleToggle(n.code, hasBody)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1.5,
                cursor: hasBody ? "pointer" : "default",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  minWidth: 0,
                }}
              >
                <Chip
                  size="small"
                  label={severityToJaLabel(severity)}
                  color={severityToColor(severity)}
                  sx={{
                    fontWeight: 700,
                    fontSize: 11,
                    height: 24,
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.code}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  ml: 2,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
                >
                  {NOTIFICATION.errorDetails.matchedCountTemplate(getCountValue(n))}
                </Typography>
                {hasBody && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      transition: "transform 0.2s",
                      transform: isExpanded
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                  >
                    <ExpandMoreIcon fontSize="small" />
                  </Box>
                )}
              </Box>
            </Box>

            {/* Body (expanded view) */}
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              {renderNoticeBody(n)}
            </Collapse>
          </Paper>
        );
      })}
    </Box>
  );
}



export default function ErrorDetailsModal({ open, onClose, notification }) {
  // Parse error_response (string or object) → normalized object
  const errorResponse = React.useMemo(() => {
    const raw = notification?.error_response;
    if (!raw) return null;

    if (typeof raw === "object") return raw;

    try {
      // Handle Python-style dict string from BE
      const jsonStr = raw
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, "null")
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false");

      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse error_response:", e);
      return null;
    }
  }, [notification]);

  const blockingErrors = errorResponse?.blocking_errors || [];
  const warnings = errorResponse?.warnings || [];
  const infos = errorResponse?.infos || [];
  const safeNotices = errorResponse?.safe_notices || [];

  const unsafeNotices = [...blockingErrors, ...warnings, ...infos];

  const allNotices = [
    ...blockingErrors,
    ...warnings,
    ...infos,
    ...safeNotices,
  ];

  const blockingErrorCount = allNotices.filter(
    (n) => n?.severity === "ERROR"
  ).length;

  const warningCount = allNotices.filter(
    (n) => n?.severity === "WARNING"
  ).length;

  const infoCount = allNotices.filter(
    (n) => n?.severity === "INFO"
  ).length;

  if (!notification) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span
            className="material-symbols-outlined outlined"
            style={{ color: "#E53935", fontSize: 28 }}
          >
            error
          </span>
          <Typography variant="h6" fontWeight={700}>
            {NOTIFICATION.errorDetails.title}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {/* Top notification info */}
        <Alert
          severity={blockingErrorCount > 0 ? "error" : "warning"}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>
            {notification.message}
          </Typography>
          {notification.created_at && (
            <Typography variant="caption" color="text.secondary">
              {NOTIFICATION.errorDetails.occurredAtLabel}{" "}
              {new Date(notification.created_at).toLocaleString()}
            </Typography>
          )}
        </Alert>

        {/* Summary chips like PDF header */}
        {errorResponse && (
          <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
            <Chip
              label={NOTIFICATION.errorDetails.summaryChipLabelTemplate({
                label: NOTIFICATION.errorDetails.severity.error,
                count: blockingErrorCount,
              })}
              color={blockingErrorCount > 0 ? "error" : "default"}
              variant={blockingErrorCount > 0 ? "filled" : "outlined"}
            />
            <Chip
              label={NOTIFICATION.errorDetails.summaryChipLabelTemplate({
                label: NOTIFICATION.errorDetails.severity.warning,
                count: warningCount,
              })}
              color={warningCount > 0 ? "warning" : "default"}
              variant={warningCount > 0 ? "filled" : "outlined"}
            />
            <Chip
              label={NOTIFICATION.errorDetails.summaryChipLabelTemplate({
                label: NOTIFICATION.errorDetails.severity.info,
                count: infoCount,
              })}
              color={infoCount > 0 ? "info" : "default"}
              variant={infoCount > 0 ? "filled" : "outlined"}
            />
          </Box>
        )}

        {!errorResponse && (
          <Alert severity="info">{NOTIFICATION.errorDetails.noDetails}</Alert>
        )}

        {errorResponse && (
          <>
          

            {/* 1. Blocking errors & unsafe notices */}
            {unsafeNotices.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  {NOTIFICATION.errorDetails.resultsTitle}
                </Typography>
                <NoticeTable items={unsafeNotices} />
              </Box>
            )}

            {/* 2. Safe notices (Japan-excluded) */}
            {safeNotices.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant="h6"
                  sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}
                >
                  {NOTIFICATION.errorDetails.excludedTitle}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {NOTIFICATION.errorDetails.excludedDescription}
                </Typography>

                <NoticeTable items={safeNotices} />
              </Box>
            )}

            {unsafeNotices.length === 0 &&
              safeNotices.length === 0 && (
                <Alert severity="info">
                  {NOTIFICATION.errorDetails.emptyResults}
                </Alert>
              )}
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          {BUTTONS.common.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
