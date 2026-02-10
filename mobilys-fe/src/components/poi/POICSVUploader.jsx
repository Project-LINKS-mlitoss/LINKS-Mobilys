import {
	Box,
	Paper,
	Typography,
	Backdrop,
	CircularProgress,
	Button,
	Stack,
	ToggleButtonGroup,
	ToggleButton,
} from "@mui/material";
import UploadCloud from "../../assets/photos/upload-cloud.png";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { FILE_STATUS } from "../../constant/file";
import UploadFilesModal from "../upload/UploadFilesModal";
import { useRef, useState } from "react";
import { LABELS, BUTTONS } from "../../strings";
import { MESSAGES } from "../../constant";

export const POICsvUploader = ({
	files = [],
	onFilesSelected,
	onRemoveFile,
	onCheck, // check files (batch pre-commit)
	onSubmit, // optional legacy
	onDownload,
	errors = [],
	status = FILE_STATUS.IDLE,
	handleRetry = () => { },
	disabled = false,
	// NEW: view toggle controlled by parent
	view = "map", // "map" | "list"
	onChangeView, // (v) => void
}) => {
	const [phase, setPhase] = useState("select"); // "select" | "review"
	const inputRef = useRef(null);

	const POI_VALID_TYPES = [
		"学校",
		"カフェ",
		"公園",
		"博物館",
		"ショッピング",
		"病院",
		"レストラン",
		"スーパー",
	];

	const choose = () => inputRef.current?.click();

	const handleInput = (e) => {
		const list = Array.from(e.target.files || []);
		if (list.length) {
			onFilesSelected?.(list);
			setPhase("review");
		}
		e.target.value = "";
	};

	const handleDrop = (e) => {
		e.preventDefault();
		const list = Array.from(e.dataTransfer.files || []).filter((f) =>
			f.name.toLowerCase().endsWith(".csv")
		);
		if (list.length) {
			onFilesSelected?.(list);
			setPhase("review");
		}
	};

	const handleViewChange = (_, v) => {
		if (!v) return;
		onChangeView?.(v);
	};

	const [dragActive, setDragActive] = useState(false);

	const handleClick = () => {
		if (!disabled) choose();
	};

	const handleDrag = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (disabled) return;
		if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
		if (e.type === "dragleave") setDragActive(false);
	};

	const _origHandleDrop = handleDrop;
	const handleDropWrapped = (e) => {
		setDragActive(false);
		if (disabled) return;
		handleDrop(e);
	};

	return (
		<Paper sx={{ p: 2, mb: 2, position: "relative" }}>
			{status === FILE_STATUS.UPLOADING && (
				<Backdrop
					open
					sx={{
						color: "#1976d2",
						zIndex: (t) => t.zIndex.drawer + 2,
						position: "absolute",
					}}>
					<CircularProgress color='inherit' />
					<Typography sx={{ ml: 2, fontWeight: 500, color: "#1976d2" }}>
						{MESSAGES.common.importing}
					</Typography>
				</Backdrop>
			)}

			{/* Header: Title + View Toggle */}
			<Stack
				direction='row'
				alignItems='center'
				justifyContent='space-between'
				sx={{ mb: 1 }}>
				<Typography variant='h6'>{LABELS.poi.importTitle}</Typography>

				<ToggleButtonGroup
					value={view}
					exclusive
					size='small'
					color='primary'
					onChange={handleViewChange}
					disabled={disabled}>
					<ToggleButton value='map'>
						<span className="material-symbols-outlined outlined">
							map
						</span>
						{LABELS.poi.map}
					</ToggleButton>
					<ToggleButton value='list'>
						<span className="material-symbols-outlined outlined">
							list
						</span>
						{LABELS.poi.list}
					</ToggleButton>
				</ToggleButtonGroup>
			</Stack>

			{/* Phase: SELECT (cloud box) */}
			{phase === "select" && (
				<Box>
					<input
						ref={inputRef}
						type='file'
						accept='.csv'
						multiple
						hidden
						onChange={handleInput}
						disabled={status === FILE_STATUS.UPLOADING || disabled}
					/>

					<Box
						sx={{
							background: "#f6fbfd",
							borderRadius: 2,
							width: "100%",
							px: "2px",
							py: { xs: 3, sm: 4 },
							border: "2px dashed",
							borderColor: dragActive ? "#90caf9" : "#e3e6ec",
							textAlign: "center",
							position: "relative",
							opacity: disabled ? 0.7 : 1,
							minHeight: 140,
							transition: "border-color .15s ease",
							cursor: disabled ? "not-allowed" : "pointer",
						}}
						onClick={handleClick}
						onDragEnter={handleDrag}
						onDragOver={handleDrag}
						onDragLeave={handleDrag}
						onDrop={handleDropWrapped}>
						<span className="material-symbols-outlined"
							style={{ fontSize: 56, opacity: 0.7 }}
						>
							upload
						</span>
						<Typography
							sx={{
								width: "70%",
								mt: 2,
								mx: "auto",
								fontSize: 16,
								color: "#222",
								px: 2,
							}}>
							{LABELS.poi.dropHint}
						</Typography>
						<Typography sx={{ fontSize: 13, color: "#888", mt: 1 }}>
							{LABELS.poi.formatCsv}
						</Typography>

						{disabled && (
							<Box
								sx={{
									position: "absolute",
									inset: 0,
									bgcolor: "rgba(255,255,255,0.8)",
									zIndex: 5,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexDirection: "column",
									pointerEvents: "auto",
									borderRadius: 2,
								}}>
								<Typography color='#aaa' sx={{ fontWeight: 500, fontSize: 17 }}>
									{LABELS.poi.cannotOperate}
								</Typography>
							</Box>
						)}
					</Box>
				</Box>
			)}

			{/* Phase: REVIEW (list manager) */}
			{phase === "review" && (
				<UploadFilesModal
					variant='inline'
					files={files}
					onRemoveAt={(i) => onRemoveFile?.(i)}
					onAddFiles={(more) => onFilesSelected?.(more)}
					actionsRenderer={({ disabled: noFiles }) => (
						<>
							<Button
								variant='outlined'
								sx={{ mr: 1 }}
								onClick={() => (handleRetry(), setPhase("select"))}>
								{BUTTONS.common.cancel}
							</Button>
							<Button
								variant='contained'
								onClick={() => (onCheck ? onCheck() : onSubmit?.())}
								disabled={noFiles || status === FILE_STATUS.UPLOADING}>
								{BUTTONS.common.import}
							</Button>
						</>
					)}
				/>
			)}

			{/* Note box */}
			<Box
				sx={{
					mt: 2,
					px: 2,
					py: 1,
					bgcolor: "#FFF7E0",
					borderRadius: 2,
					border: "1px solid #FFD700",
					"& ul": { pl: 3, mt: 0.5, mb: 0 },
				}}>
				<WarningAmberIcon
					sx={{
						color: "#FF9900",
						fontSize: 12,
					}}
				/>{" "}
				<Typography
					component='span'
					color='text.secondary'
					fontSize={12}
					fontWeight={500}>
					{LABELS.poi.csvFormatGuide(
						LABELS.poi.type,
						LABELS.poi.name,
						LABELS.poi.latitude,
						LABELS.poi.longitude,
						LABELS.poi.remarks
					)}
					<br />
					{LABELS.poi.csvExample(
						POI_VALID_TYPES[0],
						"さくら学校",
						35.6895,
						139.6917,
						"チェック"
					)}
				</Typography>
				<ul>
					{POI_VALID_TYPES.map((t) => (
						<li key={t}>
							<Typography variant='caption'>{t}</Typography>
						</li>
					))}
				</ul>
				<Typography variant='caption'>
					{LABELS.poi.otherTypeNote}
				</Typography>
			</Box>

			{/* Legacy errors */}
			{errors.length > 0 && (
				<Box sx={{ mt: 1, maxHeight: 120, overflowY: "auto" }}>
					<Typography variant='subtitle2' color='error'>
						Error:
					</Typography>
					<ul>
						{errors.map((e, i) => (
							<li key={i}>
								<Typography variant='caption'>{e}</Typography>
							</li>
						))}
					</ul>
					<Button
						size='small'
						onClick={() => (handleRetry(), setPhase("select"))}
						sx={{ mt: 1 }}>
						{BUTTONS.common.retry}
					</Button>
				</Box>
			)}

			<Button
				sx={{ mt: 2 }}
				variant='outlined'
				startIcon={
					<span className="material-symbols-outlined outlined">
						download
					</span>
				}
				onClick={onDownload}>
				{LABELS.poi.downloadTemplate}
			</Button>
		</Paper>
	);
};
