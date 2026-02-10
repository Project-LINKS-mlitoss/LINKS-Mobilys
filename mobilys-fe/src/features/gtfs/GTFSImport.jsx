// src/pages/gtfs/GTFSImport.jsx
import React, { useMemo, useState } from "react";
import { Typography, Box, Tabs, Tab } from "@mui/material";
import { prefectureMap } from "../../constant/gtfs.js";
import { trimText } from "../../utils/text.js";
import GTFSImportAPI from "../../components/gtfs/GTFSImportAPI";
import GTFSImportLocal from "../../components/gtfs/GTFSImportLocal";
import emptyDataImage from "../../assets/photos/empty-data.png";
import { useSearchParams } from "react-router-dom";
import { GTFS } from "../../strings";
import { useGtfsImport } from "./hooks/useGtfsImport";

export default function GTFSImport() {
	const [params] = useSearchParams();
	const initialTab = useMemo(() => {
		const t = Number(params.get("tab"));
		return Number.isInteger(t) && t >= 0 && t <= 1 ? t : 0; 
	}, [params]);

	const [tab, setTab] = useState(initialTab);   
	const {
		prefecture,
		setPrefecture,
		org,
		setOrg,
		search,
		setSearch,
		loading,
		error,
		uniqueOrganizations,
		filteredData,
	} = useGtfsImport();

	const TABS = [
		{ label: GTFS.import.tabs.fromRepo, value: 0 },
		{ label: GTFS.import.tabs.fromLocal, value: 1 },
	];

	return (
		<Box
			sx={{
				height: "86vh",
				boxSizing: "border-box",
				overflow: "visible",
				display: "flex",
				flexDirection: "column",
				mt: -4,
			}}
		>
			<Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
				{GTFS.import.title}
			</Typography>

			<Tabs
				value={tab}
				onChange={(_, v) => setTab(v)}
				textColor='primary'
				indicatorColor='primary'
				sx={{
					mb: 4,
					minHeight: 42,
					".MuiTab-root": {
						textTransform: "none",
						fontSize: 16,
						minWidth: 0,
						px: 3,
						py: 1,
						color: "text.secondary",
					},
					".Mui-selected": {
						color: "primary.main",
						fontWeight: 600,
					},
					".MuiTabs-indicator": {
						height: 3,
						borderRadius: 1,
					},
				}}>
				{TABS.map((t) => (
					<Tab key={t.value} label={t.label} value={t.value} disableRipple />
				))}
			</Tabs>

			{tab === 0 ? (
				<GTFSImportAPI
					loading={loading}
					error={error}
					prefecture={prefecture}
					setPrefecture={setPrefecture}
					org={org}
					setOrg={setOrg}
					search={search}
					setSearch={setSearch}
					uniqueOrganizations={uniqueOrganizations}
					filteredData={filteredData}
					prefectureMap={prefectureMap}
					trimText={trimText}
					emptyDataImage={emptyDataImage}
				/>
			) : (
				<GTFSImportLocal />
			)}
		</Box>
	);
}
