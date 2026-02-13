// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { GTFS_DEFAULT_TABLE_NAMES } from "../../constant/gtfs";
import { GTFS } from "../../strings/domains/gtfs";

const ImportDetail = ({ info }) => {
  const ui = GTFS.import.detail;
  const common = GTFS.common;
  const recordCount =
    info?.import_info?.record_count || info?.record_count || {};
  const entries = Object.entries(recordCount);
  // Older scenarios may have no record_count; fall back to default GTFS files with unknown counts
  const recordList =
    entries.length > 0
      ? entries.map(([key, value]) => ({ name: key, count: value }))
      : GTFS_DEFAULT_TABLE_NAMES.map((name) => ({ name, count: null }));

  return (
    <Box>
      {/* Feed Info Table */}
      <TableContainer>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.feedInfo.publisherName}</TableCell>
              <TableCell>{info?.feed_publisher_name || common.placeholders.na}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.feedInfo.publisherUrl}</TableCell>
              <TableCell>{info?.feed_publisher_url || common.placeholders.na}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.feedInfo.feedLang}</TableCell>
              <TableCell>{info?.feed_lang || common.placeholders.na}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.feedInfo.feedStartDate}</TableCell>
              <TableCell>{info?.feed_start_date || common.placeholders.na}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.feedInfo.feedEndDate}</TableCell>
              <TableCell>{info?.feed_end_date || common.placeholders.na}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.feedInfo.feedVersion}</TableCell>
              <TableCell>{info?.feed_version || common.placeholders.na}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>


      {/* Data File Table */}
      <TableContainer>
        <Typography
          variant="h6"
          fontWeight="bold"
          gutterBottom
          sx={{ px: 2, pt: 4 }}
        >
          {ui.dataFiles.title}
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", width: 400 }}>{ui.dataFiles.table.headers.fileName}</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>{ui.dataFiles.table.headers.count}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recordList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  {ui.dataFiles.table.empty}
                </TableCell>
              </TableRow>
            ) : (
              recordList.map((row) => {
                const displayCount =
                  row.count === null || typeof row.count === "undefined"
                    ? common.placeholders.na
                    : row.count;
                return (
                  <TableRow key={row.name}>
                    <TableCell sx={{ width: 200 }}>{row.name}</TableCell>
                    <TableCell>{displayCount}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ImportDetail;
