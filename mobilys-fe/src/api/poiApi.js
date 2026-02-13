// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { post, get, del } from "./middleware";
import { useAuthStore } from "../state/authStore";

const resolveProjectId = () => useAuthStore?.getState?.().projectId;

const withProjectId = (payload = {}, projectId) => {
	const pid = projectId ?? resolveProjectId();
	return pid ? { ...payload, project_id: pid } : payload;
};

export const getPoiList = (type, projectId) => {
	const params = new URLSearchParams();
	params.set("grouped", "true");
	if (type) params.set("type", type);
	const pid = projectId ?? resolveProjectId();
	if (pid) params.set("project_id", pid);
	return get(`/visualization/poi/?${params.toString()}`);
};

export const checkPoiCsvBatch = (files) => {
	const fd = new FormData();
	files.forEach((f) => fd.append("files", f));
	const projectId = resolveProjectId();
	if (projectId) fd.append("project_id", projectId);
	return post(`/visualization/poi/check/`, fd);
};

export const commitPoiBatchesApi = (payload, projectId) => {
	const body = withProjectId(payload, projectId);
	return post(`/visualization/poi/`, body);
};

export const deletePoiBatchApi = (batchId, projectId) => {
	const params = new URLSearchParams();
	params.set("batch", batchId);
	const pid = projectId ?? resolveProjectId();
	if (pid) params.set("project_id", pid);
	return del(`/visualization/poi/?${params.toString()}`);
};

// Set active POI batch for the current project
export const setActivePoiBatchApi = ({ projectId, batchId }) => {
	const pid = projectId ?? resolveProjectId();
	return post(`/visualization/poi/set_active_batch/`, {
		project_id: pid,
		batch_id: batchId,
	});
};
