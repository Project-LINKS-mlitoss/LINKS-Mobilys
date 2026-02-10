import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Table,
	TableHead,
	TableRow,
	TableCell,
	TableBody,
	Box,
	Typography,
} from "@mui/material";
import { directionMap } from "../../../constant/gtfs";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const TwoLineHeader = ({ jp, en }) => (
	<Box>
		<Typography fontWeight="bold" fontSize={14} noWrap color="text.primary">
			{jp}
		</Typography>
		<Typography
			fontWeight="bold"
			fontSize={12}
			color="text.secondary"
			sx={{ display: "block", lineHeight: "16px", minHeight: "16px", whiteSpace: "nowrap" }}
		>
			{en || " "}
		</Typography>
	</Box>
);

const DeleteTripConfirmDialog = ({ open, onClose, onConfirm, trips = [] }) => (
	<Dialog open={open} onClose={onClose}>
		<DialogTitle>{MESSAGES.trip.deleteDialogTitle}</DialogTitle>
		<DialogContent>
			<Table size='small'>
				<TableHead>
					<TableRow>
						<TableCell><TwoLineHeader jp={LABELS.trip.tripId} en={LABELS.gtfs.tripId} /></TableCell>
						<TableCell><TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} /></TableCell>
						<TableCell><TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} /></TableCell>
						<TableCell><TwoLineHeader jp={LABELS.trip.tripHeadsign} en={LABELS.gtfs.tripHeadsign} /></TableCell>
						<TableCell><TwoLineHeader jp={LABELS.trip.departureTime} en={LABELS.gtfs.departureTime} /></TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{trips.map((t, index) => (
						<TableRow key={index}>
							<TableCell>{t.trip_id}</TableCell>
							<TableCell>{directionMap?.[t.direction_id] ?? t.direction_id}</TableCell>
							<TableCell>{t.service_id}</TableCell>
							<TableCell>{t.trip_headsign}</TableCell>
							<TableCell>{t.departure_time}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</DialogContent>
		<DialogActions>
			<Button onClick={onClose} color='primary'>
				{BUTTONS.common.cancel}
			</Button>
			<Button onClick={onConfirm} color='primary' variant='contained'>
				{BUTTONS.common.delete}
			</Button>
		</DialogActions>
	</Dialog>
);

export default DeleteTripConfirmDialog;
