// src/components/FileUploader.jsx
import { useState, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { FILE_STATUS } from "../constant/file.js";
import { UI } from "../constant/ui.js";
import { trimText } from "../utils/text.js";
import { ERRORS, LABELS, VALIDATION } from "../strings/index.js";

export default function FileUploader({
	status,
	filename,
	errorMessage,
	onFileUpload,
	disabled = false,
	requiredValue = "",
	fileExtensionAllowed = [],
	multiple = false,
	emptyText,
	acceptLabel,
}) {
	const inputRef = useRef(null);
	const [dragActive, setDragActive] = useState(false);

	const displayEmpty =
		emptyText ?? LABELS.uploader.emptyText;

	const displayAccept =
		acceptLabel ??
		`${LABELS.uploader.acceptLabelPrefix}${
			fileExtensionAllowed.length
				? fileExtensionAllowed
						.map((ext) => ext.replace(/^\./, "").toUpperCase())
						.join(", ")
				: "ZIP"
		}`;

	const acceptAttr = fileExtensionAllowed.join(",");

	const isAllowed = (name = "") =>
		fileExtensionAllowed.length === 0
			? true
			: fileExtensionAllowed.some((ext) =>
					name.toLowerCase().endsWith(ext.toLowerCase())
				);

	const handleDrag = (e) => {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		setDragActive(["dragenter", "dragover"].includes(e.type));
	};

	const handleFiles = (fileList) => {
		const filesArr = Array.from(fileList || []);
		if (!filesArr.length) return;

		const invalid = filesArr.find((f) => !isAllowed(f.name));
		if (invalid) {
			const extensions = fileExtensionAllowed.join(", ") || "ZIP";
			const msg = ERRORS.fileUploader.invalidFileTypeTemplate(extensions);
			onFileUpload?.(null, msg);
			return;
		}
		onFileUpload?.(multiple ? filesArr : filesArr[0]);
	};

	const handleDrop = (e) => {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		handleFiles(e.dataTransfer.files);
	};

	const handleClick = () => {
		if (disabled) return;
		inputRef.current?.click();
	};

	const handleChange = (e) => {
		handleFiles(e.target.files);
		// reset value to allow re-selecting the same file
		e.target.value = "";
	};

	return (
		<Box
			sx={{
				background: UI.fileUploader.backgroundColor,
				borderRadius: UI.fileUploader.borderRadius,
				width: "100%",
				px: UI.fileUploader.paddingX,
				py: { xs: 3, sm: 4 },
				border: `${UI.fileUploader.borderWidthPx}px dashed`,
				borderColor: dragActive
					? UI.fileUploader.borderColorDragActive
					: UI.fileUploader.borderColorDefault,
				textAlign: "center",
				position: "relative",
				opacity: disabled ? UI.fileUploader.disabledOpacity : 1,
				minHeight: UI.fileUploader.minHeightPx,
				transition: UI.fileUploader.transitionBorder,
				cursor: disabled ? "not-allowed" : "pointer",
			}}
			onClick={handleClick}
			onDragEnter={handleDrag}
			onDragOver={handleDrag}
			onDragLeave={handleDrag}
			onDrop={handleDrop}>
			<input
				ref={inputRef}
				type='file'
				accept={acceptAttr}
				hidden
				onChange={handleChange}
				disabled={status === FILE_STATUS.UPLOADING || disabled}
				multiple={multiple}
			/>
			<span
			className="material-symbols-outlined outlined"
			style={{ fontSize: UI.fileUploader.iconFontSizePx, opacity: 0.7 }}
			>
			upload
			</span>
			<Typography
				sx={{
					mt: 2,
					fontSize: UI.fileUploader.filenameText.fontSizePx,
					color: UI.fileUploader.filenameText.color,
					px: 2,
				}}>
				{trimText(filename, UI.fileUploader.filenameTrimLength) || displayEmpty}
			</Typography>
			<Typography
				sx={{
					fontSize: UI.fileUploader.acceptText.fontSizePx,
					color: errorMessage
						? UI.fileUploader.acceptText.colorError
						: UI.fileUploader.acceptText.colorDefault,
					mt: 1,
				}}>
				{errorMessage || displayAccept}
			</Typography>

			{disabled && (
				<Box
					sx={{
						position: "absolute",
						inset: 0,
						bgcolor: UI.fileUploader.disabledOverlay.bgcolor,
						zIndex: UI.fileUploader.disabledOverlay.zIndex,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexDirection: "column",
						pointerEvents: "auto",
						borderRadius: UI.fileUploader.borderRadius,
					}}>
					<Typography
						color={UI.fileUploader.disabledOverlay.textColor}
						sx={{
							fontWeight: UI.fileUploader.disabledOverlay.textFontWeight,
							fontSize: UI.fileUploader.disabledOverlay.textFontSizePx,
						}}>
						{`${requiredValue}${VALIDATION.common.inputRequiredSuffix}`}
					</Typography>
				</Box>
			)}
		</Box>
	);
}
