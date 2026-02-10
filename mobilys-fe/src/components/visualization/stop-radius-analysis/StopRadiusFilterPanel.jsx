import {
	Box,
	Stack,
	Paper,
	Typography,
	Button,
	TextField,
	Slider,
} from "@mui/material";
import ScenarioSelect from "../../shared/ScenarioSelect";
import { VISUALIZATION } from "@/strings";
import { VISUALIZATION_DEFAULTS } from "../../../constant/validation";

export default function StopRadiusFilterPanel({
	scenarioOptions = [],
	selectedScenario = "",
	onScenarioChange,
	radius = VISUALIZATION_DEFAULTS.stopRadiusAnalysis.radiusM,
	onRadiusChange,
	loadingScenario = false,
	onCalculate,
	onReset,
}) {
	const {
		minRadiusM = 0,
		maxRadiusM = 1000,
		stepRadiusM = 100,
	} = VISUALIZATION_DEFAULTS.stopRadiusAnalysis;

	const handleRadiusInput = (e) => {
		const v = Number(e.target.value);
		if (v > maxRadiusM) onRadiusChange?.(maxRadiusM);
		else if (!Number.isNaN(v)) onRadiusChange?.(v);
	};

	const handleRadiusSlider = (_, v) => onRadiusChange?.(v);

	return (
		<Paper variant="outlined" sx={{ p: 2 }}>
			<Stack spacing={2}>
				<Typography variant="subtitle1" fontWeight={700}>
					{VISUALIZATION.stopRadiusAnalysis.components.filterPanel.title}
				</Typography>

				<ScenarioSelect
					scenarioOptions={scenarioOptions}
					selectedScenario={selectedScenario}
					onScenarioChange={onScenarioChange}
					loadingScenario={loadingScenario}
					label={VISUALIZATION.stopRadiusAnalysis.labels.scenario}
					labelId="scenario-label"
					size="small"
					sourceLabelRequiresProject={true}
				/>

				<Box>
					<TextField
						fullWidth
						size='small'
						type='number'
						label={VISUALIZATION.stopRadiusAnalysis.labels.radiusMeters}
						value={radius}
						onChange={handleRadiusInput}
						inputProps={{ min: minRadiusM, step: stepRadiusM }}
					/>
					<Slider
						sx={{ mt: 2 }}
						min={minRadiusM}
						max={maxRadiusM}
						step={stepRadiusM}
						marks={Array.from(
							{
								length:
									Math.floor((maxRadiusM - minRadiusM) / stepRadiusM) + 1,
							},
							(_, i) => {
								const value = minRadiusM + i * stepRadiusM;
								return { value, label: String(value) };
							}
						)}
						value={Math.min(Math.max(radius ?? 0, minRadiusM), maxRadiusM)}
						onChange={handleRadiusSlider}
					/>
				</Box>

				<Box sx={{ mt: 3, display: "flex", gap: 2 }}>
					<Button
						variant="outlined"
						fullWidth
						size="large"
						sx={{ py: 1.5 }}
						onClick={onReset}
						>
						{VISUALIZATION.stopRadiusAnalysis.actions.reset}
					</Button>
					<Button
						variant='contained'
						size="large"
						fullWidth
						onClick={onCalculate}
						disabled={
							!selectedScenario || !radius || radius <= 0 || loadingScenario
						}>
						{VISUALIZATION.stopRadiusAnalysis.actions.calculate}
					</Button>
				</Box>
				
			</Stack>
		</Paper>
	);
}
