// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Collapse,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { getSeverityMeta } from "../../../services/gtfsValidatorService";
import GTFSValidationNoticeDetail from "./GTFSValidationNoticeDetail";
import { UI } from "../../../constant/ui";
import { GTFS } from "../../../strings/domains/gtfs";


export default function GTFSValidationNotices({ report }) {
  const [openCodes, setOpenCodes] = useState([]);
  const ui = GTFS.validationTab.validator.notices;
  const maxGroups = UI.gtfs.validator.maxNoticeGroups;

    const warnings = report?.warnings || [];
    const infos = report?.infos || [];
    const fixableNotices =
      report?.fixable_notices || report?.fixableNotices || [];

    const unsafeNotices = [...warnings, ...infos];

    const safeNotices = report?.safe_notices || report?.safeNotices || [];

    const fixableLimited = fixableNotices.slice(0, maxGroups);
    const unsafeLimited = unsafeNotices.slice(0, maxGroups);
    const safeLimited = safeNotices.slice(0, maxGroups);

    const isFixableTruncated = fixableNotices.length > fixableLimited.length;
    const isTruncated =
      unsafeNotices.length > unsafeLimited.length ||
      safeNotices.length > safeLimited.length;

    const getNoticeCount = (n) => {
        if (!n) return 0;
        if (typeof n.totalNotices === "number") return n.totalNotices;
        if (typeof n.total_notices === "number") return n.total_notices;
        if (typeof n.notice_count === "number") return n.notice_count;
        if (typeof n.count === "number") return n.count;
        return 0;
    };

    const fixableTotalCount = fixableNotices.reduce(
        (sum, n) => sum + getNoticeCount(n),
        0
    );

    const fixableCountBySeverity = (severity) =>
    fixableNotices
        .filter((n) => n?.severity === severity)
        .reduce((sum, n) => sum + getNoticeCount(n), 0);

    const fixableErrorCount = fixableCountBySeverity("ERROR");
    const fixableWarningCount = fixableCountBySeverity("WARNING");
    const fixableInfoCount = fixableCountBySeverity("INFO");

    const totalCount = unsafeNotices.reduce(
        (sum, n) => sum + getNoticeCount(n),
        0
    );

    const countBySeverity = (severity) =>
    unsafeNotices
        .filter((n) => n?.severity === severity)
        .reduce((sum, n) => sum + getNoticeCount(n), 0);

    const errorCount = countBySeverity("ERROR");
    const warningCount = countBySeverity("WARNING");
    const infoCount = countBySeverity("INFO");

    const tableSx = { tableLayout: "fixed", width: "100%" };
    const toggleColSx = { width: 48 };
    const severityColSx = { width: 200, whiteSpace: "nowrap" };
    const countColSx = { width: 80, whiteSpace: "nowrap" };


  if (!fixableLimited.length && !unsafeLimited.length && !safeLimited.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {ui.empty}
      </Typography>
    );
  }

  const handleToggle = (code) => {
    setOpenCodes((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  };

  return (
    <Box>
      {/* Fixable notices section */}
      {fixableLimited.length > 0 && (
        <Box
          sx={{
            mb: unsafeLimited.length > 0 || safeLimited.length > 0 ? 4 : 0,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {ui.sections.fixable}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {ui.summaryTemplate
              .replace("{total}", String(fixableTotalCount))
              .replace("{error}", String(fixableErrorCount))
              .replace("{warning}", String(fixableWarningCount))
              .replace("{info}", String(fixableInfoCount))}
          </Typography>

          {isFixableTruncated && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              {ui.truncatedFixableTemplate.replace("{limit}", String(maxGroups))}
            </Typography>
          )}

          <Table size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={toggleColSx} />
                <TableCell>{ui.table.headers.code}</TableCell>
                <TableCell align="center" sx={severityColSx}>
                  {ui.table.headers.severity}
                </TableCell>
                <TableCell align="right" sx={countColSx}>
                  {ui.table.headers.count}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {fixableLimited.map((notice) => {
                const meta = getSeverityMeta(notice.severity);
                const isOpen = openCodes.includes(notice.code);

                return (
                  <React.Fragment key={`fixable-${notice.code}`}>
                    <TableRow
                      hover
                      onClick={() => handleToggle(notice.code)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          aria-label={
                            isOpen ? "Collapse notice" : "Expand notice"
                          }
                        >
                          {isOpen ? (
                            <KeyboardArrowDownIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowRightIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{notice.code}</Typography>
                      </TableCell>
                      <TableCell align="center" sx={severityColSx}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <span>{meta.icon}</span>
                          {meta.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={countColSx}>
                        <Typography variant="body2">
                          {getNoticeCount(notice)}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell
                        colSpan={4}
                        sx={{ p: 0, borderBottom: "none" }}
                      >
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, borderTop: "1px solid #eee" }}>
                            <GTFSValidationNoticeDetail
                              notice={notice}
                              descriptionOverride={notice.reason_ja}
                              descriptionAsHtml={false}
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {(unsafeLimited.length > 0 || safeLimited.length > 0) && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {ui.sections.results}
      </Typography>

      {/* Summary text from report (BE) */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {ui.summaryTemplate
              .replace("{total}", String(totalCount))
              .replace("{error}", String(errorCount))
              .replace("{warning}", String(warningCount))
              .replace("{info}", String(infoCount))}
         </Typography>   


      {isTruncated && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 1 }}
        >
          {ui.truncatedTemplate.replace("{limit}", String(maxGroups))}
        </Typography>
      )}

      {/* 1. Normal / unsafe notices section */}
      {unsafeLimited.length > 0 && (
        <Box sx={{ mb: safeLimited.length > 0 ? 4 : 0 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, mb: 1 }}
          >
            
          </Typography>

          <Table size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={toggleColSx} />
                <TableCell>{ui.table.headers.code}</TableCell>
                <TableCell align="center" sx={severityColSx}>
                  {ui.table.headers.severity}
                </TableCell>
                <TableCell align="right" sx={countColSx}>
                  {ui.table.headers.count}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {unsafeLimited.map((notice) => {
                const meta = getSeverityMeta(notice.severity);
                const isOpen = openCodes.includes(notice.code);

                return (
                  <React.Fragment key={`unsafe-${notice.code}`}>
                    <TableRow
                      hover
                      onClick={() => handleToggle(notice.code)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          aria-label={
                            isOpen
                              ? "Collapse notice"
                              : "Expand notice"
                          }
                        >
                          {isOpen ? (
                            <KeyboardArrowDownIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowRightIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {notice.code}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={severityColSx}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <span>{meta.icon}</span>
                          {meta.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={countColSx}>
                        <Typography variant="body2">
                          {getNoticeCount(notice)}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell
                        colSpan={4}
                        sx={{ p: 0, borderBottom: "none" }}
                      >
                        <Collapse
                          in={isOpen}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box
                            sx={{
                              p: 2,
                              borderTop: "1px solid #eee",
                            }}
                          >
                            <GTFSValidationNoticeDetail notice={notice} />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      
      {safeLimited.length > 0 && (
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, mb: 0.5 }}
          >
            {ui.sections.excluded}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1.5 }}
          >
            {ui.excludedDescription}
          </Typography>

          <Table size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={toggleColSx} />
                <TableCell>{ui.table.headers.code}</TableCell>
                <TableCell align="center" sx={severityColSx}>
                  {ui.table.headers.severity}
                </TableCell>
                <TableCell align="right" sx={countColSx}>
                  {ui.table.headers.count}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {safeLimited.map((notice) => {
                const meta = getSeverityMeta(notice.severity);
                const isOpen = openCodes.includes(notice.code);

                return (
                  <React.Fragment key={`safe-${notice.code}`}>
                    <TableRow
                      hover
                      onClick={() => handleToggle(notice.code)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          aria-label={
                            isOpen
                              ? "Collapse notice"
                              : "Expand notice"
                          }
                        >
                          {isOpen ? (
                            <KeyboardArrowDownIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowRightIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {notice.code}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={severityColSx}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <span>{meta.icon}</span>
                          {meta.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={countColSx}>
                        <Typography variant="body2">
                          {getNoticeCount(notice)}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell
                        colSpan={4}
                        sx={{ p: 0, borderBottom: "none" }}
                      >
                        <Collapse
                          in={isOpen}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box
                            sx={{
                              p: 2,
                              borderTop: "1px solid #eee",
                            }}
                          >
                            <GTFSValidationNoticeDetail notice={notice} />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
        </>
      )}
    </Box>
  );
}
