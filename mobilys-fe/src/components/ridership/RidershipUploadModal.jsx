import { useEffect, useMemo, useRef, useState } from "react";
import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
	CircularProgress,
	Alert,
} from "@mui/material";

import { uploadRidershipFileSvc } from "../../services/ridershipService";
import { UI } from "../../constant/ui";
import { VALIDATION } from "../../constant/validation";
import { RIDERSHIP } from "../../strings/domains/ridership";

const MAX_FILE_SIZE_BYTES = VALIDATION.ridership.upload.maxFileSizeBytes;
const ACCEPTED_EXT = VALIDATION.ridership.upload.acceptedExtensions;
const ACCEPT_ATTR = ACCEPTED_EXT.join(",");
const MAX_FILE_SIZE_MB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
const TOLERANCE_OPTIONS_MINUTES = VALIDATION.ridership.upload.toleranceOptionsMinutes;
const DEFAULT_TOLERANCE_MINUTES = String(VALIDATION.ridership.upload.defaultToleranceMinutes);

const isAcceptedFile = (file) => {
	if (!file) return false;
	const name = String(file.name || "").toLowerCase();
	return ACCEPTED_EXT.some((ext) => name.endsWith(ext));
};

const formatBytes = (bytes) => {
	if (bytes === null || bytes === undefined) return UI.ridership.fallbackDash;
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	return `${mb.toFixed(1)} MB`;
};

export default function RidershipUploadModal({
	open,
	onClose,
	scenarioId,
	onUploaded,
	showSnackbar,
}) {
	const mountedRef = useRef(true);
	const fileInputRef = useRef(null);
	const ui = RIDERSHIP.oneDetailed.uploadModal;
	const minutesTemplate = RIDERSHIP.oneDetailed.uploadList.format.minutesTemplate;
	const acceptedTypesLabel = ACCEPTED_EXT.join("/");
	const toleranceOptionsLabel = TOLERANCE_OPTIONS_MINUTES.join("/");
	const [recordName, setRecordName] = useState("");
	const [description, setDescription] = useState("");
	const [maxToleranceTime, setMaxToleranceTime] = useState(DEFAULT_TOLERANCE_MINUTES);
	const [file, setFile] = useState(null);
	const [dragOver, setDragOver] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState("");

	const canSubmit = useMemo(() => {
		return !!scenarioId && !!recordName.trim() && !!file && !submitting;
	}, [scenarioId, recordName, file, submitting]);

	const reset = () => {
		setRecordName("");
		setDescription("");
		setMaxToleranceTime(DEFAULT_TOLERANCE_MINUTES);
		setFile(null);
		setDragOver(false);
		setSubmitting(false);
		setFormError("");
	};

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const handleClose = () => {
		reset();
		onClose?.();
	};

	const validateFile = (candidate) => {
		if (!candidate) return ui.validation.selectFile;
		if (!isAcceptedFile(candidate))
			return ui.validation.invalidFormatTemplate.replace("{types}", acceptedTypesLabel);
		if (candidate.size > MAX_FILE_SIZE_BYTES)
			return ui.validation.fileTooLargeTemplate.replace("{maxMb}", String(MAX_FILE_SIZE_MB));
		return "";
	};

	const setFileFromEvent = (candidate) => {
		const err = validateFile(candidate);
		if (err) {
			setFile(null);
			setFormError(err);
			return;
		}
		setFormError("");
		setFile(candidate);
	};

	const handlePickFile = () => fileInputRef.current?.click?.();

	const handleDrop = (e) => {
		e.preventDefault();
		setDragOver(false);
		const dropped = e.dataTransfer?.files?.[0];
		if (dropped) setFileFromEvent(dropped);
	};

	const handleSubmit = async () => {
		if (!scenarioId) {
			setFormError(ui.validation.scenarioRequired);
			return;
		}
		if (!recordName.trim()) {
			setFormError(ui.validation.recordNameRequired);
			return;
		}
		const err = validateFile(file);
		if (err) {
			setFormError(err);
			return;
		}

		const toleranceValue = Number.parseInt(String(maxToleranceTime || "").trim(), 10);
		if (
			!Number.isFinite(toleranceValue) ||
			!TOLERANCE_OPTIONS_MINUTES.includes(toleranceValue)
		) {
			setFormError(
				ui.validation.toleranceInvalidTemplate.replace("{options}", toleranceOptionsLabel)
			);
			return;
		}

		setSubmitting(true);
		setFormError("");

		const payload = {
			file,
			ridership_record_name: recordName.trim(),
			description: description || "",
			validation_mode: "bus_ic",
			max_tolerance_time: toleranceValue,
		};

		if (showSnackbar) {
			showSnackbar({
				title: ui.snackbar.started,
				severity: "info",
			});
		}

		handleClose();

		uploadRidershipFileSvc(scenarioId, payload)
			.then((res) => {
				if (showSnackbar) {
					showSnackbar({
						title: res?.message || ui.snackbar.completed,
						severity: "success",
					});
				}
				if (mountedRef.current) onUploaded?.(res);
			})
			.catch((e) => {
				const msg =
					e?.response?.data?.message ||
					e?.message ||
					ui.snackbar.failed;
				if (showSnackbar) showSnackbar({ title: msg, severity: "error" });
			});
	};

	return (
		<Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
			<DialogTitle>{ui.title}</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{ mt: 1 }}>
					{formError && <Alert severity="error">{formError}</Alert>}

					<TextField
						label={ui.fields.recordName}
						required
						value={recordName}
						onChange={(e) => setRecordName(e.target.value)}
						placeholder={ui.fields.recordNamePlaceholder}
						fullWidth
					/>

					<Box>
						<Stack spacing={0.75}>
							<FormControl fullWidth>
								<InputLabel id="ridership-max-tolerance-time">{ui.fields.toleranceMinutes}</InputLabel>
								<Select
									labelId="ridership-max-tolerance-time"
									label={ui.fields.toleranceMinutes}
									value={maxToleranceTime}
									onChange={(e) => setMaxToleranceTime(e.target.value)}
								>
									{TOLERANCE_OPTIONS_MINUTES.map((m) => (
										<MenuItem key={m} value={String(m)}>
											{minutesTemplate.replace("{minutes}", String(m))}
										</MenuItem>
									))}
								</Select>
							</FormControl>
							<Typography variant="caption" color="text.secondary">
								{ui.helperText.toleranceMinutes}
							</Typography>
						</Stack>
					</Box>

					<Box>
						<Typography variant="subtitle2" sx={{ mb: 0.75 }}>
							{ui.fields.fileSelect}{" "}
							<span style={{ color: "var(--mui-palette-error-main)" }}>*</span>
						</Typography>
						<Box
							onClick={() => (submitting ? null : handlePickFile())}
							onDragEnter={(e) => {
								e.preventDefault();
								e.stopPropagation();
								if (submitting) return;
								setDragOver(true);
							}}
							onDragOver={(e) => {
								e.preventDefault();
								e.stopPropagation();
								if (submitting) return;
								setDragOver(true);
							}}
							onDragLeave={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setDragOver(false);
							}}
							onDrop={(e) => {
								setDragOver(false);
								if (submitting) return;
								handleDrop(e);
							}}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (submitting) return;
								if (e.key === "Enter" || e.key === " ") handlePickFile();
							}}
							sx={{
								background: "#f6fbfd",
								borderRadius: 2,
								width: "100%",
								px: "2px",
								py: { xs: 3, sm: 4 },
								border: "2px dashed",
								borderColor: dragOver ? "#90caf9" : "#e3e6ec",
								textAlign: "center",
								position: "relative",
								minHeight: 140,
								transition: "border-color .15s ease",
								cursor: submitting ? "not-allowed" : "pointer",
								opacity: submitting ? 0.7 : 1,
								userSelect: "none",
							}}
						>
							<span
								className="material-symbols-outlined"
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
								}}
							>
								{ui.fields.fileDropPrompt}
							</Typography>
							<Typography sx={{ fontSize: 13, color: "#888", mt: 1 }}>
								{ui.fields.fileHintTemplate
									.replace("{types}", ACCEPTED_EXT.join(","))
									.replace("{maxMb}", String(MAX_FILE_SIZE_MB))}
							</Typography>

							{file && (
								<Typography variant="body2" sx={{ mt: 1.5 }}>
									{ui.fields.selectedFileTemplate
										.replace("{fileName}", file.name)
										.replace("{fileSize}", formatBytes(file.size))}
								</Typography>
							)}

							<input
								ref={fileInputRef}
								type="file"
								accept={ACCEPT_ATTR}
								style={{ display: "none" }}
								onChange={(e) => setFileFromEvent(e.target.files?.[0] || null)}
							/>
						</Box>
					</Box>
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={handleClose}>
					{ui.actions.cancel}
				</Button>
				<Button
					variant="contained"
					onClick={handleSubmit}
					disabled={!canSubmit}
				>
					{submitting ? (
						<Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
							<CircularProgress size={16} color="inherit" />
							<span>{ui.actions.uploading}</span>
						</Box>
					) : (
						ui.actions.upload
					)}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
