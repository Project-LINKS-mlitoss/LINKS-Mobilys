import dayjs from "dayjs";
import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Alert,
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Pagination,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import StatusBadge from "./StatusBadge";
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

const formatRawValue = (value) => {
	if (value === null || value === undefined) return UI.ridership.fallbackDash;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
};

const RawDataTable = ({ data }) => {
	const ui = RIDERSHIP.oneDetailed.uploadDetail;
	const obj = data && typeof data === "object" && !Array.isArray(data) ? data : null;
	const keys = obj ? Object.keys(obj).sort() : [];

	if (!obj || keys.length === 0) {
		return (
			<Typography variant="body2" color="text.secondary">
				{ui.rawDataTable.empty}
			</Typography>
		);
	}

	return (
		<TableContainer
			component={Paper}
			variant="outlined"
			sx={{ maxHeight: UI.ridership.uploadDetail.rawTableMaxHeightPx, bgcolor: "background.paper" }}
		>
			<Table stickyHeader size="small">
				<TableHead>
					<TableRow>
						<TableCell sx={{ width: UI.ridership.uploadDetail.rawKeyColWidthPx, fontWeight: 700 }}>
							{ui.rawDataTable.headers.key}
						</TableCell>
						<TableCell sx={{ fontWeight: 700 }}>{ui.rawDataTable.headers.value}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{keys.map((k) => (
						<TableRow key={k} hover>
							<TableCell sx={{ fontFamily: "monospace" }}>{k}</TableCell>
							<TableCell sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
								{formatRawValue(obj[k])}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
};

export default function RidershipUploadDetailDialog({
	open,
	onClose,
	detail = null,
	loading = false,
	error = "",
	errorGroupPages = {},
	onErrorGroupPageChange,
}) {
	const ui = RIDERSHIP.oneDetailed.uploadDetail;
	const errorSummary = Array.isArray(detail?.error_summary) ? detail.error_summary : [];
	const legacyErrors = Array.isArray(detail?.errors) ? detail.errors : [];
	const totalErrorCount =
		detail?.total_error_count ?? detail?.error_count ?? legacyErrors.length ?? 0;
	const errorGroupCount = detail?.error_group_count ?? detail?.error_type_count ?? errorSummary.length ?? 0;
	const groupPart = errorGroupCount
		? ui.errors.groupPartTemplate.replace("{groups}", String(errorGroupCount))
		: "";
	const errorsTitle = ui.errors.titleTemplate
		.replace("{total}", String(totalErrorCount ?? 0))
		.replace("{groupPart}", groupPart);
	const dash = UI.ridership.fallbackDash;

	const formatAffectedRows = (summary) => {
		const rows = Array.isArray(summary?.affected_rows) ? summary.affected_rows : [];
		if (rows.length === 0) return dash;
		const preview = rows.slice(0, UI.ridership.uploadDetail.affectedRowsPreviewLimit).join(", ");
		const extra =
			summary?.affected_rows_truncated || rows.length < (summary?.total_count || 0)
				? Math.max(Number(summary?.total_count || 0) - rows.length, 0)
				: 0;
		return extra > 0 ? `${preview}, ... (+${extra})` : preview;
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
			<DialogTitle sx={{ pr: 2 }}>
				<Stack direction="row" alignItems="center" justifyContent="space-between">
					<Typography variant="h6" sx={{ fontWeight: 700 }}>
						{detail?.ridership_record_name || ui.titleFallback}
					</Typography>
					{detail?.upload_status && <StatusBadge status={detail.upload_status} />}
				</Stack>
			</DialogTitle>
			<DialogContent>
				{error && <Alert severity="error">{error}</Alert>}

				{loading && (
					<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
						{ui.loading}
					</Typography>
				)}

				{!!detail && (
					<Box sx={{ mt: 1 }}>
						<Stack
							direction={{ xs: "column", md: "row" }}
							spacing={1}
							justifyContent="space-between"
						>
							<Typography variant="body2" color="text.secondary">
								{ui.meta.fileNameLabel} {detail?.file_name || dash}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{ui.meta.sizeLabel} {formatBytes(detail?.file_size)}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{ui.meta.validationModeLabel} {detail?.validation_mode || dash}
							</Typography>
						</Stack>

						<Stack
							direction={{ xs: "column", md: "row" }}
							spacing={1}
							justifyContent="space-between"
							sx={{ mt: 1 }}
						>
							<Typography variant="body2" color="text.secondary">
								{ui.meta.uploadedAtLabel}{" "}
								{detail?.uploaded_at
									? dayjs(detail.uploaded_at).format("YYYY-MM-DD HH:mm:ss")
									: dash}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{ui.meta.processedAtLabel}{" "}
								{detail?.processed_at
									? dayjs(detail.processed_at).format("YYYY-MM-DD HH:mm:ss")
									: dash}
							</Typography>
						</Stack>

						<Divider sx={{ my: 2 }} />

						<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
							<Box
								sx={{
									flex: 1,
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 2,
									p: 2,
								}}
							>
								<Typography variant="body2" color="text.secondary">
									{ui.summary.totalRows}
								</Typography>
								<Typography variant="h5" sx={{ fontWeight: 700 }}>
									{detail?.total_rows ?? 0}
								</Typography>
							</Box>
							<Box
								sx={{
									flex: 1,
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 2,
									p: 2,
								}}
							>
								<Typography variant="body2" color="text.secondary">
									{ui.summary.success}
								</Typography>
								<Typography variant="h5" sx={{ fontWeight: 700 }}>
									{detail?.success_rows ?? 0}
								</Typography>
							</Box>
							<Box
								sx={{
									flex: 1,
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 2,
									p: 2,
								}}
							>
								<Typography variant="body2" color="text.secondary">
									{ui.summary.error}
								</Typography>
								<Typography variant="h5" sx={{ fontWeight: 700 }}>
									{totalErrorCount ?? 0}
								</Typography>
							</Box>
						</Stack>

						<Divider sx={{ my: 2 }} />

						<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
							{errorsTitle}
						</Typography>

						{totalErrorCount === 0 && (
							<Typography variant="body2" color="text.secondary">
								{ui.errors.none}
							</Typography>
						)}

						{errorSummary.length > 0 && (
							<Stack spacing={1}>
								{errorSummary.map((summary) => {
									const groupKey =
										summary?.group_key ||
										(summary?.field_name
											? `${summary?.error_type || "unknown"}:${summary.field_name}`
											: summary?.error_type || "unknown");
									const pagination = summary?.details_pagination || null;
									const currentPage =
										errorGroupPages?.[groupKey] ?? pagination?.page ?? 1;
									const totalPages = pagination?.total_pages ?? 1;
									const label =
										summary?.error_type_display || summary?.error_type || dash;
									const fieldLabel =
										summary?.field_display_name || summary?.field_name || dash;
									const details = Array.isArray(summary?.details) ? summary.details : [];
									const groupTitle = ui.errors.groupTitleTemplate
										.replace("{label}", label)
										.replace("{field}", fieldLabel)
										.replace("{count}", String(summary?.total_count ?? 0));

									return (
										<Accordion key={groupKey} disableGutters>
											<AccordionSummary expandIcon={<ExpandMoreIcon />}>
												<Stack spacing={0.25} sx={{ width: "100%" }}>
													<Typography sx={{ fontWeight: 700 }}>
														{groupTitle}
													</Typography>
													{summary?.error_type && (
														<Typography variant="body2" color="text.secondary">
															{summary?.field_name
																? `${summary.error_type} / ${summary.field_name}`
																: summary.error_type}
														</Typography>
													)}
												</Stack>
											</AccordionSummary>
											<AccordionDetails>
												<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
													{ui.errors.affectedRowsLabel} {formatAffectedRows(summary)}
												</Typography>

												{summary?.sample_message && (
													<Box
														sx={{
															mb: 1,
															p: 1.25,
															borderRadius: 1,
															bgcolor: "grey.100",
														}}
													>
														<Typography variant="body2" color="text.secondary">
															<strong>Sample:</strong> {summary.sample_message}
														</Typography>
													</Box>
												)}

												{details.length === 0 ? (
													<Typography variant="body2" color="text.secondary">
														{ui.errors.noDetails}
													</Typography>
												) : (
													<Stack spacing={1}>
														{details.map((d) => (
															<Accordion
																key={d?.id || `${groupKey}-${d?.source_row_number}`}
															>
																<AccordionSummary expandIcon={<ExpandMoreIcon />}>
																	<Stack spacing={0.5} sx={{ width: "100%" }}>
																		<Typography sx={{ fontWeight: 700 }}>
																			{ui.errors.rowLabelTemplate.replace(
																				"{row}",
																				String(d?.source_row_number ?? dash)
																			)}
																		</Typography>
																		<Typography variant="body2" color="text.secondary">
																			{d?.error_message || dash}
																		</Typography>
																	</Stack>
																</AccordionSummary>
																<AccordionDetails>
																	<Typography
																		variant="body2"
																		color="text.secondary"
																		sx={{ mb: 1 }}
																	>
																		{ui.errors.rawDataTitle}
																	</Typography>
																	<RawDataTable data={d?.raw_data} />
																</AccordionDetails>
															</Accordion>
														))}
													</Stack>
												)}

												{totalPages > 1 && (
													<Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
														<Pagination
															page={currentPage}
															count={totalPages}
															onChange={(_, p) =>
																onErrorGroupPageChange?.({
																	groupKey,
																	errorType: summary?.error_type,
																	fieldName: summary?.field_name,
																	page: p,
																})
															}
														/>
													</Box>
												)}
											</AccordionDetails>
										</Accordion>
									);
								})}
							</Stack>
						)}

						{errorSummary.length === 0 && legacyErrors.length > 0 && (
							<Stack spacing={1}>
								{legacyErrors.map((e) => (
									<Accordion key={e?.id || `${e?.source_row_number}`}>
										<AccordionSummary expandIcon={<ExpandMoreIcon />}>
											<Stack spacing={0.5} sx={{ width: "100%" }}>
												<Typography sx={{ fontWeight: 700 }}>
													{ui.errors.rowLabelTemplate.replace(
														"{row}",
														String(e?.source_row_number ?? dash)
													)}{" "}
													| {e?.error_type || dash} | {e?.field_name || dash}
												</Typography>
												<Typography variant="body2" color="text.secondary">
													{e?.error_message || dash}
												</Typography>
											</Stack>
										</AccordionSummary>
										<AccordionDetails>
											<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
												{ui.errors.rawDataTitle}
											</Typography>
											<RawDataTable data={e?.raw_data} />
										</AccordionDetails>
									</Accordion>
								))}
							</Stack>
						)}
					</Box>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose}>{ui.actions.close}</Button>
			</DialogActions>
		</Dialog>
	);
}
