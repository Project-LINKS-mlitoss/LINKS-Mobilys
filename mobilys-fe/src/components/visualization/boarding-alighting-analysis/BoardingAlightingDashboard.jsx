import React from "react";
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Menu,
} from "@mui/material";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { VISUALIZATION } from "@/strings";
import {
  parseYyyymmdd,
  formatDateLabel,
  formatDateYMD,
  heatColor,
} from "./utils";

function BoardingAlightingDashboard({
  scenarioName,
  boardingAlightingData = [],
}) {
  const theme = useTheme();

  // ====== aggregate raw CSV -> per-day stats ==================
  const {
    dailyList,
    weekdayAverages,
    totalPassengers,
    dailyAverage,
    weekdayAverage,
    weekendAverage,
  } = React.useMemo(() => {
    if (
      !Array.isArray(boardingAlightingData) ||
      boardingAlightingData.length === 0
    ) {
      return {
        dailyList: [],
        weekdayAverages: [],
        totalPassengers: 0,
        dailyAverage: 0,
        weekdayAverage: 0,
        weekendAverage: 0,
      };
    }

    const dailyMap = new Map(); // key: yyyymmdd

    for (const row of boardingAlightingData) {
      const key = row.date;
      if (!key) continue;
      const dt = parseYyyymmdd(key);
      if (!dt) continue;

      const getOn = Number(row.count_geton ?? 0) || 0;
      const getOff = Number(row.count_getoff ?? 0) || 0;
      //const total = getOn + getOff;
      const total = getOn;

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          dateKey: key,
          date: dt,
          total,
          getOn,
          getOff,
        });
      } else {
        const ex = dailyMap.get(key);
        ex.total += total;
        ex.getOn += getOn;
        ex.getOff += getOff;
      }
    }

    const dailyList = Array.from(dailyMap.values()).sort(
      (a, b) => a.date - b.date
    );

    if (dailyList.length === 0) {
      return {
        dailyList: [],
        weekdayAverages: [],
        totalPassengers: 0,
        dailyAverage: 0,
        weekdayAverage: 0,
        weekendAverage: 0,
      };
    }

    const totalPassengers = dailyList.reduce((sum, d) => sum + d.total, 0);
    const dayCount = dailyList.length;
    const dailyAverage = dayCount ? Math.round(totalPassengers / dayCount) : 0;

    // weekday vs weekend
    let weekdayTotal = 0;
    let weekdayCount = 0;
    let weekendTotal = 0;
    let weekendCount = 0;

    const weekdayBuckets = [0, 0, 0, 0, 0, 0, 0];
    const weekdayDays = [0, 0, 0, 0, 0, 0, 0];

    for (const d of dailyList) {
      const dow = d.date.getDay(); // 0:Sun ... 6:Sat
      weekdayBuckets[dow] += d.total;
      weekdayDays[dow] += 1;

      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend) {
        weekendTotal += d.total;
        weekendCount += 1;
      } else {
        weekdayTotal += d.total;
        weekdayCount += 1;
      }
    }

    const weekdayAverage =
      weekdayCount > 0 ? Math.round(weekdayTotal / weekdayCount) : 0;
    const weekendAverage =
      weekendCount > 0 ? Math.round(weekendTotal / weekendCount) : 0;

    const weekdayAverages = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      dow,
      label: VISUALIZATION.common.weekdays.short[dow],
      average:
        weekdayDays[dow] > 0
          ? Math.round(weekdayBuckets[dow] / weekdayDays[dow])
          : 0,
      isWeekend: dow === 0 || dow === 6,
    }));

    return {
      dailyList,
      weekdayAverages,
      totalPassengers,
      dailyAverage,
      weekdayAverage,
      weekendAverage,
    };
  }, [boardingAlightingData]);

  // early exit
  if (!dailyList.length) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.emptyState.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.emptyState.description}
        </Typography>
      </Box>
    );
  }

  const feedStartDate = dailyList[0].date;
  const feedEndDate = dailyList[dailyList.length - 1].date;

  // true if all data is within a single year-month
  const isSingleMonthFeed =
    feedStartDate.getFullYear() === feedEndDate.getFullYear() &&
    feedStartDate.getMonth() === feedEndDate.getMonth();

  const scenarioLabel = scenarioName || VISUALIZATION.common.scenarioFallbackName;
  const rangeLabel = `${formatDateYMD(feedStartDate)} ${VISUALIZATION.common.dateParts.rangeSeparator} ${formatDateYMD(feedEndDate)}`;

  // range filter (start/end)
  const [rangeStart, setRangeStart] = React.useState(feedStartDate);
  const [rangeEnd, setRangeEnd] = React.useState(feedEndDate);

  // year-month structure from data
  const minYear = feedStartDate.getFullYear();
  const minMonth = feedStartDate.getMonth() + 1;
  const maxYear = feedEndDate.getFullYear();
  const maxMonth = feedEndDate.getMonth() + 1;

  const [startYear, setStartYear] = React.useState(feedStartDate.getFullYear());
  const [startMonth, setStartMonth] = React.useState(
    feedStartDate.getMonth() + 1
  );
  const [endYear, setEndYear] = React.useState(feedEndDate.getFullYear());
  const [endMonth, setEndMonth] = React.useState(feedEndDate.getMonth() + 1);

  // start year options: from min to max within the overall range
  const startYearOptions = React.useMemo(() => {
    const arr = [];
    for (let y = minYear; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  // end year option: has to be more than or equal to start year
  const endYearOptions = React.useMemo(() => {
    const arr = [];
    const from = startYear || minYear;
    for (let y = from; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [startYear, minYear, maxYear]);

  // start month options
  const getStartMonthsForYear = React.useCallback(
    (year) => {
      if (!year) return [];
      let from = year === minYear ? minMonth : 1;
      let to = year === maxYear ? maxMonth : 12;
      const arr = [];
      for (let m = from; m <= to; m++) arr.push(m);
      return arr;
    },
    [minYear, maxYear, minMonth, maxMonth]
  );

  // end month options
  const getEndMonthsForYear = React.useCallback(
    (year) => {
      if (!year) return [];
      let from;
      if (year === startYear) {
        from = startMonth || minMonth;
      } else if (year === minYear) {
        from = minMonth;
      } else {
        from = 1;
      }
      let to = year === maxYear ? maxMonth : 12;
      const arr = [];
      for (let m = from; m <= to; m++) arr.push(m);
      return arr;
    },
    [startYear, startMonth, minYear, minMonth, maxYear, maxMonth]
  );

  // whenever year/month selection changes, update date range
  React.useEffect(() => {
    if (!startYear || !startMonth || !endYear || !endMonth) return;

    let start = new Date(startYear, startMonth - 1, 1);
    let end = new Date(endYear, endMonth, 0); // last day of month

    // clamp to feed range
    if (start < feedStartDate) start = new Date(feedStartDate);
    if (end > feedEndDate) end = new Date(feedEndDate);

    // ensure end >= start
    if (end < start) {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      setEndYear(start.getFullYear());
      setEndMonth(start.getMonth() + 1);
    }

    setRangeStart(start);
    setRangeEnd(end);
  }, [startYear, startMonth, endYear, endMonth, feedStartDate, feedEndDate]);

  // calendar month + selected dates 
  const [currentMonth, setCurrentMonth] = React.useState(
    new Date(feedStartDate)
  );

  // multiple selection: array of dateKey strings
  const [selectedDateKeys, setSelectedDateKeys] = React.useState([]);

  const isSingleMonthRange =
    rangeStart &&
    rangeEnd &&
    rangeStart.getFullYear() === rangeEnd.getFullYear() &&
    rangeStart.getMonth() === rangeEnd.getMonth();

  // keep calendar month near the range start
  React.useEffect(() => {
    if (rangeStart) {
      setCurrentMonth(
        new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
      );
    }
  }, [rangeStart]);

  // limit calendar navigation to the selected range (rangeStart~rangeEnd)
  const goPrevMonth = () => {
    setCurrentMonth((prev) => {
      const candidate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      const minMonthDate = new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        1
      );
      if (candidate < minMonthDate) {
        return prev;
      }
      return candidate;
    });
    setSelectedDateKeys([]);
  };

  const goNextMonth = () => {
    setCurrentMonth((prev) => {
      const candidate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      const maxMonthDate = new Date(
        rangeEnd.getFullYear(),
        rangeEnd.getMonth(),
        1
      );
      if (candidate > maxMonthDate) {
        return prev;
      }
      return candidate;
    });
    setSelectedDateKeys([]);
  };

  // reset everything back to initial full-range state
  const handleResetCalendar = () => {
    setStartYear(minYear);
    setStartMonth(minMonth);
    setEndYear(maxYear);
    setEndMonth(maxMonth);

    setRangeStart(feedStartDate);
    setRangeEnd(feedEndDate);

    setCurrentMonth(new Date(feedStartDate));
    setSelectedDateKeys([]);
  };

  const handleClearSelection = () => {
    setSelectedDateKeys([]);
  }

  // list filtered by range
  const filteredDailyList = React.useMemo(() => {
    if (!rangeStart || !rangeEnd) return dailyList;
    return dailyList.filter((d) => {
      const t = d.date;
      return t >= rangeStart && t <= rangeEnd;
    });
  }, [dailyList, rangeStart, rangeEnd]);

  // calendar heatmap data
  const calendarCells = React.useMemo(() => {
    if (!filteredDailyList.length) {
      return { year: null, month: null, daysInMonth: 0, cells: [] };
    }

    const targetYear = currentMonth.getFullYear();
    const targetMonth = currentMonth.getMonth(); // 0-based

    const firstOfMonth = new Date(targetYear, targetMonth, 1);
    const firstDow = firstOfMonth.getDay(); // 0:Sun
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    const dailyMapByDay = new Map();
    let maxTotal = 0;
    for (const d of filteredDailyList) {
      if (
        d.date.getFullYear() === targetYear &&
        d.date.getMonth() === targetMonth
      ) {
        const day = d.date.getDate();
        dailyMapByDay.set(day, d);
        if (d.total > maxTotal) maxTotal = d.total;
      }
    }

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const data = dailyMapByDay.get(day) || null;
      const value = data ? data.total : 0;
      const ratio = maxTotal > 0 ? value / maxTotal : 0;
      const dow = (firstDow + day - 1) % 7;
      const dateKey = data ? data.dateKey : null;

      cells.push({
        day,
        value,
        ratio,
        dow,
        dateKey,
      });
    }

    return {
      year: targetYear,
      month: targetMonth,
      daysInMonth,
      cells,
    };
  }, [filteredDailyList, currentMonth]);

  // stats based on filtered range (cards + weekday chart)
  const {
    rangeTotalPassengers,
    rangeDailyAverage,
    rangeWeekdayAverage,
    rangeWeekendAverage,
    rangeWeekdayAverages,
  } = React.useMemo(() => {
    if (!filteredDailyList.length) {
      return {
        rangeTotalPassengers: 0,
        rangeDailyAverage: 0,
        rangeWeekdayAverage: 0,
        rangeWeekendAverage: 0,
        rangeWeekdayAverages: [],
      };
    }

    const totalPassengers = filteredDailyList.reduce((sum, d) => sum + d.total, 0);
    const dayCount = filteredDailyList.length;
    const dailyAverage = dayCount ? Math.round(totalPassengers / dayCount) : 0;

    let weekdayTotal = 0;
    let weekdayCount = 0;
    let weekendTotal = 0;
    let weekendCount = 0;

    const weekdayBuckets = [0, 0, 0, 0, 0, 0, 0];
    const weekdayDays = [0, 0, 0, 0, 0, 0, 0];

    for (const d of filteredDailyList) {
      const dow = d.date.getDay(); // 0:Sun ... 6:Sat
      weekdayBuckets[dow] += d.total;
      weekdayDays[dow] += 1;

      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend) {
        weekendTotal += d.total;
        weekendCount += 1;
      } else {
        weekdayTotal += d.total;
        weekdayCount += 1;
      }
    }

    const weekdayAverage =
      weekdayCount > 0 ? Math.round(weekdayTotal / weekdayCount) : 0;
    const weekendAverage =
      weekendCount > 0 ? Math.round(weekendTotal / weekendCount) : 0;

    const weekdayAverages = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      dow,
      label: VISUALIZATION.common.weekdays.short[dow],
      average:
        weekdayDays[dow] > 0
          ? Math.round(weekdayBuckets[dow] / weekdayDays[dow])
          : 0,
      isWeekend: dow === 0 || dow === 6,
    }));

    return {
      rangeTotalPassengers: totalPassengers,
      rangeDailyAverage: dailyAverage,
      rangeWeekdayAverage: weekdayAverage,
      rangeWeekendAverage: weekendAverage,
      rangeWeekdayAverages: weekdayAverages,
    };
  }, [filteredDailyList]);


  const monthLabel = calendarCells.year
    ? `${calendarCells.year}${VISUALIZATION.common.dateParts.yearSuffix}${String(
      calendarCells.month + 1,
    ).padStart(2, "0")}${VISUALIZATION.common.dateParts.monthSuffix}`
    : "";

  // year options for selection (from min to max within the overall range)
  const calendarYearOptions = React.useMemo(() => {
    const years = [];
    for (let y = minYear; y <= maxYear; y++) {
      years.push(y);
    }
    return years;
  }, [minYear, maxYear]);

  // year selection menu state
  const [yearAnchorEl, setYearAnchorEl] = React.useState(null);
  const yearMenuOpen = Boolean(yearAnchorEl);

  const handleYearClick = (event) => {
    if (isSingleMonthRange) return; // no year selection for single month range
    setYearAnchorEl(event.currentTarget);
  };

  const handleYearClose = () => {
    setYearAnchorEl(null);
  };

  const handleYearSelect = (year) => {
    setCurrentMonth(() => {
      let targetYear = year;
      let monthIndex = 0;

      if (rangeStart) {
        if (targetYear < rangeStart.getFullYear()) {
          targetYear = rangeStart.getFullYear();
          monthIndex = rangeStart.getMonth();
        } else if (targetYear === rangeStart.getFullYear()) {
          monthIndex = rangeStart.getMonth();
        }
      }
      if (rangeEnd && targetYear > rangeEnd.getFullYear()) {
        targetYear = rangeEnd.getFullYear();
        if (rangeStart && rangeStart.getFullYear() === targetYear) {
          monthIndex = rangeStart.getMonth();
        } else {
          monthIndex = 0;
        }
      }
      return new Date(targetYear, monthIndex, 1);
    });
    setSelectedDateKeys([]);
    setYearAnchorEl(null);
  };

  // ===== custom tooltip for daily chart ========================
  const DailyTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload || {};
    const total = (p.weekday || 0) + (p.weekend || 0);

    // decide color based on which bar (weekday / weekend) has a value
    const weekdayEntry = payload.find((item) => item.dataKey === "weekday");
    const weekendEntry = payload.find((item) => item.dataKey === "weekend");

    let color = theme.palette.primary.main; // default: weekday (blue)
    if (weekdayEntry && weekdayEntry.value > 0) {
      color = weekdayEntry.color;
    }
    if (weekendEntry && weekendEntry.value > 0) {
      // weekend overrides if it has value
      color = weekendEntry.color;
    }

    return (
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          px: 1.25,
          py: 0.75,
          borderRadius: 0.75,
          boxShadow: 3,
          border: `1px solid ${theme.palette.divider}`,
          fontSize: 12,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, lineHeight: 1.4 }}
        >
          {p.tooltipDate}
        </Typography>
        <Typography
          variant="body2"
          sx={{ lineHeight: 1.4, mb: 0.5 }}
        >
          {p.tooltipDow}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 1,
              bgcolor: color,
            }}
          />
          <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.passengers}:{" "}
            {total.toLocaleString()}
            {VISUALIZATION.common.units.peopleSuffix}
          </Typography>
        </Box>
      </Box>
    );
  };

  const WeekdayTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload || {};
    const value = payload[0].value || 0;
    const color = payload[0].color || theme.palette.primary.main;

    return (
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          px: 1.25,
          py: 0.75,
          borderRadius: 0.75,
          boxShadow: 3,
          border: `1px solid ${theme.palette.divider}`,
          fontSize: 12,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, lineHeight: 1.4, mb: 0.5 }}
        >
          {p.label}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 1,
              bgcolor: color,
            }}
          />
          <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.series.average}:{" "}
            {value.toLocaleString()}
            {VISUALIZATION.common.units.peopleSuffix}
          </Typography>
        </Box>
      </Box>
    );
  };


  // daily boarding/alighting trend chart data
  const allDailyChartData = React.useMemo(
    () =>
      filteredDailyList.map((d) => {
        const dow = d.date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const wLabel = VISUALIZATION.common.weekdays.short[dow];
        const m = d.date.getMonth() + 1;
        const day = d.date.getDate();
        const mm = String(m).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return {
          label: formatDateLabel(d.date), // X axis label: 03-01(Sat)
          weekday: isWeekend ? 0 : d.total,
          weekend: isWeekend ? d.total : 0,
          dateKey: d.dateKey,
          tooltipDate: `${mm}-${dd}`, // tooltip line 1: 03-01
          tooltipDow: `(${wLabel})`, // tooltip line 2: (Sat)
        };
      }),
    [filteredDailyList]
  );

  const dailyChartData = React.useMemo(
    () =>
      selectedDateKeys.length > 0
        ? allDailyChartData.filter((d) =>
          selectedDateKeys.includes(d.dateKey)
        )
        : allDailyChartData,
    [allDailyChartData, selectedDateKeys]
  );

  // rendering

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        width: "100%",
        height: "100%",
      }}
    >
      {/* Title */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {scenarioLabel} - {rangeLabel}
        </Typography>
      </Box>

      {/* Year/Month range selector */}
      {!isSingleMonthFeed && (
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            mb: 1,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {/* Left side: label + dropdowns */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.targetPeriod}
            </Typography>

            {/* start year */}
            <FormControl variant="standard" size="small" sx={{ minWidth: 80 }}>
              <InputLabel>{VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.startYear}</InputLabel>
              <Select
                value={startYear ?? ""}
                onChange={(e) => setStartYear(e.target.value || null)}
                label={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.startYear}
              >
                {startYearOptions.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                    {VISUALIZATION.common.dateParts.yearSuffix}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* start month */}
            <FormControl variant="standard" size="small" sx={{ minWidth: 80 }}>
              <InputLabel>{VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.startMonth}</InputLabel>
              <Select
                value={startMonth ?? ""}
                onChange={(e) => setStartMonth(e.target.value || null)}
                label={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.startMonth}
              >
                {(startYear ? getStartMonthsForYear(startYear) : []).map(
                  (m) => (
                    <MenuItem key={m} value={m}>
                      {String(m).padStart(2, "0")}
                      {VISUALIZATION.common.dateParts.monthSuffix}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              {VISUALIZATION.common.dateParts.rangeSeparator}
            </Typography>

            {/* end year */}
            <FormControl variant="standard" size="small" sx={{ minWidth: 80 }}>
              <InputLabel>{VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.endYear}</InputLabel>
              <Select
                value={endYear ?? ""}
                onChange={(e) => setEndYear(e.target.value || null)}
                label={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.endYear}
              >
                {endYearOptions.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                    {VISUALIZATION.common.dateParts.yearSuffix}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* end month */}
            <FormControl variant="standard" size="small" sx={{ minWidth: 80 }}>
              <InputLabel>{VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.endMonth}</InputLabel>
              <Select
                value={endMonth ?? ""}
                onChange={(e) => setEndMonth(e.target.value || null)}
                label={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.endMonth}
              >
                {(endYear ? getEndMonthsForYear(endYear) : []).map((m) => (
                  <MenuItem key={m} value={m}>
                    {String(m).padStart(2, "0")}
                    {VISUALIZATION.common.dateParts.monthSuffix}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Right side: reset range button */}
          <Button
            variant="text"
            size="small"
            onClick={handleResetCalendar}
            sx={{ textTransform: "none" }}
          >
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.resetPeriod}
          </Button>
        </Box>
      )}

      {/* KPI cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.cards.totalPassengers}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
            {rangeTotalPassengers.toLocaleString()}{" "}
            <Typography
              component="span"
              variant="subtitle2"
              color="text.secondary"
            >
              {VISUALIZATION.common.units.peopleSuffix}
            </Typography>
          </Typography>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.cards.dailyAverage}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
            {rangeDailyAverage.toLocaleString()}{" "}
            <Typography
              component="span"
              variant="subtitle2"
              color="text.secondary"
            >
              {VISUALIZATION.common.units.peopleSuffix}
            </Typography>
          </Typography>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.cards.weekdayAverage}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
            {rangeWeekdayAverage.toLocaleString()}{" "}
            <Typography
              component="span"
              variant="subtitle2"
              color="text.secondary"
            >
              {VISUALIZATION.common.units.peopleSuffix}
            </Typography>
          </Typography>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.cards.weekendAverage}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
            {rangeWeekendAverage.toLocaleString()}{" "}
            <Typography
              component="span"
              variant="subtitle2"
              color="text.secondary"
            >
              {VISUALIZATION.common.units.peopleSuffix}
            </Typography>
          </Typography>
        </Paper>
      </Box>


      {/* Calendar + daily bar chart */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
          gap: 3,
          alignItems: "stretch",
        }}
      >
        {/* Calendar heatmap */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.sections.monthlyCalendar}
          </Typography>

          {/* month header with navigation */}
          <Box
            sx={{
              mt: 0.5,
              mb: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: isSingleMonthFeed ? "center" : "space-between",
            }}
          >
            {/* Left arrow (not displayed for single month) */}
            {!isSingleMonthFeed && (
              <IconButton size="small" onClick={goPrevMonth} sx={{ p: 0.5 }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            )}

            {/*click to open year selection menu */}
            <Box>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.25,
                  cursor: isSingleMonthRange ? "default" : "pointer",
                }}
                onClick={handleYearClick}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: 500 }}
                >
                  {monthLabel}
                </Typography>

                {!isSingleMonthRange && (
                  <ArrowDropDownIcon fontSize="small" sx={{ mt: "1px" }} />
                )}
              </Box>

              {/* Year list menu  */}
              <Menu
                anchorEl={yearAnchorEl}
                open={yearMenuOpen}
                onClose={handleYearClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
              >
                {calendarYearOptions.map((y) => (
                  <MenuItem
                    key={y}
                    selected={currentMonth.getFullYear() === y}
                    onClick={() => handleYearSelect(y)}
                  >
                    {y}
                    {VISUALIZATION.common.dateParts.yearSuffix}
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Right arrow (not displayed for single month) */}
            {!isSingleMonthFeed && (
              <IconButton size="small" onClick={goNextMonth} sx={{ p: 0.5 }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          <Box sx={{ mt: 1 }}>
            {/* weekday header */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                mb: 0.5,
                gap: 0.5,
              }}
            >
              {VISUALIZATION.common.weekdays.short.map((w) => (
                <Box
                  key={w}
                  sx={{
                    textAlign: "center",
                    fontSize: 12,
                    color: "text.secondary",
                  }}
                >
                  {w}
                </Box>
              ))}
            </Box>
            {/* cells */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 0.5,
              }}
            >
              {calendarCells.cells.map((cell, idx) =>
                cell === null ? (
                  <Box key={`empty-${idx}`} />
                ) : (
                  <Box
                    key={`${calendarCells.year}-${calendarCells.month}-${cell.day}`}
                    onClick={() => {
                      if (cell.dateKey) {
                        setSelectedDateKeys((prev) => {
                          if (prev.includes(cell.dateKey)) {
                            // deselect
                            return prev.filter((k) => k !== cell.dateKey);
                          }
                          // select additionally
                          return [...prev, cell.dateKey];
                        });
                      }
                    }}
                    sx={{
                      position: "relative",
                      borderRadius: 0.75,
                      py: 0.8,
                      px: 0.5,
                      textAlign: "center",
                      fontSize: 12,
                      bgcolor: heatColor(cell.ratio, theme),
                      color: cell.value ? "#fff" : "text.secondary",
                      cursor: cell.dateKey ? "pointer" : "default",
                      border:
                        cell.dateKey &&
                          selectedDateKeys.includes(cell.dateKey)
                          ? `2px solid ${theme.palette.primary.dark}`
                          : "1px solid transparent",
                    }}
                    title={
                      cell.value
                        ? `${calendarCells.month + 1}${VISUALIZATION.common.dateParts.monthSuffix}${cell.day}${VISUALIZATION.common.dateParts.daySuffix}: ${cell.value.toLocaleString()}${VISUALIZATION.common.units.peopleSuffix}`
                        : `${calendarCells.month + 1}${VISUALIZATION.common.dateParts.monthSuffix}${cell.day}${VISUALIZATION.common.dateParts.daySuffix}: ${VISUALIZATION.common.dateParts.noData}`
                    }
                  >
                    {cell.day}
                  </Box>
                )
              )}
            </Box>
          </Box>

          <Box
            sx={{
              mt: 1,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              variant="text"
              size="small"
              onClick={handleClearSelection}
              sx={{ textTransform: "none" }}
            >
              {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.labels.clearSelection}
            </Button>
          </Box>
        </Paper>

        {/* Daily total bar chart */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.sections.dailyTrend}
          </Typography>
          {selectedDateKeys.length > 0 && (
            <Typography
              variant="caption"
              color="primary"
              sx={{ display: "block", mt: 0.5 }}
            >
              {/* Showing only selected dates (multi-select supported) */}
            </Typography>
          )}
          <Box sx={{ width: "100%", height: 260, mt: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v.toLocaleString()}${VISUALIZATION.common.units.peopleSuffix}`} />
                <Tooltip content={<DailyTooltip />} />
                <Bar
                  dataKey="weekday"
                  stackId="total"
                  name={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.series.weekday}
                  fill={theme.palette.primary.main}
                />
                <Bar
                  dataKey="weekend"
                  stackId="total"
                  name={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.series.weekend}
                  fill={theme.palette.warning.main}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>

      {/* Weekday average bar chart */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {VISUALIZATION.boardingAlightingAnalysis.components.dashboard.sections.weekdayAverages}
        </Typography>

        <Box sx={{ width: "100%", height: 260, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rangeWeekdayAverages.map((d) => ({
                label: d.label,
                value: d.average,
                isWeekend: d.isWeekend,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v.toLocaleString()}${VISUALIZATION.common.units.peopleSuffix}`} />
              <Tooltip
                formatter={(value) =>
                  `${Number(value).toLocaleString()}${VISUALIZATION.common.units.peopleSuffix}`
                }
              />
              <Bar
                dataKey="value"
                name={VISUALIZATION.boardingAlightingAnalysis.components.dashboard.series.average}
                label={false}
              >
                {rangeWeekdayAverages.map((d, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      d.isWeekend
                        ? theme.palette.warning.main // weekend -> orange
                        : theme.palette.primary.main // weekday -> blue
                    }
                  />
                ))}
              </Bar>

            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </Box>
  );
}

export default BoardingAlightingDashboard;
