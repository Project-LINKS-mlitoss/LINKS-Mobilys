// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Button,
} from "@mui/material";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ImportDetail from "../../components/gtfs/ImportDetail";
import { useSnackbarStore } from "../../state/snackbarStore";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import GTFSExportModal from "../../components/gtfs/GTFSExportModal";
import { alpha } from "@mui/material/styles";
import GTFSValidationTab from "./GTFSValidationTab";
import { SCENARIO } from "../../strings";
import { useGtfsScenarioDetail } from "./hooks/useGtfsScenarioDetail";


function TabPanel(props) {
	const { children, value, index, ...other } = props;
	return (
		<div role='tabpanel' hidden={value !== index} {...other}>
			{value === index && <Box sx={{ p: 3 }}>{children}</Box>}
		</div>
	);
}

export default function ScenarioDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scenarioId } = useParams();
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const [tab, setTab] = React.useState(0);
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const [exportTarget, setExportTarget] = React.useState(null);
  const [autoRunValidationToken, setAutoRunValidationToken] = React.useState(null);
  const [autoRunFromExport, setAutoRunFromExport] = React.useState(false);

  const {
    importInfo,
    scenarioName,
    loading,
    loadError,
    exportScenarioGtfs,
  } = useGtfsScenarioDetail(scenarioId);

  React.useEffect(() => {
    if (!loadError) return;
    showSnackbar({
      title: SCENARIO.pickerTile.snackbar.internalError,
      detail: loadError?.message || "",
      severity: "error",
    });
  }, [loadError, showSnackbar]);
  
	React.useEffect(() => {
		const searchParams = new URLSearchParams(location.search);
		const tabFromQuery = searchParams.get("tab");
		const shouldRunValidation = searchParams.get("runValidation") === "1";
		const fromExport = searchParams.get("exportDone") === "1"; 

		if (tabFromQuery === "validation") {
			setTab(1);
		}

		if (shouldRunValidation) {
			setAutoRunValidationToken(Date.now().toString());
			setAutoRunFromExport(fromExport); 

			// Clean up URL so it does not re-trigger
			searchParams.delete("runValidation");
			searchParams.delete("exportDone"); 

			const newSearch = searchParams.toString();
			navigate(
				`${location.pathname}${newSearch ? `?${newSearch}` : ""}`,
				{ replace: true }
			);
		}
	}, [location.search, navigate, location.pathname]);

	const handleValidationAutoRunConsumed = () => {
		setAutoRunValidationToken(null);
		setAutoRunFromExport(false);
	};

	const handleTabChange = (event, newValue) => {
		void event;
		if (!loading) setTab(newValue);
	};

	const buildGtfsExportFilename = () => {
		return `${SCENARIO.detail.export.exportFilenamePrefix}${scenarioName}.zip`;
	};	

	const exportWithOptions = async ({
		startDate,
		endDate,
		fileTypes,
		onProgress,
	}) => {
		try {
			const blob = await exportScenarioGtfs({
				startDate,
				endDate,
				fileTypes,
				onProgress,
			});

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			const filename = buildGtfsExportFilename();
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();


			setTab(1);
			setAutoRunValidationToken(Date.now().toString());
			setAutoRunFromExport(true);

			// Clean up URL so it does not re-trigger
			const searchParams = new URLSearchParams(location.search);
			searchParams.delete("runValidation");
			searchParams.delete("exportDone");
			setExportModalOpen(false);
		} catch (err) {
			console.error("Export failed:", err);
			showSnackbar({ title: SCENARIO.detail.export.exportFailed, severity: "error" });
		}
	};


	// ——— derive only tables with count > 0
	// file list shown in modal should mirror ImportDetail (include zeros)
	const recordCount =
		importInfo?.import_info?.record_count || importInfo.record_count || {};
	const availableFiles = Object.keys(recordCount);
	// Older scenarios may not have record counts; let the modal fall back to its defaults
	const fileTypesForExport = availableFiles.length ? availableFiles : undefined;

	const iconOutlinedButtonSx = (theme) => ({
		minWidth: 40,          // compact width but keep full button height
		height: 36,            // MUI "medium" button height
		p: "6px",              // comfortable padding for the icon
		borderColor: alpha(theme.palette.primary.main, 0.5),
		"&:hover": {
		borderColor: theme.palette.primary.main,
		},
	});

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
		<Box sx={{ display: "flex", alignItems: "center", mt: -1}}>
			<Button
				variant='text'
				color='primary'
				size='small'
				onClick={() => navigate("/edit-data")}
				startIcon={<ChevronLeft fontSize='small' />}
				sx={{
					px: 0,
					"&:hover": { backgroundColor: "transparent" },
				}}>
				{SCENARIO.detail.backToList}
			</Button>
		</Box>

		{/* Header */}
		<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
			<Typography variant="h4" sx={{fontWeight: 600, ml: 1 }}>
				{SCENARIO.detail.title}
			</Typography>
			{scenarioName && (
				<Typography
					variant='subtitle2'
					sx={{ color: "text.secondary", fontWeight: 700 }}>
					{scenarioName}
				</Typography>
			)}
		</Box>
      <Box
        sx={{
          p: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setExportTarget({ id: scenarioId, scenario_name: scenarioName });
              setExportModalOpen(true);
            }}
			sx={iconOutlinedButtonSx}
          >
			{SCENARIO.detail.exportButton}
          </Button>
        </Box>
      </Box>

			<Tabs
				value={tab}
				onChange={handleTabChange}
				aria-label='scenario detail tabs'
				sx={{ pl: 3, borderBottom: 1, borderColor: "divider" }}>
				<Tab disabled={loading} label={SCENARIO.detail.tabs.detail} />
				<Tab disabled={loading} label={SCENARIO.detail.tabs.validation} />
			</Tabs>

			<TabPanel value={tab} index={0}>
				{loading ? (
					<Typography>{SCENARIO.detail.loading}</Typography>
				) : (
					<ImportDetail info={importInfo} />
				)}
			</TabPanel>

			<TabPanel value={tab} index={1}>
				<GTFSValidationTab
					scenarioId={scenarioId}
					scenarioName={importInfo?.scenario_name}
					showSnackbar={showSnackbar}
					autoRunValidationToken={autoRunValidationToken}
					onAutoRunConsumed={handleValidationAutoRunConsumed}
					autoRunFromExport={autoRunFromExport}
				/>
			</TabPanel>

			<GTFSExportModal
				open={exportModalOpen}
				onClose={() => setExportModalOpen(false)}
				scenario={exportTarget}
				fileTypes={fileTypesForExport}
				onConfirm={exportWithOptions}
			/>      
		</Box>
	);
}
