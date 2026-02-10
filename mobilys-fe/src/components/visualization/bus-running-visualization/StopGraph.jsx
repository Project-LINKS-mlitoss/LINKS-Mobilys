import React from 'react';
import {
  Paper, Typography, Box, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Collapse, IconButton, Dialog, DialogContent, AppBar, Toolbar
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import { saveAs } from 'file-saver';
import { buildFilename } from '../buildFilename';
import { VISUALIZATION } from '@/strings';

const EXPAND_COL_W = 40;
const CELL = { py: 0.5, px: 1 };
const CHILD_CELL = { fontSize: 14 };
const CHILD_INDENT = 6;

function groupTotal(childs) {
  if (!Array.isArray(childs)) return 0;
  return childs.reduce((sum, cur) => sum + (cur.frequency || 0), 0);
}

export const fmtInt = (n) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString('ja-JP') : '';

export default function StopGraph({
  data = [],
  stopGroupingMethod,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.busRunningVisualization,
}) {
  const strings = VISUALIZATION.busRunningVisualization.components.graphExports.stop;
  const [openAll, setOpenAll] = React.useState(false);
  const [openRows, setOpenRows] = React.useState({});
  const toggleRow = (key) => setOpenRows((p) => ({ ...p, [key]: !p[key] }));

  const [openFs, setOpenFs] = React.useState(false);
  const [fsOpenDetail, setFsOpenDetail] = React.useState(true);
  const [fsOpenRows, setFsOpenRows] = React.useState({});
  const toggleFsRow = (key) => setFsOpenRows((p) => ({ ...p, [key]: !p[key] }));
  const fsRef = React.useRef(null);

  const processed = React.useMemo(() => {
    return (Array.isArray(data) ? data : [])
      .map((d) => {
        const nzChilds = (d.childs || []).filter((c) => (c.frequency || 0) > 0);
        return { ...d, childs: nzChilds, total: groupTotal(nzChilds) };
      })
      .filter((d) => d.total > 0);
  }, [data]);

  const totalAll = React.useMemo(
    () => processed.reduce((acc, d) => acc + d.total, 0),
    [processed]
  );

  const handleCsvDownload = () => {
    const rows = [];
    rows.push([
      stopGroupingMethod || VISUALIZATION.routeTimetable.labels.stop,
      VISUALIZATION.busRunningVisualization.components.filterPanel.stopTypeOptions.child,
      VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency,
    ]);
    processed.forEach((p) => {
      if ((p.childs || []).length === 0) rows.push([p.parent, '', p.total]);
      else p.childs.forEach((c) => rows.push([p.parent, `${c.name}`, c.frequency]));
    });
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, buildFilename(scenarioName, screenName, "graph", strings.title, "csv"));
  };

  return (
    <Paper sx={{ p: 2, mb: 2, position: 'relative' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: openAll ? 2 : 0 }}>
        <Typography variant="h6" fontWeight={700}>{strings.title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setOpenFs(true)}>
            <span className="material-symbols-outlined outlined">
              fullscreen
            </span>
          </IconButton>
          <IconButton size="small" onClick={() => setOpenAll((v) => !v)}>
            {openAll ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Card table */}
      <Collapse in={openAll}>
        <TableContainer sx={{ maxHeight: 'none', overflowY: 'auto', overflowX: 'hidden', mb: 0 }}>
          <Table stickyHeader size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...CELL, width: EXPAND_COL_W }} />
                <TableCell sx={CELL}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {stopGroupingMethod || VISUALIZATION.routeTimetable.labels.stop}
                  </Typography>
                </TableCell>
                <TableCell sx={CELL} align="right">
                  <Typography variant="subtitle2" fontWeight="bold">
                    {VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processed.map((p) => {
                const key = p.parent;
                const isOpen = !!openRows[key];
                return (
                  <React.Fragment key={key}>
                    <TableRow hover>
                      <TableCell sx={{ ...CELL, width: EXPAND_COL_W }}>
                        <IconButton size="small" onClick={() => toggleRow(key)}>
                          {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ ...CELL, fontWeight: 700 }}>{p.parent}</TableCell>
                      <TableCell sx={{ ...CELL, fontWeight: 700 }} align="right">{fmtInt(p.total)}</TableCell>
                    </TableRow>

                    {/* children */}
                    <TableRow>
                      <TableCell sx={{ p: 0, pl: `${EXPAND_COL_W}px` }} colSpan={3}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Table size="small" sx={{ width: '100%' }}>
                            <TableBody>
                              {(p.childs || []).map((c) => (
                                <TableRow key={`${key}::${c.name}`} hover>
                                  <TableCell sx={{ pl: CHILD_INDENT, ...CHILD_CELL }} colSpan={2}>
                                    {c.name}
                                  </TableCell>
                                  <TableCell sx={CHILD_CELL} align="right">{fmtInt(c.frequency)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>

      {/* Fullscreen dialog */}
      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}><CloseIcon /></IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {strings.title}
            </Typography>
            <IconButton size="small" title={strings.downloadCsv} onClick={handleCsvDownload}>
              <span
                className="material-symbols-outlined outlined"
                style={{ fontSize: 45 }}
              >
                csv
              </span></IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 3 }}>
          <Box ref={fsRef} sx={{ width: '100%', minWidth: 600, height: 'calc(100vh - 160px)', overflowY: 'auto' }}>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="h4" fontWeight="bold">{fmtInt(totalAll)}</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: fsOpenDetail ? 1 : 2 }}>
              <Typography variant="h6" fontWeight={700}></Typography>
              <IconButton size="small" onClick={() => setFsOpenDetail((v) => !v)}>
                {fsOpenDetail ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={fsOpenDetail}>
              <TableContainer sx={{ maxHeight: 'none', overflowY: 'auto', overflowX: 'hidden', mb: 3 }}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...CELL, width: EXPAND_COL_W }} />
                      <TableCell sx={CELL}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {stopGroupingMethod || VISUALIZATION.routeTimetable.labels.stop}
                        </Typography>
                      </TableCell>
                      <TableCell sx={CELL} align="right">
                        <Typography variant="subtitle2" fontWeight="bold">
                          {VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processed.map((p) => {
                      const key = p.parent;
                      const isOpen = !!fsOpenRows[key];
                      return (
                        <React.Fragment key={key}>
                          <TableRow hover>
                            <TableCell sx={{ ...CELL, width: EXPAND_COL_W }}>
                              <IconButton size="small" onClick={() => toggleFsRow(key)}>
                                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell sx={{ ...CELL, fontWeight: 700 }}>{p.parent}</TableCell>
                            <TableCell sx={{ ...CELL, fontWeight: 700 }} align="right">{fmtInt(p.total)}</TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell sx={{ p: 0, pl: `${EXPAND_COL_W}px` }} colSpan={3}>
                              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                <Table size="small" sx={{ width: '100%' }}>
                                  <TableBody>
                                    {(p.childs || []).map((c) => (
                                      <TableRow key={`${key}::${c.name}`} hover>
                                        <TableCell sx={{ pl: CHILD_INDENT, ...CHILD_CELL }} colSpan={2}>
                                          {c.name}
                                        </TableCell>
                                        <TableCell sx={CHILD_CELL} align="right">{fmtInt(c.frequency)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
