import { post } from "./middleware";

export const postGTFSDataImportApi = (
	organization_id,
	feed_id,
	scenario_name,
	start_date,
	end_date,
	gtfs_file_uid
) => {
	return post(
		"/gtfs/data/api/",
		{
			organization_id,
			feed_id,
			scenario_name,
			start_date,
			end_date,
			gtfs_file_uid,
		},
		{}
	);
};

export const postGTFSDataImportApiValidation = (
	organization_id,
	feed_id,
	scenario_name,
	start_date,
	end_date,
	gtfs_file_uid
) => {
	return post(
		"/gtfs/data/validate/validate-api/",
		{
			organization_id,
			feed_id,
			scenario_name,
			start_date,
			end_date,
			gtfs_file_uid,
		},
		{}
	);
};

export const postGTFSDataImportLocalApi = (file, data) => {
	const formData = new FormData();
	formData.append("gtfs_zip", file);
	formData.append("scenario_name", data.scenarioName || "default");

	return post("/gtfs/data/import/", formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
};

export const postGTFSDataImportValidationApi = (file, data) => {
	const formData = new FormData();
	formData.append("gtfs_zip", file);
	formData.append("scenario_name", data.scenarioName || "default");

	return post("/gtfs/data/validate/validate-local/", formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
};

export const cloneGTFSDataImportApi = (
	new_scenario_name,
	source_scenario_id
) => {
	return post("/gtfs/data/import/clone/", {
		new_scenario_name,
		source_scenario_id,
	});
};
