import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Table,
	Box,
	TableHead,
	TableRow,
	TableCell,
	TableBody,
	Typography,
} from "@mui/material";
import { directionMap } from "../../../constant/gtfs";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

/* --- Two-line table header (JP + EN) --- */
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

const DeleteRouteConfirmDialog = ({
	open,
	onClose,
	onConfirm,
	patterns = [],
}) => (
	<Dialog open={open} onClose={onClose}>
		<DialogTitle>{MESSAGES.route.deletePatternDialogTitle}</DialogTitle>
		<DialogContent>
			<Typography sx={{ mb: 2 }}>{MESSAGES.route.deleteConfirmation}</Typography>
			<Table size='small'>
				<TableHead>
					<TableRow>
						<TableCell>
							<TwoLineHeader jp={LABELS.route.internalPatternId} en="" />
						</TableCell>
						<TableCell>
							<TwoLineHeader jp={LABELS.common.direction} en={LABELS.gtfs.directionId} />
						</TableCell>
						<TableCell>
							<TwoLineHeader jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} />
						</TableCell>
						<TableCell>
							<TwoLineHeader jp={LABELS.common.section} en="" />
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{patterns.map((p) => (
						<TableRow key={p.pattern_id}>
							<TableCell>{p.pattern_id}</TableCell>
							<TableCell>{directionMap[p.direction_id]}</TableCell>
							<TableCell>{p.service_id}</TableCell>
							<TableCell>{formatSectionLabel(p.segment)}</TableCell>
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

export default DeleteRouteConfirmDialog;
