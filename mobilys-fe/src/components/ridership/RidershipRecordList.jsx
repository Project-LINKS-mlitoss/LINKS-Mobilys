import dayjs from "dayjs";
import {
	Box,
	FormControl,
	InputLabel,
	MenuItem,
	Pagination,
	Paper,
	Select,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from "@mui/material";
import { UI } from "../../constant/ui";
import { RIDERSHIP } from "../../strings/domains/ridership";

const fmt = (iso) => {
	if (!iso) return UI.ridership.fallbackDash;
	try {
		return dayjs(iso).format("YYYY-MM-DD HH:mm");
	} catch {
		return String(iso);
	}
};

const sumPassengers = (row) => {
	const a = Number(row?.adult_passenger_count ?? 0);
	const c = Number(row?.child_passenger_count ?? 0);
	if (Number.isNaN(a) && Number.isNaN(c)) return UI.ridership.fallbackDash;
	return (Number.isNaN(a) ? 0 : a) + (Number.isNaN(c) ? 0 : c);
};

export default function RidershipRecordList({
	records = [],
	pagination = null,
	loading = false,
	uploadOptions = [],
	filters = {},
	onFiltersChange,
	onPageChange,
}) {
	const ui = RIDERSHIP.oneDetailed.recordList;
	const page = pagination?.page ?? 1;
	const totalPages = pagination?.total_pages ?? 1;
	const dash = UI.ridership.fallbackDash;

	const setFilter = (key, value) =>
		onFiltersChange?.({ ...filters, [key]: value });

	return (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
			<Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
				{ui.title}
			</Typography>

			<Stack
				direction={{ xs: "column", md: "row" }}
				spacing={2}
				alignItems={{ xs: "stretch", md: "center" }}
				sx={{ mb: 2 }}
			>
				<FormControl sx={{ minWidth: 240 }}>
					<InputLabel id="ridership-upload-filter">{ui.filters.upload}</InputLabel>
					<Select
						labelId="ridership-upload-filter"
						label={ui.filters.upload}
						value={filters.upload_id || ""}
						onChange={(e) => setFilter("upload_id", e.target.value)}
					>
						{!filters.upload_id && (
							<MenuItem value="" disabled>
								{ui.filters.selectPlaceholder}
							</MenuItem>
						)}
						{uploadOptions.map((u) => (
							<MenuItem key={u.id} value={u.id}>
								{u.ridership_record_name || u.file_name || u.id}
							</MenuItem>
						))}
					</Select>
				</FormControl>

				<TextField
					label={ui.filters.startDate}
					type="date"
					InputLabelProps={{ shrink: true }}
					value={filters.start_date || ""}
					onChange={(e) => setFilter("start_date", e.target.value)}
					sx={{ minWidth: 160 }}
				/>

				<TextField
					label={ui.filters.endDate}
					type="date"
					InputLabelProps={{ shrink: true }}
					value={filters.end_date || ""}
					onChange={(e) => setFilter("end_date", e.target.value)}
					sx={{ minWidth: 160 }}
				/>

				<TextField
					label={ui.filters.boardingStationCode}
					value={filters.boarding_station || ""}
					onChange={(e) => setFilter("boarding_station", e.target.value)}
					sx={{ minWidth: 180 }}
				/>

				<TextField
					label={ui.filters.alightingStationCode}
					value={filters.alighting_station || ""}
					onChange={(e) => setFilter("alighting_station", e.target.value)}
					sx={{ minWidth: 180 }}
				/>
			</Stack>

			<Paper variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
				<TableContainer sx={{ height: "100%", overflow: "auto" }}>
					<Table stickyHeader size="small">
						<TableHead>
							<TableRow>
								<TableCell>{ui.table.headers.ridershipRecordId}</TableCell>
								<TableCell>{ui.table.headers.boardingStation}</TableCell>
								<TableCell>{ui.table.headers.alightingStation}</TableCell>
								<TableCell>{ui.table.headers.boardingAt}</TableCell>
								<TableCell>{ui.table.headers.alightingAt}</TableCell>
								<TableCell>{ui.table.headers.route}</TableCell>
								<TableCell>{ui.table.headers.trip}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{loading && (
								<TableRow>
									<TableCell colSpan={8}>
										<Typography variant="body2" color="text.secondary">
											{ui.table.loading}
										</Typography>
									</TableCell>
								</TableRow>
							)}

							{!loading && records.length === 0 && (
								<TableRow>
									<TableCell colSpan={8}>
										<Typography variant="body2" color="text.secondary">
											{ui.table.empty}
										</Typography>
									</TableCell>
								</TableRow>
							)}

							{records.map((r) => (
								<TableRow key={r?.id ?? `${r?.ridership_record_id}-${r?.source_row_number}`}>
									<TableCell>{r?.ridership_record_id ?? r?.id ?? dash}</TableCell>
									<TableCell>
										{r?.boarding_station_name || dash} ({r?.boarding_station_code || dash})
									</TableCell>
									<TableCell>
										{r?.alighting_station_name || dash} ({r?.alighting_station_code || dash})
									</TableCell>
									<TableCell>{fmt(r?.boarding_at)}</TableCell>
									<TableCell>{fmt(r?.alighting_at)}</TableCell>
									<TableCell>{r?.route_name || r?.route_id || dash}</TableCell>
									<TableCell>{r?.trip_code || dash}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			</Paper>

			{totalPages > 1 && (
				<Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
					<Pagination
						page={page}
						count={totalPages}
						onChange={(_, p) => onPageChange?.(p)}
					/>
				</Box>
			)}
		</Box>
	);
}
