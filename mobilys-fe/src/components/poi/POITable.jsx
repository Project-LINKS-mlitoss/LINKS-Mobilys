// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/poi/POITable.jsx
import { useMemo, useState, Fragment, useEffect } from "react";
import {
	Paper,
	Typography,
	TableContainer,
	Table,
	TableHead,
	TableRow,
	TableCell,
	TableBody,
	Box,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Button,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Divider,
	Stack,
	Tooltip,
	DialogContentText,
	Radio,
	IconButton,
	FormHelperText,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { LABELS, BUTTONS } from "../../strings";
import { MESSAGES } from "../../constant";

const DEFAULT_BATCH_ID = "default"; // sentinel for the built-in dataset
const DEFAULT_PREF_VALUE = "__default__"; // select value for scenario default

export function PoiTable({
	groups = [],
	total = 0,
	type = LABELS.common.all,
	onChangeType,
	typeList,
	batch = LABELS.common.all,
	onChangeBatch,
	onDeleteBatch,
	inlineMaxHeight = 500,
	activeBatchId = DEFAULT_BATCH_ID,
	onSetActiveBatch,
	prefectureOptions = [],
	selectedPrefecture = null,
	prefectureIsDefault = true,
	prefectureLoading = false,
	prefectureError = null,
	onChangeDefaultPrefecture,
}) {
	const [confirm, setConfirm] = useState({ open: false, id: null, label: "" });
	const [collapsedBatches, setCollapsedBatches] = useState(() => new Set());

	// Normalize prefecture options:
	// Backend now returns: [{ key: "Ishikawa", label: "石川県" }, ...]
	// But some env may still return: ["石川県", "東京都", ...]
	// We'll normalize both into [{ key, label }]
	const normalizedPrefectureOptions = useMemo(() => {
		if (!Array.isArray(prefectureOptions)) return [];

		return prefectureOptions
			.map((p) => {
				if (typeof p === "string") {
					// Legacy: only label available; use label as key too
					return { key: p, label: p };
				}
				if (p && typeof p === "object") {
					const key = String(p.key ?? p.value ?? "").trim();
					const label = String(p.label ?? p.name ?? p.key ?? "").trim();
					if (!key && !label) return null;
					return { key: key || label, label: label || key };
				}
				return null;
			})
			.filter(Boolean);
	}, [prefectureOptions]);

	// Build type list if not provided
	const computedTypeList = useMemo(() => {
		if (typeList?.length) return typeList;
		const set = new Set();
		groups.forEach((g) => g.items.forEach((it) => set.add(it.type)));
		return Array.from(set);
	}, [groups, typeList]);

	// Batch list from groups
	const computedBatchList = useMemo(() => {
		return groups.map((g) => ({ id: g.batch_id, label: g.file_name }));
	}, [groups]);

	// Collapse all batches by default when list changes and no state yet
	useEffect(() => {
		setCollapsedBatches((prev) => {
			if (prev.size > 0) return prev;
			return new Set(computedBatchList.map((b) => String(b.id)));
		});
	}, [computedBatchList]);

	// Apply filters
	const filteredGroups = useMemo(() => {
		const byBatch =
			batch === LABELS.common.all
				? groups
				: groups.filter((g) => String(g.batch_id) === String(batch));
		return byBatch
			.map((g) => {
				const items =
					type === LABELS.common.all ? g.items : g.items.filter((it) => it.type === type);
				return { ...g, items, count: items.length };
			})
			.filter((g) => g.items.length > 0);
	}, [groups, batch, type]);

	// Table styles: fixed width columns + ellipsis
	const tableSx = {
		tableLayout: "fixed",
		"& .MuiTableCell-root": { py: 1.25, verticalAlign: "middle" },
		"& th, & td": { whiteSpace: "nowrap" },
		"& .col-radio": { width: 64 },
		"& .col-type": { width: 120 },
		"& .col-name": { width: "40%" },
		"& .col-lat, & .col-lng": { width: 140 },
		"& .col-note": { width: 260 },
	};

	const Ellipsis = ({ children }) => (
		<Tooltip title={children ?? ""} disableInteractive>
			<Box
				sx={{
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}>
				{children ?? "-"}
			</Box>
		</Tooltip>
	);

	const HeaderFilters = ({ compact = false }) => (
		<Stack direction='row' spacing={1} sx={{ minWidth: 280 }}>
			<FormControl size='small' sx={{ minWidth: compact ? 110 : 140 }}>
				<InputLabel>{LABELS.poi.facilityType}</InputLabel>
				<Select
					value={type}
					label={LABELS.poi.facilityType}
					onChange={(e) => onChangeType?.(e.target.value)}>
					<MenuItem value={LABELS.common.all}>{LABELS.common.all}</MenuItem>
					{computedTypeList.map((t) => (
						<MenuItem key={t} value={t}>
							{t}
						</MenuItem>
					))}
				</Select>
			</FormControl>

			<FormControl size='small' sx={{ minWidth: compact ? 140 : 180 }}>
				<InputLabel>{LABELS.poi.csvFile}</InputLabel>
				<Select
					value={batch}
					label={LABELS.poi.csvFile}
					onChange={(e) => onChangeBatch?.(e.target.value)}>
					<MenuItem value={LABELS.common.all}>{LABELS.common.all}</MenuItem>
					{computedBatchList.map((b) => (
						<MenuItem key={String(b.id)} value={String(b.id)}>
							{b.label}
						</MenuItem>
					))}
				</Select>
			</FormControl>
		</Stack>
	);

	const TableContent = ({ height }) => {
		const fill = height === "fill";
		const containerSx = fill
			? { flex: 1, minHeight: 0, overflow: "auto" }
			: { maxHeight: height, overflowY: "auto" };
		const isActive = (id) => String(activeBatchId) === String(id);
		const handleSelect = (id) => onSetActiveBatch?.(id);
		const isCollapsed = (id) => collapsedBatches.has(String(id));
		const toggleCollapsed = (id) =>
			setCollapsedBatches((prev) => {
				const next = new Set(prev);
				const key = String(id);
				if (next.has(key)) next.delete(key);
				else next.add(key);
				return next;
			});

		const prefectureSelectValue =
			prefectureIsDefault || !selectedPrefecture
				? DEFAULT_PREF_VALUE
				: String(selectedPrefecture);

		return (
			<TableContainer sx={containerSx}>
				<Table size='small' stickyHeader sx={tableSx}>
					<TableHead>
						<TableRow>
							<TableCell className='col-radio' />
							<TableCell className='col-type'>{LABELS.poi.facilityType}</TableCell>
							<TableCell className='col-name'>{LABELS.poi.facilityName}</TableCell>
							<TableCell className='col-lat'>{LABELS.poi.latitude}</TableCell>
							<TableCell className='col-lng'>{LABELS.poi.longitude}</TableCell>
							<TableCell className='col-note'>{LABELS.poi.remarks}</TableCell>
						</TableRow>
					</TableHead>

					<TableBody>
						<TableRow>
							<TableCell className='col-radio'>
								<Radio
									size='small'
									checked={isActive(DEFAULT_BATCH_ID)}
									onChange={() => handleSelect(DEFAULT_BATCH_ID)}
								/>
							</TableCell>
							<TableCell colSpan={5}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 2,
										flexWrap: "wrap",
									}}>
									<Typography variant='subtitle2'>
										{LABELS.poi.defaultData}
									</Typography>

									<FormControl
										size='small'
										sx={{ minWidth: 220 }}
										disabled={!isActive(DEFAULT_BATCH_ID) || prefectureLoading}
										error={Boolean(prefectureError)}>
										<InputLabel id='default-prefecture-select-label'>
											{LABELS.poi.targetPrefecture}
										</InputLabel>

										<Select
											labelId='default-prefecture-select-label'
											label={LABELS.poi.targetPrefecture}
											value={prefectureSelectValue}
											onChange={(e) => {
												const v = e.target.value;
												onChangeDefaultPrefecture?.(
													v === DEFAULT_PREF_VALUE ? "default" : v
												);
											}}
											displayEmpty>
											<MenuItem value={DEFAULT_PREF_VALUE}>
												{LABELS.poi.scenarioStandard}
											</MenuItem>

											{normalizedPrefectureOptions.map((p) => (
												<MenuItem key={p.key} value={p.key}>
													{p.label}
												</MenuItem>
											))}
										</Select>

										<FormHelperText>
											{prefectureError ||
												(isActive(DEFAULT_BATCH_ID)
													? LABELS.poi.prefectureHint
													: LABELS.poi.prefectureInactiveHint)}
										</FormHelperText>
									</FormControl>
								</Box>
							</TableCell>
						</TableRow>

						{filteredGroups.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} align='center'>
									{MESSAGES.common.noData}
								</TableCell>
							</TableRow>
						) : (
							filteredGroups.map((gr, gi) => (
								<Fragment key={String(gr.batch_id)}>
									{/* Batch header row */}
									<TableRow>
										<TableCell className='col-radio'>
											<Radio
												size='small'
												checked={isActive(gr.batch_id)}
												onChange={() => handleSelect(gr.batch_id)}
											/>
										</TableCell>
										<TableCell colSpan={5} sx={{ bgcolor: "grey.50", py: 0.75 }}>
											<Box
												sx={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													gap: 1,
												}}>
												<Box sx={{ minWidth: 0 }}>
													<Typography variant='subtitle2' sx={{ mb: 0.25 }}>
														{gr.file_name}（{gr.count ?? 0} 件）
													</Typography>

													<Typography
														variant='caption'
														color='text.secondary'
														sx={{ display: "block", whiteSpace: "nowrap" }}>
														{LABELS.poi.createdAt}{" "}
														{gr.created_at
															? new Date(gr.created_at).toLocaleString()
															: "ー"}
													</Typography>

													{gr.remark ? (
														<Tooltip title={gr.remark} disableInteractive>
															<Typography
																variant='caption'
																color='text.secondary'
																sx={{
																	display: "block",
																	maxWidth: 560,
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																	whiteSpace: "nowrap",
																}}>
																{LABELS.poi.remarks} {gr.remark}
															</Typography>
														</Tooltip>
													) : null}
												</Box>

												<Stack
													direction='row'
													spacing={1}
													alignItems='center'
													sx={{ flexShrink: 0 }}>
													<Tooltip
														title={isCollapsed(gr.batch_id) ? LABELS.poi.expand : LABELS.poi.collapse}>
														<IconButton
															size='small'
															onClick={() => toggleCollapsed(gr.batch_id)}
															aria-label={
																isCollapsed(gr.batch_id) ? LABELS.poi.expand : LABELS.poi.collapse
															}>
															{isCollapsed(gr.batch_id) ? (
																<ExpandMoreIcon fontSize='small' />
															) : (
																<ExpandLessIcon fontSize='small' />
															)}
														</IconButton>
													</Tooltip>

													{onDeleteBatch && (
														<Button
															size='small'
															color='primary'
															variant='outlined'
															onClick={() =>
																setConfirm({
																	open: true,
																	id: gr.batch_id,
																	label: gr.file_name,
																})
															}>
															{BUTTONS.common.delete}
														</Button>
													)}
												</Stack>
											</Box>
										</TableCell>
									</TableRow>

									{/* Rows */}
									{!isCollapsed(gr.batch_id) &&
										gr.items.map((row) => (
											<TableRow key={row.id}>
												<TableCell className='col-radio' />
												<TableCell className='col-type'>
													<Ellipsis>{row.type}</Ellipsis>
												</TableCell>
												<TableCell className='col-name'>
													<Ellipsis>{row.name}</Ellipsis>
												</TableCell>
												<TableCell className='col-lat'>
													<Ellipsis>{row.lat}</Ellipsis>
												</TableCell>
												<TableCell className='col-lng'>
													<Ellipsis>{row.lng}</Ellipsis>
												</TableCell>
												<TableCell className='col-note'>
													<Ellipsis>{row.remark}</Ellipsis>
												</TableCell>
											</TableRow>
										))}

								</Fragment>
							))
						)}
					</TableBody>
				</Table>
			</TableContainer>
		);
	};

	return (
		<>
			{/* Inline (embedded) */}
			<Paper
				sx={{
					p: 2,
					flex: 1,
					display: "flex",
					flexDirection: "column",
					minHeight: 0,
					overflow: "hidden",
				}}>
				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						mb: 2,
						gap: 1,
					}}>
					<Box>
						<Typography variant='h6'>{LABELS.poi.dataList}</Typography>
						{total ? (
							<Typography variant='caption' color='text.secondary'>
								{LABELS.poi.totalCount(total)}
							</Typography>
						) : null}
					</Box>

					<Stack direction='row' spacing={1} alignItems='center' sx={{ flexShrink: 0 }}>
						<HeaderFilters />
					</Stack>
				</Box>

				<TableContent height={inlineMaxHeight} />
			</Paper>

			{/* Confirm delete */}
			<Dialog
				open={confirm.open}
				onClose={() => setConfirm({ open: false, id: null, label: "" })}>
				<DialogTitle>{LABELS.poi.deleteConfirmTitle}</DialogTitle>
				<DialogContent>
					<DialogContentText>
						{LABELS.poi.deleteConfirmMsg(confirm.label)}
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfirm({ open: false, id: null, label: "" })}>
						{BUTTONS.common.cancel}
					</Button>
					<Button
						color='error'
						variant='contained'
						onClick={async () => {
							try {
								await onDeleteBatch?.(confirm.id);
							} finally {
								setConfirm({ open: false, id: null, label: "" });
							}
						}}>
						{BUTTONS.common.delete}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
