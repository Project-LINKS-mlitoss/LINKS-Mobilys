// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import axios from "axios";

const GTFS_FEEDS_API_LIST_URL = "https://api.gtfs-data.jp/v2/feeds";

export const getGTFSFeedListApi = async (pref_id) => {
	let url = GTFS_FEEDS_API_LIST_URL;
	if (pref_id) {
		url += `?pref=${pref_id}`;
	}

	const response = await axios.get(url);
	if (response.status !== 200) {
		throw new Error("Failed to fetch GTFS feeds");
	}
	return response;
};

export const getGTFSFeedDetailApi = async (
	organization_id,
	feed_id,
	params
) => {
	let url = `https://api.gtfs-data.jp/v2/organizations/${organization_id}/feeds/${feed_id}`;
	const response = await axios.get(url, { params });
	if (response.status !== 200) {
		throw new Error("Failed to fetch GTFS feed detail");
	}

	return response;
};
