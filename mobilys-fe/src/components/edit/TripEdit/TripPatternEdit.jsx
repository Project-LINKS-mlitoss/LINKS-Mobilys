import { useState } from "react";
import { Box, Tabs, Tab, Typography, Paper } from "@mui/material";
import { LABELS } from "../../../strings";
import TripListTab from "./TripList";
import DeleteTripPatternTab from "./DeleteTripPatternTab";

const TripPatternEditTab = ({
	routeGroups,
	tripData,
	scenarioId,
	calendarData,
	stopsData,
	onDelete,
	onFetchDetail,
	tabIndex,
	setTabIndex,
	onSave,
	onEdit,
	onRefetchTrips,
	loadingTripActions,
	loadingEditTrips,
	shapeData,
	previewShapeData,
	showTabs = true,
}) => {
	const handleChange = (event, newValue) => {
		setTabIndex(newValue);
	};

	return (
		<Box>
			{showTabs && (
				<Tabs
					value={tabIndex}
					onChange={handleChange}
					textColor="primary"
					indicatorColor="primary"
					sx={{ mb: 2 }}
				>
					<Tab label={LABELS.trip.tabTripList} />
					<Tab label={LABELS.trip.tabDeleteTrip} />
				</Tabs>
			)}

			<Paper sx={{ p: 2 }}>
				{tabIndex === 0 && (
					<TripListTab
						routeGroups={routeGroups}
						tripData={tripData}
						onFetchDetail={onFetchDetail}
						calendarData={calendarData}
						stopsData={stopsData}
						onSave={onSave}
						scenarioId={scenarioId}
						onEdit={onEdit}
						onRefetchTrips={onRefetchTrips}
						onDelete={onDelete}
						loadingTripActions={loadingTripActions}
						loadingEditTrips={loadingEditTrips}
						shapeData={shapeData}
						previewShapeData={previewShapeData}
					/>
				)}
				{tabIndex === 1 && (
					<DeleteTripPatternTab
						tripData={tripData}
						scenarioId={scenarioId}
						onDelete={onDelete}
						loadingEditTrips={loadingEditTrips}
					/>
				)}
			</Paper>
		</Box>
	);
};

export default TripPatternEditTab;
