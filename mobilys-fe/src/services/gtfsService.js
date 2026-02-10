import { GTFSFeed } from "../models/GTFSFeed";
import { getGTFSFeedListApi, getGTFSFeedDetailApi } from "../api/gtfsApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const getGTFSFeedList = async (pref_id) => {
	try {
		const feeds = await getGTFSFeedListApi(pref_id);
		if (!feeds || !feeds.data || !feeds.data.body) {
			throw new ApiError("Invalid GTFS feed data", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}

		return feeds.data.body.map((feed) => new GTFSFeed(feed));
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.gtfsFeedList);
	}
};

export const getGTFSFeedDetail = async (
	organizationId,
	feedId,
	params = {}
) => {
	try {
		const response = await getGTFSFeedDetailApi(organizationId, feedId, params);
		return response.data.body;
	} catch (error) {
		if (error instanceof ApiError) throw error;
		throw ApiError.fromAxiosError(error, ERROR_MESSAGES.fetch.gtfsFeedDetail);
	}
};
