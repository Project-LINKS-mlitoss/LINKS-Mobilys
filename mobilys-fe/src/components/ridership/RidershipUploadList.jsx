// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import dayjs from "dayjs";
import {
	Box,
	Button,
	Pagination,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Tooltip,
	Typography,
	CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { UI } from "../../constant/ui";
import { RIDERSHIP } from "../../strings/domains/ridership";

const formatBytes = (bytes) => {
	if (bytes === null || bytes === undefined) return UI.ridership.fallbackDash;
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	return `${mb.toFixed(1)} MB`;
};

// Match ScenarioTable's icon-only outlined action buttons
const iconOutlinedButtonSx = (theme) => ({
	minWidth: UI.ridership.uploadList.iconButtonMinWidthPx,
	height: UI.ridership.uploadList.iconButtonHeightPx,
	p: "6px",
	borderColor: alpha(theme.palette.primary.main, 0.5),
	"&:hover": {
		borderColor: theme.palette.primary.main,
	},
});

const formatSuccessRate = (successRows, totalRows) => {
	const ok = Number(successRows ?? 0);
	const total = Number(totalRows ?? 0);
	if (!Number.isFinite(total) || total <= 0) return UI.ridership.fallbackDash;
	if (ok >= total) return "100%";
	const pct = (ok / total) * 100;
	return `${pct.toFixed(1)}%`;
};

export default function RidershipUploadList({
	uploads = [],
	pagination = null,
	loading = false,
	searchText = "",
	onSearchTextChange,
	onPageChange,
	onOpenUpload,
	onOpenDetail,
	onDelete,
	onExportUpload,
	exporting = false,
}) {
	const ui = RIDERSHIP.oneDetailed.uploadList;
	const dash = UI.ridership.fallbackDash;
	const normalized = Array.isArray(uploads) ? uploads : [];
	const filtered = normalized.filter((u) => {
		if (!searchText.trim()) return true;
		const q = searchText.trim().toLowerCase();
		return (
			String(u?.ridership_record_name || "").toLowerCase().includes(q) ||
			String(u?.file_name || "").toLowerCase().includes(q)
		);
	});

	const page = pagination?.page ?? 1;
	const totalPages = pagination?.total_pages ?? 1;

	return (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
			<Stack
				direction={{ xs: "column", md: "row" }}
				spacing={2}
				alignItems={{ xs: "stretch", md: "center" }}
				justifyContent="space-between"
				sx={{ mb: 2 }}
			>
				<Typography variant="h6" sx={{ fontWeight: 700 }}>
					{ui.title}
				</Typography>

				<Button variant="contained" onClick={onOpenUpload}>
					{ui.actions.newUpload}
				</Button>
			</Stack>

			<Stack
				direction={{ xs: "column", md: "row" }}
				spacing={2}
				alignItems={{ xs: "stretch", md: "center" }}
				sx={{ mb: 2 }}
			>
				<TextField
					label={ui.search.label}
					value={searchText}
					onChange={(e) => onSearchTextChange?.(e.target.value)}
					placeholder={ui.search.placeholder}
					fullWidth
				/>
			</Stack>

			<Paper variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
				<TableContainer sx={{ height: "100%", overflow: "auto" }}>
					<Table stickyHeader size="small" sx={{ minWidth: UI.ridership.uploadList.tableMinWidthPx }}>
						<TableHead>
							<TableRow>
								<TableCell>{ui.table.headers.recordName}</TableCell>
								<TableCell>{ui.table.headers.fileName}</TableCell>
								<TableCell align="right">{ui.table.headers.successRate}</TableCell>
								<TableCell align="right">{ui.table.headers.successTotal}</TableCell>
								<TableCell align="right">{ui.table.headers.errorCount}</TableCell>
								<TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
									{ui.table.headers.uploadedAt}
								</TableCell>
								<TableCell
									align="right"
									sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}
								>
									{ui.table.headers.toleranceMinutes}
								</TableCell>
								<TableCell align="right">{ui.table.headers.actions}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{loading && (
								<TableRow>
									<TableCell colSpan={8}>
										<Typography variant="body2" color="text.secondary">
											{ui.table.loading}
										</Typography>
									</TableCell>
								</TableRow>
							)}

							{!loading && filtered.length === 0 && (
								<TableRow>
									<TableCell colSpan={8}>
										<Typography variant="body2" color="text.secondary">
											{ui.table.empty}
										</Typography>
									</TableCell>
								</TableRow>
							)}

							{filtered.map((u) => (
								<TableRow
									key={u?.id}
									hover
									sx={{ cursor: "default" }}
								>
									<TableCell sx={{ fontWeight: 700 }}>
										{u?.ridership_record_name || dash}
									</TableCell>
									<TableCell>
										<Typography>
											{u?.file_name || dash}
										</Typography>
										<Typography variant="body2" color="text.secondary">
											{formatBytes(u?.file_size)}
										</Typography>
									</TableCell>
									<TableCell align="right">
										{formatSuccessRate(u?.success_rows, u?.total_rows)}
									</TableCell>
									<TableCell align="right">
										{u?.success_rows ?? 0}/{u?.total_rows ?? 0}
									</TableCell>
									<TableCell align="right">{u?.error_count ?? 0}</TableCell>
									<TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
										{u?.uploaded_at
											? dayjs(u.uploaded_at).format("YYYY-MM-DD HH:mm")
											: dash}
									</TableCell>
									<TableCell
										align="right"
										sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}
									>
										{Number.isFinite(Number(u?.max_tolerance_time))
											? ui.format.minutesTemplate.replace(
												"{minutes}",
												String(Number(u.max_tolerance_time))
											)
											: dash}
									</TableCell>
									<TableCell align="right">
										<Box
											sx={{
												display: "flex",
												gap: 1,
												flexWrap: "wrap",
												justifyContent: "flex-end",
												alignItems: "center",
											}}
										>
												<Button
													variant="outlined"
													color="primary"
													onClick={() => onOpenDetail?.(u)}
													sx={{ height: UI.ridership.uploadList.actionButtonHeightPx }}
												>
													{ui.actions.detail}
												</Button>
												<Tooltip title={ui.tooltips.csvFormat}>
													<Button
														aria-label={ui.aria.csvFormat}
														variant="outlined"
														color="primary"
														disabled={exporting || !u?.id}
														onClick={() => onExportUpload?.(u, "csv")}
														sx={iconOutlinedButtonSx}
												>
													{exporting ? (
														<CircularProgress size={18} />
													) : (
														<span className="material-symbols-outlined outlined">
															csv
														</span>
													)}
													</Button>
												</Tooltip>

												<Tooltip title={ui.tooltips.delete}>
													<Button
														aria-label={ui.aria.delete}
														variant="outlined"
														color="primary"
														onClick={() => onDelete?.(u)}
														sx={iconOutlinedButtonSx}
													>
													<span className="material-symbols-outlined outlined">
														delete
													</span>
												</Button>
											</Tooltip>
										</Box>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			</Paper>

			{totalPages > 1 && (
				<Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
					<Pagination
						page={page}
						count={totalPages}
						onChange={(_, p) => onPageChange?.(p)}
					/>
				</Box>
			)}
		</Box>
	);
}
