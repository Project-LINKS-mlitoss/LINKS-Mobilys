// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	IconButton,
	Typography,
	Box,
	List,
	ListItem,
	Divider,
	Button,
	Paper,
	Link,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useRef } from "react";
import { LABELS, BUTTONS } from "../../strings";

function formatBytes(bytes) {
	if (!Number.isFinite(bytes)) return "-";
	const units = ["B", "KB", "MB", "GB"];
	let i = 0,
		n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Additional Props:
 * - variant: "modal" | "inline" (default: "modal")
 * - onAddFiles: (File[]) => void
 * - accept: string (default: ".csv")
 * - multiple: boolean (default: true)
 */
export default function UploadFilesModal({
	open,
	onClose,
	files = [],
	onRemoveAt,
	actionsRenderer, // ({ disabled }) => ReactNode
	title = LABELS.file.fileList,
	emptyHint = LABELS.file.noFiles,
	variant = "modal",
	onAddFiles,
	accept = ".csv",
	multiple = true,
}) {
	const disabled = files.length === 0;
	const inputRef = useRef(null);

	const handleChoose = () => inputRef.current?.click();
	const handleInputChange = (e) => {
		const list = Array.from(e.target.files || []);
		if (list.length && onAddFiles) onAddFiles(list);
		e.target.value = "";
	};

	// size column width (consistent between inline & modal)
	const SIZE_COL_W = 96;

	const renderItem = (f, idx) => (
		<ListItem
			key={`${f.name}-${f.size}-${idx}`}
			sx={{
				py: 1,
				// three columns: name | size | action
				display: "grid",
				gridTemplateColumns: `1fr ${SIZE_COL_W}px auto`,
				alignItems: "center",
				columnGap: 8,
			}}>
			{/* File name */}
			<Typography
				variant='body2'
				sx={{ minWidth: 0, wordBreak: "break-all", pr: 1 }}
				title={f.name}>
				{f.name}
			</Typography>

			{/* Size (right-aligned, fixed width) */}
			<Typography
				variant='body2'
				sx={{ width: SIZE_COL_W, textAlign: "right", color: "text.secondary" }}
				title={formatBytes(f.size)}>
				{formatBytes(f.size)}
			</Typography>

			{/* Remove */}
			{onRemoveAt && (
				<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
					<IconButton
						edge='end'
						aria-label={BUTTONS.common.delete}
						onClick={() => onRemoveAt(idx)}
						size='small'>
						<Typography sx={{ fontSize: 18, lineHeight: 1 }}>×</Typography>
					</IconButton>
				</Box>
			)}
		</ListItem>
	);

	if (variant === "inline") {
		return (
			<Paper variant='outlined' sx={{ p: 2 }}>
				<Typography variant='subtitle1' sx={{ mb: 1, fontWeight: 700 }}>
					{LABELS.file.fileImport} *
				</Typography>

				<Box
					sx={{
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 1,
						minHeight: 160,
						overflow: "hidden",
					}}>
					<List dense disablePadding>
						{files.length === 0 ? (
							<ListItem sx={{ py: 1.5 }}>
								<Typography variant='body2' color='text.secondary'>
									{LABELS.file.selectCsvHint}<b>「CSV」</b>
								</Typography>
							</ListItem>
						) : (
							files.map((f, idx) => (
								<Box key={`${f.name}-${f.size}-${idx}`}>
									{renderItem(f, idx)}
									{idx < files.length - 1 && <Divider component='li' />}
								</Box>
							))
						)}
					</List>
				</Box>

				{/* add more */}
				<input
					ref={inputRef}
					type='file'
					multiple={multiple}
					accept={accept}
					hidden
					onChange={handleInputChange}
				/>
				<Box sx={{ mt: 1 }}>
					<Link component='button' underline='hover' onClick={handleChoose}>
						{LABELS.file.addAnotherFile}
					</Link>
				</Box>

				{/* actions (e.g. 送信) */}
				<Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
					{typeof actionsRenderer === "function" &&
						actionsRenderer({ disabled })}
				</Box>
			</Paper>
		);
	}

	return (
		<Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
			<DialogTitle sx={{ pr: 6 }}>
				{title}
				<IconButton
					aria-label={BUTTONS.common.close}
					onClick={onClose}
					sx={{ position: "absolute", right: 8, top: 8 }}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent dividers>
				{files.length === 0 ? (
					<Typography variant='body2' color='text.secondary'>
						{emptyHint}
					</Typography>
				) : (
					<List dense disablePadding>
						{files.map((f, idx) => (
							<Box key={`${f.name}-${f.size}-${idx}`}>
								{renderItem(f, idx)}
								{idx < files.length - 1 && <Divider component='li' />}
							</Box>
						))}
					</List>
				)}
			</DialogContent>

			<DialogActions sx={{ px: 2 }}>
				{typeof actionsRenderer === "function" && actionsRenderer({ disabled })}
				<Button onClick={onClose}>{BUTTONS.common.close}</Button>
			</DialogActions>
		</Dialog>
	);
}
