// src/components/gtfs/GTFSImportAPI.jsx
import {
  Box,
  MenuItem,
  Select,
  Typography,
  TextField,
  InputAdornment,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  CircularProgress,
  Alert,
  Link,
  Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EmptyState from "../EmptyState";
import { useState } from "react";
import GTFSFeedDetailModal from "./GTFSFeedDetailModal";
import { UI } from "../../constant/ui";
import { GTFS } from "../../strings/domains/gtfs";

export default function GTFSImportAPI({
  loading,
  error,
  prefecture,
  setPrefecture,
  org,
  setOrg,
  search,
  setSearch,
  uniqueOrganizations,
  filteredData,
  prefectureMap,
  trimText,
  emptyDataImage,
}) {
  const ui = GTFS.import.api;
  const common = GTFS.common;
  const dash = UI.gtfs.fallbackDash;
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);

  const openDetails = (row) => {
    setDetailTarget(row);
    setDetailOpen(true);
  };

  return (
    <>
      {/* Filters */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        {/* Prefecture */}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            {ui.filters.prefecture}
          </Typography>
          <Select
            size="small"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            sx={{ minWidth: 180, background: "#fff", borderRadius: 2 }}
            displayEmpty
            MenuProps={{
              PaperProps: {
                sx: {
                  maxHeight: 340,
                  borderRadius: 2,
                  boxShadow: "0px 4px 20px rgba(0,0,0,0.05)",
                  mt: 1,
                },
              },
              MenuListProps: { sx: { py: 1, px: 0.5 } },
            }}>
            <MenuItem
              value={GTFS.import.filters.unselected}
              sx={{ fontSize: 15, minHeight: 36, py: 1 }}>
              {GTFS.import.filters.unselected}
            </MenuItem>
            {Object.entries(prefectureMap).map(([key, label]) => (
              <MenuItem
                value={key}
                key={key}
                sx={{
                  fontSize: 15,
                  minHeight: 36,
                  py: 1.2,
                  px: 2,
                  borderRadius: 1,
                  "&:hover": { background: "#e6f0fa" },
                  "&.Mui-selected": {
                    background: "#e6f0fa !important",
                    color: "#1976d2",
                    fontWeight: 700,
                  },
                }}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Organization */}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            {ui.filters.organization}
          </Typography>
          <Select
            size="small"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            sx={{ minWidth: 200, background: "#fff", borderRadius: 2 }}
            displayEmpty
            MenuProps={{
              PaperProps: {
                sx: {
                  maxHeight: 300,
                  borderRadius: 2,
                  boxShadow: "0px 4px 20px rgba(0,0,0,0.05)",
                  mt: 1,
                },
              },
              MenuListProps: { sx: { py: 1, px: 0.5 } },
            }}>
            <MenuItem
              value={GTFS.import.filters.unselected}
              sx={{ fontSize: 15, minHeight: 36, py: 1 }}>
              {GTFS.import.filters.unselected}
            </MenuItem>
            {uniqueOrganizations.map((name) => (
              <MenuItem
                value={name}
                key={name}
                sx={{
                  fontSize: 15,
                  minHeight: 36,
                  py: 1.2,
                  px: 2,
                  borderRadius: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  "&:hover": { background: "#e6f0fa" },
                  "&.Mui-selected": {
                    background: "#e6f0fa !important",
                    color: "#1976d2",
                    fontWeight: 700,
                  },
                }}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Feed Name Search */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder={ui.filters.feedNamePlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "grey.500" }} />
                </InputAdornment>
              ),
              sx: { borderRadius: 2, width: 200 },
            }}
          />
        </Box>
      </Box>

      {/* Loading & Error */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}

      {/* Data Table */}
      {!loading && !error && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 220 }}>{ui.table.headers.organizationName}</TableCell>
                <TableCell sx={{ width: 120 }}>{ui.table.headers.prefecture}</TableCell>
                <TableCell sx={{ width: 220 }}>{ui.table.headers.gtfsFeedName}</TableCell>
                <TableCell sx={{ width: 180 }}>{ui.table.headers.license}</TableCell>
                <TableCell sx={{ width: 160 }}>{ui.table.headers.latestFeedStartDate}</TableCell>
                <TableCell sx={{ width: 160 }}>{ui.table.headers.latestFeedEndDate}</TableCell>
                <TableCell sx={{ width: 140 }}>{ui.table.headers.lastPublishedAt}</TableCell>
                <TableCell sx={{ width: 120 }}>{ui.table.headers.detail}</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => {
                  const pref =
                    prefectureMap?.[String(row.feed_pref_id)] ??
                    prefectureMap?.[String(row.organization_pref_id)] ??
                    dash;
                  const license = row.feed_license || dash;
                  const licenseUrl = row.feed_license_url;

                  return (
                    <TableRow key={idx}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {row.organization_name ? (
                          <Link
                            href={row.organization_web_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover">
                            {trimText(row.organization_name, 20)}
                          </Link>
                        ) : (
                          trimText(row.organization_name, 20)
                        )}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {pref}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {trimText(row.feed_name, 20)}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: "normal" }}>
                        {licenseUrl ? (
                          <Link
                            href={licenseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover">
                            {license}
                          </Link>
                        ) : (
                          license
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            color: "text.secondary",
                            mt: 0.5,
                            lineHeight: 1.2,
                          }}>
                          {ui.table.licenseSourceTemplate.replace(
                            "{organizationName}",
                            trimText(row.organization_name || dash, 22)
                          )}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {trimText(row.latest_feed_start_date, 10)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {trimText(row.latest_feed_end_date, 10)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {trimText(row.last_published_at || "-", 12)}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: "none" }}
                          onClick={() => openDetails(row)}>
                          {common.actions.detail}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <EmptyState
                      image={emptyDataImage}
                      message={ui.table.emptyMessage}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <GTFSFeedDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        organizationId={detailTarget?.organization_id}
        feedId={detailTarget?.feed_id}
        prefectureMap={prefectureMap}
        contextRow={{
          organization_web_url: detailTarget?.organization_web_url,
          organization_email: detailTarget?.organization_email,
          organization_name: detailTarget?.organization_name,
        }}
      />
    </>
  );
}
