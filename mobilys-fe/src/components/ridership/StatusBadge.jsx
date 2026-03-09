// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Chip, CircularProgress, Stack } from "@mui/material";
import { RIDERSHIP } from "../../strings/domains/ridership";

const LABEL = {
	processing: RIDERSHIP.oneDetailed.statusBadge.labels.processing,
	completed: RIDERSHIP.oneDetailed.statusBadge.labels.completed,
	partial: RIDERSHIP.oneDetailed.statusBadge.labels.partial,
	failed: RIDERSHIP.oneDetailed.statusBadge.labels.failed,
};

const COLOR = {
	processing: "info",
	completed: "success",
	partial: "warning",
	failed: "error",
};

export default function StatusBadge({ status }) {
	const value = status || "processing";
	const isProcessing = value === "processing";

	return (
		<Chip
			size="small"
			label={
				isProcessing ? (
					<Stack direction="row" alignItems="center" spacing={1}>
						<CircularProgress size={12} thickness={6} />
						<span>{LABEL[value] || value}</span>
					</Stack>
				) : (
					LABEL[value] || value
				)
			}
			color={COLOR[value] || "default"}
			variant={isProcessing ? "outlined" : "filled"}
		/>
	);
}

