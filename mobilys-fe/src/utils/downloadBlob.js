// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
export const downloadBlob = (blob, filename) => {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename || "download";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
};

