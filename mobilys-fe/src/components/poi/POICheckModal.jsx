// src/components/poi/POICheckModal.jsx
import { useMemo } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Box,
	Paper,
	Typography,
	Button,
	Chip,
	Stack,
	TextField,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	Tooltip,
	Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import { LABELS, BUTTONS } from "../../strings";

/* Helper: ellipsis + tooltip */
function Ellipsis({ title, className, children }) {
	const text = typeof children === "string" ? children : title;
	return (
		<Tooltip title={text ?? ""} disableInteractive>
			<Box
				className={className}
				sx={{
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}>
				{children ?? "—"}
			</Box>
		</Tooltip>
	);
}

/**
 * Props:
 * - open, onClose
 * - checkData: { total_files, total_valid_rows, batches:[{...}], checked_at }
 * - remarksByFile: { [fileName]: string }
 * - onChangeRemark(file, value)
 * - onCommit()   // langsung POST
 * - committing: boolean
 */
export default function POICheckModal({
	open,
	onClose,
	checkData,
	remarksByFile,
	onChangeRemark,
	onCommit,
	committing = false,
}) {
	const batches = checkData?.batches || [];
	const canCommitAll = useMemo(
		() => batches.length > 0 && batches.every((b) => b.can_commit === true),
		[batches]
	);

	const REMARK_MAX = 300;

	return (
		<Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
			<DialogTitle>{LABELS.poi.checkResult}</DialogTitle>

			<DialogContent dividers sx={{ pt: 1.25 }}>
				<Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
					{LABELS.poi.totalFiles}: {checkData?.total_files ?? 0} ／ {LABELS.poi.totalValidRows}:{" "}
					{checkData?.total_valid_rows ?? 0} ／ {LABELS.poi.checkDateTime}:{" "}
					{checkData?.checked_at
						? new Date(checkData.checked_at).toLocaleString()
						: "—"}
				</Typography>

				{batches.map((b, idx) => {
					const invalidCount = b?.invalid_rows?.length || 0;
					const dupeInFile = b?.stats?.duplicate_in_file ?? 0;
					const dupeInDb = b?.stats?.duplicate_in_db ?? 0;
					const hasWarn =
						invalidCount > 0 ||
						b?.file_name_taken ||
						dupeInFile > 0 ||
						dupeInDb > 0;

					const remark = remarksByFile?.[b.file] ?? "";
					const remarkChars = remark.length;

					/* shared table sx: fixed layout + widths + uniform row height */
					const tableSx = {
						tableLayout: "fixed",
						"& .MuiTableCell-root": { py: 1.25, verticalAlign: "middle" },
						"& th, & td": { whiteSpace: "nowrap" },
						"& .col-idx": { width: 56, textAlign: "right" },
						"& .col-type": { width: 84 },
						"& .col-lat, & .col-lng": { width: 110 },
						"& .col-name": { width: "38%" },
						"& .col-remark": { width: "38%" },
					};

					return (
						<Paper
							key={`${b.file}-${idx}`}
							variant='outlined'
							sx={{ mb: 2, p: 1.5, borderRadius: 2 }}>
							{/* Header (sesuai guideline) */}
							<Stack
								direction='row'
								alignItems='center'
								justifyContent='space-between'>
								<Typography
									fontWeight={700}
									sx={{ mr: 2, wordBreak: "break-all" }}>
									{b.file}
								</Typography>
								<Stack direction='row' spacing={1} alignItems='center'>
									{b.can_commit ? (
										<Chip
											size='small'
											color='primary'
											label={LABELS.poi.valid}
											icon={<TaskAltIcon sx={{ fontSize: 16 }} />}
										/>
									) : (
										<Chip
											size='small'
											color='error'
											label={LABELS.poi.invalid}
											icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
										/>
									)}
									{b.file_name_taken && (
										<Tooltip title={LABELS.poi.duplicateFileHint}>
											<Chip
												size='small'
												color='primary'
												variant='outlined'
												label={LABELS.poi.duplicateFileName}
											/>
										</Tooltip>
									)}
								</Stack>
							</Stack>

							<Box sx={{ mt: 1 }}>
								{/* Remarks (multiline + counter + icon) */}
								<TextField
									label={LABELS.poi.fileRemarks}
									placeholder={LABELS.poi.remarkExample}
									size='small'
									fullWidth
									multiline
									minRows={2}
									maxRows={4}
									value={remark}
									onChange={(e) => {
										const v = e.target.value.slice(0, REMARK_MAX);
										onChangeRemark?.(b.file, v);
									}}
									InputProps={{
										startAdornment: (
											<NotesOutlinedIcon
												sx={{ mr: 1, color: "text.secondary" }}
											/>
										),
									}}
								/>

								{/* Invalid rows — all shown with trimmed cells */}
								<Accordion
									sx={{
										mt: 1,
										...(invalidCount > 0 && {
											borderLeft: "4px solid",
											borderColor: "error.main",
											bgcolor: "rgba(255,193,7,0.06)",
										}),
									}}
									defaultExpanded={invalidCount > 0}>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Stack direction='row' alignItems='center' spacing={1.25}>
											<WarningAmberIcon
												fontSize='small'
												sx={{
													color:
														invalidCount > 0 ? "error.main" : "text.disabled",
												}}
											/>
											<Typography
												variant='subtitle2'
												sx={{
													color:
														invalidCount > 0 ? "error.main" : "text.secondary",
													fontWeight: invalidCount > 0 ? 700 : 500,
												}}>
												{LABELS.poi.invalidRows(invalidCount ?? 0)}
											</Typography>
										</Stack>
									</AccordionSummary>

									<AccordionDetails sx={{ pt: 0.5 }}>
										{invalidCount === 0 ? (
											<Typography variant='body2' color='text.secondary'>
												{LABELS.poi.none}
											</Typography>
										) : (
											<Table size='small' sx={tableSx}>
												<TableHead>
													<TableRow>
														<TableCell className='col-idx'>{LABELS.poi.rowNumber}</TableCell>
														<TableCell className='col-type'>{LABELS.poi.type}</TableCell>
														<TableCell className='col-name'>{LABELS.poi.name}</TableCell>
														<TableCell className='col-lat'>{LABELS.poi.latitude}</TableCell>
														<TableCell className='col-lng'>{LABELS.poi.longitude}</TableCell>
														<TableCell className='col-remark'>{LABELS.poi.reason}</TableCell>
													</TableRow>
												</TableHead>
												<TableBody>
													{b.invalid_rows.map((r, i) => (
														<TableRow key={`${b.file}-inv-${i}`}>
															<TableCell className='col-idx'>
																{r.row_number}
															</TableCell>
															<TableCell className='col-type'>
																<Ellipsis>{r.type}</Ellipsis>
															</TableCell>
															<TableCell className='col-name'>
																<Ellipsis>{r.name}</Ellipsis>
															</TableCell>
															<TableCell className='col-lat'>
																<Ellipsis>{r.lat}</Ellipsis>
															</TableCell>
															<TableCell className='col-lng'>
																<Ellipsis>{r.lng}</Ellipsis>
															</TableCell>
															<TableCell className='col-remark'>
																<Ellipsis>{r.reason}</Ellipsis>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										)}
									</AccordionDetails>
								</Accordion>

								{/* Valid rows — all shown with trimmed cells */}
								<Accordion sx={{ mt: 1 }} defaultExpanded>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Typography variant='subtitle2'>
											{LABELS.poi.validRows(b.valid_rows?.length ?? 0)}
										</Typography>
									</AccordionSummary>
									<AccordionDetails sx={{ pt: 0.5 }}>
										{!b.valid_rows || b.valid_rows.length === 0 ? (
											<Typography variant='body2' color='text.secondary'>
												{LABELS.poi.none}
											</Typography>
										) : (
											<Table size='small' sx={tableSx}>
												<TableHead>
													<TableRow>
														<TableCell className='col-idx'>{LABELS.poi.rowNumber}</TableCell>
														<TableCell className='col-type'>{LABELS.poi.type}</TableCell>
														<TableCell className='col-name'>{LABELS.poi.name}</TableCell>
														<TableCell className='col-lat'>{LABELS.poi.latitude}</TableCell>
														<TableCell className='col-lng'>{LABELS.poi.longitude}</TableCell>
														<TableCell className='col-remark'>{LABELS.poi.remarks}</TableCell>
													</TableRow>
												</TableHead>
												<TableBody>
													{b.valid_rows.map((v, i) => (
														<TableRow key={`${b.file}-val-${i}`}>
															<TableCell className='col-idx'>
																{v.row_number}
															</TableCell>
															<TableCell className='col-type'>
																<Ellipsis>{v.row?.[LABELS.poi.type]}</Ellipsis>
															</TableCell>
															<TableCell className='col-name'>
																<Ellipsis>{v.row?.[LABELS.poi.name]}</Ellipsis>
															</TableCell>
															<TableCell className='col-lat'>
																<Ellipsis>{v.row?.[LABELS.poi.latitude]}</Ellipsis>
															</TableCell>
															<TableCell className='col-lng'>
																<Ellipsis>{v.row?.[LABELS.poi.longitude]}</Ellipsis>
															</TableCell>
															<TableCell className='col-remark'>
																<Ellipsis>{v.row?.[LABELS.poi.remarks] ?? "—"}</Ellipsis>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										)}
									</AccordionDetails>
								</Accordion>
							</Box>

							{idx < batches.length - 1 && <Divider sx={{ mt: 2 }} />}
						</Paper>
					);
				})}
			</DialogContent>

			<DialogActions>
				<Button onClick={onClose} disabled={committing}>
					{BUTTONS.common.cancel}
				</Button>
				<Button
					variant='contained'
					onClick={onCommit}
				// disabled={!canCommitAll || committing}
				>
					{BUTTONS.common.import}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
