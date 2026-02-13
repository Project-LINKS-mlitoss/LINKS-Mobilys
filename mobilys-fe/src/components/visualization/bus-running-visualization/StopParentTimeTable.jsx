// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Box, Typography, Divider } from "@mui/material";
import StopChildTimeTable from "./StopChildTimeTable";
/**
 * StopParentTimeTable
 * @param {object} props
 * @param {object} props.data API response object (stop_group_name, stops)
 * @param {string} props.directionId Direction filter (display label)
 * @param {string[]} props.serviceIds Service ID filters
 * @param {string[]} props.routeGroups Route group filters
 * @param {string} props.day Day filter
 * @param {string} props.startTime Start time (e.g. '07:00:00')
 * @param {string} props.endTime End time (e.g. '18:00:00')
 * @param {boolean} [props.showTitle=true] Whether to show the group title
 */
const StopParentTimeTable = ({
	data,
	directionId,
	serviceIds,
	routeGroups,
	day,
	startTime,
	endTime,
	showTitle = true,
}) => {
	const { stop_group_name, stops } = data;

	return (
		<Box sx={{ p: 2 }}>
			{showTitle && (
				<Typography variant='h4' gutterBottom>
					{stop_group_name}
				</Typography>
			)}

			{stops.map((stop) => (
				<Box key={stop.stop_id} sx={{ mb: 4 }}>
					<StopChildTimeTable
						stopData={stop}
						directionId={directionId}
						serviceIds={serviceIds}
						routeGroups={routeGroups}
						day={day}
						startTime={startTime}
						endTime={endTime}
					/>
					<Divider sx={{ mt: 3 }} />
				</Box>
			))}
		</Box>
	);
};

export default StopParentTimeTable;
