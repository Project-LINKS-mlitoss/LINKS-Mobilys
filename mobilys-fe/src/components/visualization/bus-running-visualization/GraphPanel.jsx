// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// GraphPanel.jsx
import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Collapse,
  IconButton,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import * as htmlToImage from 'html-to-image';
import { buildFilename } from '../buildFilename';
import { VISUALIZATION } from '@/strings';

function hourToJp(v) {
  if (v == null) return '';
  const s = String(v);
  const m = s.match(/^(\d{1,2})/);
  const h = m ? parseInt(m[1], 10) : null;
  const hour = (Number.isNaN(h) || h === null) ? s : h;
  return String(hour);
}

function intToHexColor(val) {
  if (typeof val === 'number') {
    let hex = val.toString(16).padStart(6, '0');
    return '#' + hex;
  }
  if (typeof val === 'string') {
    return val.startsWith('#') ? val : '#' + val;
  }
  return '#8884d8';
}

function transformGroupedDataToRecharts(input, groupNames = null) {
  if (!groupNames) {
    const set = new Set();
    input.forEach(item => item.groups.forEach(g => set.add(g.name)));
    groupNames = Array.from(set);
  }
  return input.map(item => {
    const groupObj = {};
    groupNames.forEach(name => {
      const found = item.groups.find(g => g.name === name);
      groupObj[name] = found ? found.value : 0;
    });
    return { hour: item.hour, ...groupObj };
  });
}

function CustomLegend({ payload = [], groupColor = {}, limit = 10, showAll = false }) {
  const [showAllState, setShowAllState] = React.useState(false);
  const visible = showAll ? payload : (showAllState ? payload : payload.slice(0, limit));
  const hiddenCount = payload.length - limit;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        rowGap: 6,
        marginTop: 8,
        marginBottom: 12,
        maxHeight: showAll ? 'none' : 72,
        overflowY: showAll ? 'visible' : 'auto'
      }}
    >
      {visible.map(entry => (
        <span
          key={entry.value}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginRight: 12,
            fontWeight: 400,
            fontSize: 12,
            color: 'rgba(0,0,0,0.87)',
          }}
        >
          <svg width="12" height="12" style={{ marginRight: 6 }}>
            <rect width="12" height="12" fill={groupColor[entry.value] || '#8884d8'} />
          </svg>
          {entry.value}
        </span>
      ))}
      {!showAll && payload.length > limit && !showAllState && (
        <span
          style={{ color: '#888', cursor: 'pointer', fontWeight: 600, marginLeft: 8, fontSize: 13 }}
          onClick={() => setShowAllState(true)}
        >
          {VISUALIZATION.busRunningVisualization.components.graphPanel.hiddenCount.replace(
            "{count}",
            String(hiddenCount),
          )}
        </span>
      )}
      {!showAll && payload.length > limit && showAllState && (
        <span
          style={{ color: '#888', cursor: 'pointer', fontWeight: 600, marginLeft: 8, fontSize: 13 }}
          onClick={() => setShowAllState(false)}
        >
          {VISUALIZATION.busRunningVisualization.components.graphPanel.partialView}
        </span>
      )}
    </div>
  );
}

export default function GraphPanel({
  groupedData = [],
  visibleRoutes = null,
  hideZeroSeries = false,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.busRunningTripCountAnalysis,
}) {
  const strings = VISUALIZATION.busRunningVisualization.components.graphPanel;
  const [open, setOpen] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const chartRef = React.useRef(null);
  const modalChartRef = React.useRef(null);

  const visibleSet = React.useMemo(() => {
    if (!visibleRoutes) return null;
    return new Set(Array.isArray(visibleRoutes) ? visibleRoutes : Array.from(visibleRoutes));
  }, [visibleRoutes]);

  // Groups actually displayed (respect map visibility if provided)
  const groupNamesAll = React.useMemo(() => {
    const s = new Set();
    groupedData.forEach(item => item.groups.forEach(g => {
      if (!visibleSet || visibleSet.has(g.name)) s.add(g.name);
    }));
    return Array.from(s);
  }, [groupedData, visibleSet]);

  const groupColor = React.useMemo(() => {
    const map = {};
    groupedData.forEach(item =>
      item.groups.forEach(g => {
        if ((!visibleSet || visibleSet.has(g.name)) && !map[g.name] && g.color != null) {
          map[g.name] = intToHexColor(g.color);
        }
      })
    );
    return map;
  }, [groupedData, visibleSet]);

  const chartDataRaw = React.useMemo(
    () => transformGroupedDataToRecharts(groupedData, groupNamesAll),
    [groupedData, groupNamesAll]
  );

  // Optionally remove series that are all zeros on the current data slice
  const groupNames = React.useMemo(() => {
    if (!hideZeroSeries) return groupNamesAll;
    const totals = Object.fromEntries(
      groupNamesAll.map(name => [
        name,
        chartDataRaw.reduce((sum, row) => sum + (Number(row[name]) || 0), 0)
      ])
    );
    return groupNamesAll.filter(name => totals[name] > 0);
  }, [groupNamesAll, chartDataRaw, hideZeroSeries]);

  const chartData = React.useMemo(() => {
    // Recompute with filtered groups so bars/legend align
    return transformGroupedDataToRecharts(groupedData, groupNames);
  }, [groupedData, groupNames]);

  const chartHeight = Math.max(600, Math.min(groupNames.length * 40, 1500));

  // capture the SINGLE scroll area (chart + legend)
  const handleDownload = async () => {
    if (!modalOpen) setModalOpen(true);
    setExporting(true);
    await new Promise(r => setTimeout(r, 350));

    const box = modalChartRef.current;
    if (!box) {
      setExporting(false);
      return;
    }

    const prev = { height: box.style.height, overflowY: box.style.overflowY };
    box.style.height = 'auto';
    box.style.overflowY = 'visible';

    try {
      const uri = await htmlToImage.toPng(box, { backgroundColor: '#fff' });
      const a = document.createElement('a');
      a.href = uri;
      a.download = buildFilename(scenarioName, screenName, "graph", strings.title, "png");
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      box.style.height = prev.height;
      box.style.overflowY = prev.overflowY;
      setExporting(false);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2, position: 'relative' }}>
      {/* header (collapsed view) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: open ? 1 : 0 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 0 }}>
          {strings.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            size="small"
            onClick={() => setModalOpen(true)}
            title={VISUALIZATION.common.actions.expand}
            sx={{ mr: 1 }}
          >
            <span className="material-symbols-outlined outlined">
              fullscreen
            </span>
          </IconButton>
          <IconButton size="small" onClick={() => setOpen(v => !v)}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* small panel */}
      <Collapse in={open}>
        <Box sx={{ width: '100%', pr: 1 }}>
          <Box
            ref={chartRef}
            sx={{
              width: '100%',
              minWidth: 300,
              bgcolor: '#fff',
              ...(exporting ? { maxHeight: 'none', overflow: 'visible' } : { maxHeight: 370, overflowY: 'auto' })
            }}
          >
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 32, right: 24, left: 24, bottom: 64 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 14 }}
                  tickFormatter={hourToJp}
                  label={{ value: strings.axis.time, position: 'insideBottom', offset: -8, fontSize: 14 }}
                />
                <YAxis
                  tick={{ fontSize: 14 }}
                  label={{ value: strings.axis.frequency, angle: -90, position: 'insideLeft', fontSize: 14 }}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Legend is placed BELOW the chart to match other cards */}
                {groupNames.map(name => (
                  <Bar key={name} dataKey={name} stackId="a" fill={groupColor[name] || '#8884d8'} name={name} />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Legend in non-expanded view (same style as others) */}
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <CustomLegend
                groupColor={groupColor}
                limit={12}
                payload={groupNames.map(v => ({ value: v }))}
              />
            </Box>
          </Box>
        </Box>
      </Collapse>

      {/* fullscreen */}
      <Dialog fullScreen open={modalOpen} onClose={() => setModalOpen(false)}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setModalOpen(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {strings.title}
            </Typography>
            <IconButton size="small" title={strings.download.png} onClick={handleDownload}>
              <span
                className="material-symbols-outlined outlined"
                style={{ fontSize: 45 }}
              >
                file_png
              </span>
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* IMPORTANT: one scroll area that contains both chart and legend */}
        <DialogContent sx={{ p: 3 }}>
          <Box ref={modalChartRef} sx={{ width: '100%', minWidth: 600 }}>
            <Box sx={{ width: '100%' }}>
              <ResponsiveContainer width="100%" height={Math.min(chartHeight, 1200)}>
                <BarChart data={chartData} margin={{ top: 32, right: 24, left: 24, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 14 }}
                    tickFormatter={hourToJp}
                    interval={0}
                    label={{ value: strings.axis.time, position: 'insideBottom', offset: -6, fontSize: 14 }}
                  />
                  <YAxis
                    tick={{ fontSize: 14 }}
                    label={{ value: strings.axis.frequency, angle: -90, position: 'insideLeft', fontSize: 14 }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    wrapperStyle={{ zIndex: 1500, pointerEvents: 'auto', maxWidth: 400, wordBreak: 'break-all' }}
                  />
                  {groupNames.map(name => (
                    <Bar key={name} dataKey={name} stackId="a" fill={groupColor[name] || '#8884d8'} name={name} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Box>

            {/* legend BELOW the chart, inside the SAME scroll container */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <CustomLegend
                groupColor={groupColor}
                limit={100}
                showAll
                payload={groupNames.map(v => ({ value: v }))}
              />
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  // total of all groups (routes) for this hour
  const total = payload.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  const filtered = payload.filter(item => item.value > 0);
  if (!filtered.length) return null;

  return (
    <Box sx={{ p: 1, bgcolor: '#fff', border: '1px solid #eee', borderRadius: 1 }}>
      {/* header: hour + total side by side */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5, gap: 2 }}>
        <Typography variant="subtitle2">{hourToJp(label)}</Typography>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {VISUALIZATION.common.labels.total}: {total.toLocaleString()}
        </Typography>
      </Box>

      {filtered.map(item => (
        <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: item.color, borderRadius: '50%', mr: 1 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.name}: {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
