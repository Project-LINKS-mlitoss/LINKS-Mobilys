// StopRadiusPopulationGraph.jsx
import React, { useMemo, useRef, useState } from "react";
import {
  Paper, Box, Typography, IconButton, Dialog, AppBar, Toolbar,
  Autocomplete, TextField, Collapse, TableContainer, Table,
  TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell, Legend } from "recharts";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import * as XLSX from "xlsx";
import { buildFilename } from "../../buildFilename";
import { VISUALIZATION } from "@/strings";
import { UI } from "../../../../constant/ui";

const TITLE = VISUALIZATION.stopRadiusAnalysis.components.populationGraph.title;

const AGE_GROUPS = [
  { key: "age_0_14", label: VISUALIZATION.stopRadiusAnalysis.labels.age0_14, color: "#64b5f6" },
  { key: "age_15_64", label: VISUALIZATION.stopRadiusAnalysis.labels.age15_64, color: "#81c784" },
  { key: "age_65_up", label: VISUALIZATION.stopRadiusAnalysis.labels.age65Up, color: "#ffb74d" },
];

const fmtPeople = (n) =>
  `${Number(n || 0).toLocaleString("ja-JP")}${VISUALIZATION.common.units.peopleSuffix}`;

function toPopulationRows(popGraph) {
  return (popGraph || []).map((p) => ({
    stop_group: p.id,
    age_0_14: Number(p.age_0_14 || 0),
    age_15_64: Number(p.age_15_64 || 0),
    age_65_up: Number(p.age_65_up || 0),
  }));
}

 const niceTicks = (max, approx = 6) => {
    if (!max || max <= 0) return [0, 1];
    const raw = max / approx;
    const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
    const steps = [1, 2, 5].map(m => m * pow10);
    const step = steps.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a, steps[0]);
    const ticks = [];
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v));
    if (ticks[ticks.length - 1] < max) ticks.push(Math.round(max));
    return ticks;
  };


  
export default function StopRadiusPopulationGraph({
  data,
  radius,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.stopRadiusAnalysis,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const captureRef = useRef(null);

  const rows = useMemo(() => toPopulationRows(data || []), [data]);

  const unionMode = useMemo(
    () => rows.length === 1 && rows[0]?.stop_group === "ALL",
    [rows]
  );

  const unionSeries = useMemo(() => {
    if (!unionMode) return [];
    const r = rows[0] || {};
    return AGE_GROUPS.map((g) => ({
      type: g.label,
      value: Number(r[g.key] || 0),
      color: g.color,
    }));
  }, [unionMode, rows]);


  

  const stopOptions = useMemo(() => rows.map((r) => r.stop_group), [rows]);
  const [selectedStops, setSelectedStops] = useState([]);

  const filteredRows = useMemo(() => {
    if (unionMode) return rows; // Filtering is irrelevant in union mode
    if (!selectedStops.length) return rows;
    const set = new Set(selectedStops);
    return rows.filter((r) => set.has(r.stop_group));
  }, [rows, selectedStops, unionMode]);

  const title = TITLE;

  const maxUnion = useMemo(
    () => Math.max(0, ...unionSeries.map(s => s.value || 0)),
    [unionSeries]
  );

  const maxStack = useMemo(
    () =>
      Math.max(
        0,
        ...filteredRows.map((r) =>
          AGE_GROUPS.reduce((acc, g) => acc + (r[g.key] || 0), 0)
        )
      ),
    [filteredRows]
  );

 
  // ===== Export helpers =====
  const handleDownloadImage = async (filename = "population_by_age.png") => {
    const container = captureRef.current;
    if (!container) return;
    const scroller = container.querySelector(".chart-scroll");
    const inner = container.querySelector(".chart-inner");
    const legend = container.querySelector(".legend-wrap");

    const contentWidth = Math.max(
      inner?.scrollWidth || 0,
      legend?.scrollWidth || 0,
      container.scrollWidth
    );

    const prev = {
      containerWidth: container.style.width,
      scrollerOverflow: scroller?.style.overflowX,
      scrollerWidth: scroller?.style.width,
    };

    container.style.width = `${contentWidth}px`;
    if (scroller) {
      scroller.style.overflowX = "visible";
      scroller.style.width = `${contentWidth}px`;
    }

    try {
      await downloadElementAsPng({
        element: container,
        filename: buildFilename(scenarioName, screenName, "graph", TITLE, "png"),
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        expandToScroll: false,
      });
    } finally {
      container.style.width = prev.containerWidth || "";
      if (scroller) {
        scroller.style.overflowX = prev.scrollerOverflow || "";
        scroller.style.width = prev.scrollerWidth || "";
      }
    }
  };
  const handleExportCSV = () => {
    if (unionMode) {
      const rowsAoa = [[
        VISUALIZATION.stopRadiusAnalysis.components.populationGraph.csvHeaders.ageGroup,
        VISUALIZATION.stopRadiusAnalysis.components.populationGraph.csvHeaders.people,
      ]];
      unionSeries.forEach((s) => rowsAoa.push([s.type, String(s.value)]));
      const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; 
      a.download = buildFilename(scenarioName, screenName, "graph", TITLE, "csv");
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    // legacy export (per-stop)
    const headerRow = [
      VISUALIZATION.stopRadiusAnalysis.labels.stop,
      ...AGE_GROUPS.map((g) => g.label),
      VISUALIZATION.common.labels.total,
    ];
    const aoa = [
      headerRow,
      ...filteredRows.map((r) => {
        const total = AGE_GROUPS.reduce((acc, g) => acc + (r[g.key] || 0), 0);
        return [r.stop_group, ...AGE_GROUPS.map((g) => r[g.key]), total];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; 
    a.download =  buildFilename(scenarioName, screenName, "graph", TITLE, "csv");
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const chartHeight = 320;
  const perStopWidth = 90;
  const chartWidth = unionMode
    ? Math.max((unionSeries.length || 3) * 120, 460)
    : Math.max(filteredRows.length * perStopWidth, 800);

const ChartBox = ({ isFs }) => {
  const contentWidth = isFs
    ? Math.max((typeof window !== "undefined" ? window.innerWidth : 0) - 64, 600)
    : chartWidth;

  return (
    <Box
      className="chart-scroll"
      sx={{
        width: "100%",
        height: isFs ? "60vh" : chartHeight,
        overflowX: "auto",
        overflowY: "hidden",
        pr: 1,
      }}
    >
      <Box className="chart-inner" sx={{ width: contentWidth }}>
        {unionMode ? (
        <BarChart
          width={contentWidth}
          height={isFs ? 600 : chartHeight}
          data={unionSeries}
          margin={{ top: 8, right: 16, left: 0, bottom: 40 }}   
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="type" interval={0} angle={0} height={40} tick={{ fontSize: 12 }} />
          <YAxis
            width={80}                                          
            allowDecimals={false}
            domain={[0, maxUnion]}                               
            ticks={niceTicks(maxUnion)}
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => fmtPeople(v)}
          />
          <Tooltip formatter={(v) => fmtPeople(v)} />
          <Bar
            dataKey="value"
            name={VISUALIZATION.stopRadiusAnalysis.components.populationGraph.csvHeaders.people}
            isAnimationActive={false}
          >
            {unionSeries.map((s, i) => (
              <Cell key={s.type} fill={unionSeries[i]?.color} />
            ))}
          </Bar>
        </BarChart>
        ) : (
          <BarChart
            width={contentWidth}
            height={isFs ? 600 : chartHeight}
            data={filteredRows}
            margin={{ top: 8, right: 16, left: 8, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="stop_group"
              interval={0}
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickFormatter={(v) => fmtPeople(v)}
            />
            <Tooltip />
            {AGE_GROUPS.map((g) => (
              <Bar key={g.key} dataKey={g.key} stackId="pop" fill={g.color} />
            ))}
          </BarChart>
        )}
      </Box>
    </Box>
  );
};

  const headerCellSx = {
    py: 1,
    px: 1.5,
    position: "sticky",
    top: 0,
    zIndex: 1,
    bgcolor: "background.paper",
    fontWeight: 700,
  };
  const bodyCellSx = {
    py: 1.25,
    px: 1.25,
    borderBottom: (t) => `1px solid ${t.palette.divider}`,
  };

  const TableDetail = (isFs = false) => (
    unionMode ? (
    <TableContainer sx={{ mt: 2, maxHeight: isFs ? 420 : 260, overflow: "auto" }}>
      <Table stickyHeader size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: "20%" }} /> {/* Radius */}
          <col style={{ width: "20%" }} /> {/* Total */}
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.stopRadiusAnalysis.components.map.layers.radius}
            </TableCell>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.stopRadiusAnalysis.labels.populationTotal}
            </TableCell>
            {AGE_GROUPS.map((g) => (
              <TableCell key={g.key} sx={headerCellSx}>
                {g.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(() => {
            const total = AGE_GROUPS.reduce(
              (acc, g) => acc + (rows[0]?.[g.key] || 0),
              0
            );
            return (
              <TableRow>
                <TableCell sx={bodyCellSx}>{`${radius}`}</TableCell>
                <TableCell sx={bodyCellSx}>{fmtPeople(total)}</TableCell>
                {AGE_GROUPS.map((g) => (
                  <TableCell key={g.key} sx={bodyCellSx}>
                    {fmtPeople(rows[0]?.[g.key] || 0)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })()}
        </TableBody>
      </Table>
    </TableContainer>
  ) : (
      <TableContainer sx={{ mt: 2, maxHeight: isFs ? 420 : 260, overflow: "auto", scrollbarGutter: "stable both-edges" }}>
        <Table stickyHeader size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 160 }} />
          </colgroup>
        <TableHead>
          <TableRow>
              <TableCell sx={headerCellSx}>
                {VISUALIZATION.stopRadiusAnalysis.labels.stop}
              </TableCell>
              {AGE_GROUPS.map((g) => (
                <TableCell key={g.key} sx={headerCellSx}>
                  {g.label}
                </TableCell>
              ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} sx={{ py: 3, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {VISUALIZATION.common.emptyState.noData}
                  </Typography>
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((r) => (
              <TableRow key={r.stop_group}>
                  <TableCell sx={bodyCellSx}>
                    <Typography variant="body2" noWrap={!isFs}>{r.stop_group}</Typography>
                  </TableCell>
                  {AGE_GROUPS.map((g) => (
                    <TableCell key={g.key} sx={bodyCellSx}>
                      {fmtPeople(r[g.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
          )}
        </TableBody>
      </Table>
      </TableContainer>
    )
  );

  const StopFilter = (
    <Autocomplete
      multiple
      size="small"
      options={stopOptions}
      value={selectedStops}
      onChange={(_, v) => setSelectedStops(v)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={VISUALIZATION.stopRadiusAnalysis.components.populationGraph.stopSearchLabel}
          placeholder={VISUALIZATION.stopRadiusAnalysis.components.populationGraph.stopSearchPlaceholder}
        />
      )}
      sx={{ mb: 1.5, maxWidth: 480, display: unionMode ? "none" : "block" }}
    />
  );

  const content = (isFs = false) => (
    <Box>
      {StopFilter}
      <Box ref={isFs ? captureRef : null}>
        <ChartBox isFs={isFs} />
      </Box>
      <TableDetail isFs={isFs} />
    </Box>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 1 : 0 }}>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={() => setOpenFs(true)}
              title={VISUALIZATION.common.actions.expand}
              sx={{ mr: 1 }}
            >
              <span className="material-symbols-outlined outlined">fullscreen</span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>{content(false)}</Collapse>
      </Paper>

      <Dialog
        fullScreen
        open={openFs}
        onClose={() => setOpenFs(false)}
        sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}
      >
        <AppBar sx={{ position: "relative", bgcolor: "inherit", color: "inherit" }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">{title}</Typography>
            <IconButton onClick={() => handleDownloadImage()}>
              <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                file_png
              </span>
            </IconButton>
            <IconButton onClick={handleExportCSV} title="Export CSV">
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  csv
                </span>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3 }}>{content(true)}</Box>
      </Dialog>
    </>
  );
}
