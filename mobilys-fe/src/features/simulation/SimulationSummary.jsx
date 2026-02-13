// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
  CircularProgress,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { exportSummaryReport } from "./report/exportSummaryReport";

import { useSnackbarStore } from "../../state/snackbarStore";
import LargeTooltip from "../../components/LargeTooltip";
import { SIMULATION } from "@/strings";
import { useSimulationSummaryPage } from "./hooks/useSimulationSummaryPage";

/* =========================
   Helpers & constants
   ========================= */
const fmt2 = (n) =>
  Number.isFinite(n)
    ? Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 2})
    : "—";

const fmt1 = (n) =>
  Number.isFinite(n)
    ? Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 1 })
    : "—";

const fmtInt = (n) =>
  Number.isFinite(Number(n))
    ? Math.round(Number(n)).toLocaleString("ja-JP")
    : "—";

const COLS = { labelMin: 220, before: 260, after: 260 };
const TAG_W = 64;

const makePdfFilename = (scenarioName, simulationName) => {
  // prefer scenarioName; fall back to simulationName; then to default
  const base = scenarioName || simulationName || SIMULATION.summaryPage.fileName.defaultScenarioName;

  // remove invalid characters for file names (Windows etc.)
  const safe = String(base).replace(/[\\/:*?"<>|]/g, "_");

  return `${safe}_${SIMULATION.summaryPage.fileName.pdfSuffix}`;
};


const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);


/* =========================
   Small components
   ========================= */
function InfoIcon({ id }) {
  const def = SIMULATION.summaryPage.tooltipsData[id];
  if (!def) return null;

  const tip = (
    <>
      <strong>{def.title}</strong>
      <br />
      {def.meaning}
      <br />
      <span style={{ fontWeight: 700 }}>{SIMULATION.summaryPage.tooltips.howLabel}</span>
      <br />
      {def.how}
    </>
  );

  return (
    <LargeTooltip title={tip}>
      <Box
        component="span"
        sx={{ ml: 0.5, display: "inline-flex", alignItems: "center", "@media print": { display: "none" } }}
        aria-label={`${def?.title ?? SIMULATION.summaryPage.tooltips.fallbackItem} ${SIMULATION.summaryPage.tooltips.ariaSuffix}`}
      >
        <InfoOutlinedIcon fontSize="inherit" />
      </Box>
    </LargeTooltip>
  );
}

const NumWithUnit = ({ value, unit, bold, integer = false, decimals = 2 }) => (
  <Box sx={{ display: "inline-flex", justifyContent: "flex-end", alignItems: "baseline", gap: 0.5 }}>
    <Typography
      component="span"
      variant="body2"
      sx={{
        textAlign: "right",
        fontWeight: bold ? 700 : 400,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum" 1',
      }}
    >
      {isFiniteNumber(value)
        ? integer
          ? fmtInt(value)
          : decimals === 1
            ? fmt1(value)
            : fmt2(value)
        : "—"}
    </Typography>
    {unit ? (
      <Typography component="span" variant="body2" sx={{ whiteSpace: "nowrap", opacity: 0.9 }}>
        {unit}
      </Typography>
    ) : null}
  </Box>
);



const Row = ({ label, value, after, before, unit, bold = false, integer  = false, decimals = 2 }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: `minmax(${COLS.labelMin}px, 1fr) ${COLS.before}px ${COLS.after}px`,
      alignItems: "center",
      columnGap: 2,
      py: 0.5,
    }}
  >
    {/* Label */}
    <Typography variant="body2" sx={{ fontWeight: 400 }}>
      {label}
    </Typography>

    {value !== undefined ? (
      <>
        <Box />
        <Box sx={{ justifySelf: "end" }}>
          <NumWithUnit value={value} unit={unit} bold={bold} integer={integer} decimals={decimals} />
        </Box>
      </>
    ) : (
      <>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `${TAG_W}px 1fr`,
            alignItems: "baseline",
            justifyItems: "end",
            columnGap: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
            Before:
          </Typography>
          <NumWithUnit value={before} unit={unit} bold={bold} integer={integer} decimals={decimals} />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `${TAG_W}px 1fr`,
            alignItems: "baseline",
            justifyItems: "end",
            columnGap: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
            After:
          </Typography>
          <NumWithUnit value={after} unit={unit} bold={bold} integer={integer} decimals={decimals} />
        </Box>
      </>
    )}
  </Box>
);

const DiffRow = ({ label, value, bold = false }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: `minmax(${COLS.labelMin}px, 1fr) ${COLS.before}px ${COLS.after}px`,
      alignItems: "center",
      columnGap: 2,
      py: 0.5,
    }}
  >
    <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 400 }}>
      {label}
    </Typography>
    <Box />
    <Box sx={{ justifySelf: "end" }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: bold ? 700 : 400,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {fmtInt(value)}円
      </Typography>
    </Box>
  </Box>
);

/* =========================
   Main component
   ========================= */
export default function SimulationSummary({ simulationId, simulationName, scenarioName }) {
  const strings = SIMULATION.summaryPage;
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const { loading, data, speedTotals, error } = useSimulationSummaryPage(simulationId);
  const pdfFilename = makePdfFilename(scenarioName, simulationName);

 const carTotals = React.useMemo(() => {
     if (!data?.car_volume_data?.data?.routes) return null;

    let length_m = 0;
    let beforeVkm = 0;
    let afterVkm = 0;
    let carChangeTotal = 0; // sum of need_cars_per_day over all patterns

    let sumRouteMaxBefore = 0;
    let sumRouteMaxAfter = 0;
    let routeCount = 0;

    for (const r of data.car_volume_data.data.routes || []) {
      let routeMaxBefore = 0;
      let routeMaxAfter = 0;
      let routeHasSegments = false;

      for (const rp of r.route_patterns || []) {
        carChangeTotal += Number(rp.need_cars_per_day) || 0;

        for (const s of rp.segments || []) {
          length_m += Number(s.length_m) || 0;
          beforeVkm += Number(s.before_vehicle_km_per_day) || 0;
          afterVkm += Number(s.after_vehicle_km_per_day) || 0;

          const bVol = Number(s.before_cars_per_day) || 0;
          const aVol = Number(s.after_cars_per_day) || 0;

          if (bVol > routeMaxBefore) routeMaxBefore = bVol;
          if (aVol > routeMaxAfter) routeMaxAfter = aVol;

          routeHasSegments = true;
        }
      }

      if (routeHasSegments) {
        sumRouteMaxBefore += routeMaxBefore;
        sumRouteMaxAfter += routeMaxAfter;
        routeCount++;
      }
    }

    const beforeCars = routeCount > 0 ? sumRouteMaxBefore / routeCount : 0;
    const afterCars = routeCount > 0 ? sumRouteMaxAfter / routeCount : 0;

    return {
      length_m,
      before_cars_per_day: beforeCars,
      after_cars_per_day: afterCars,
      before_vehicle_km_per_day: beforeVkm,
      after_vehicle_km_per_day: afterVkm,
      car_change: carChangeTotal, 
    };
  }, [data]);

  const benefitTotals = React.useMemo(() => {
    const r6 = data?.benefit_calculations?.data;
    if (!r6?.routes) return null;

    let tt_before = 0;
    let tt_after = 0;
    let oc_before = 0;
    let oc_after = 0;
    let ac_before = 0;
    let ac_after = 0;

    for (const route of r6.routes || []) {
      for (const shape of route.shapes || []) {
        for (const seg of shape.segments || []) {
          const m = seg.metrics || {};
          const tt = m.travel_time_savings_benefit_yen_per_year || {};
          const oc = m.operating_cost_reduction_benefit_yen_per_year || {};
          const ac = m.traffic_accident_reduction_benefit_yen_per_year || {};

          tt_before += Number(tt.before ?? 0);
          tt_after += Number(tt.after ?? 0);
          oc_before += Number(oc.before ?? 0);
          oc_after += Number(oc.after ?? 0);
          ac_before += Number(ac.before ?? 0);
          ac_after += Number(ac.after ?? 0);
        }
      }
    }

    // Compute differences
    const diff_tt = tt_before - tt_after; // 円/年
    const diff_oc = oc_before - oc_after; // 円/年
    const diff_ac = ac_before - ac_after; // 円/年
    const diff_total = diff_tt + diff_oc + diff_ac; // 円 (mixed units but matches BenefitCalculation)

    // Compute annual in 千円/年
    const ann_tt_k = diff_tt ;
    const ann_oc_k = diff_oc ;
    const ann_ac_k = diff_ac ;
    const ann_total_k = ann_tt_k + ann_oc_k + ann_ac_k;

    return {
      tt_before,
      tt_after,
      oc_before,
      oc_after,
      ac_before,
      ac_after,
      diff_tt,
      diff_oc,
      diff_ac,
      diff_total,
      ann_tt_k,
      ann_oc_k,
      ann_ac_k,
      ann_total_k,
    };
  }, [data]);

  React.useEffect(() => {
    dayjs.locale("ja");
  }, []);

  React.useEffect(() => {
    if (!error) return;
    showSnackbar({
      title: strings.messages.fetchFailed,
      severity: "error",
      detail: String(error),
    });
  }, [error, showSnackbar, strings.messages.fetchFailed]);

  const r1 = data?.ridership_change_data?.totals || {};
  const r2 = data?.operating_economics_data?.totals || {};
  const r5Raw = data?.segment_speed_metrics_data?.totals || {};
  const r5 = speedTotals
    ? {
        speed_before_kmh: speedTotals.avg_speed_before,
        speed_after_kmh: speedTotals.avg_speed_after,
        time_per_vehicle_before_h: speedTotals.time_per_vehicle_before_h,
        time_per_vehicle_after_h: speedTotals.time_per_vehicle_after_h,
        total_time_before_vehicle_h: speedTotals.total_time_before_vehicle_h,
        total_time_after_vehicle_h: speedTotals.total_time_after_vehicle_h,
      }
    : r5Raw;
  const r7 = data?.co2_reduction?.totals?.total_co2_reduction_per_year;


  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ bgcolor: "transparent" }}>
      <Box sx={{ display: "flex", justifyContent: "flex", mb: 2 }} className="screen-only">
        <Button
          variant="outlined"
          size="small"
          onClick={() =>
            exportSummaryReport(simulationId, data, {
              includeExplanations: true,
              filename: pdfFilename,
              speedTotals: speedTotals,
             })
           }
         >
           {strings.actions.downloadReport}
         </Button>
      </Box>
      {/* ① 利用者増減 */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.sections.ridership}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5} divider={<Divider />}>
            <Row
              label={
                <>
                  <span>{strings.rows.riders}</span>
                  <InfoIcon id="daily_riders" />
                </>
              }
              before={Number(r1.total_baseline_riders_per_day ?? 0)}
              after={Number(r1.total_after_riders_per_day ?? 0)}
              unit="人/日"
            />
            <Row
              label={
                <>
                  <span>{strings.rows.trips}</span>
                  <InfoIcon id="daily_trips" />
                </>
              }
              before={Number(r1.total_baseline_trips_per_day ?? 0)}
              after={Number(r1.total_after_trips_per_day ?? 0)}
              unit="本/日"
            />
            <Row
              label={
                <>
                  <span>{strings.rows.deltaTrips}</span>
                  <InfoIcon id="delta_trips_per_day" />
                </>
              }
              value={Number(r1.total_delta_trips_per_day ?? 0)}
              unit="本/日"
            />
            <Row
              label={
                <>
                  <span>{strings.rows.deltaRiders}</span>
                  <InfoIcon id="delta_riders_per_day" />
                </>
              }
              value={Number(r1.total_delta_riders_per_day ?? 0)}
              unit="人/日"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ② 運行経費便益 */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.sections.operatingEconomics}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5} divider={<Divider />}>
            <Row
              label={
                <>
                  <span>{strings.rows.annualOperatingBenefit}</span>
                  <InfoIcon id="annual_benefit_k_yen" />
                </>
              }
              value={Number(r2.total_annual_benefit_k_yen ?? 0)}
              unit="千円/年"
              integer
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ④ 断面交通量（セグメント合計） */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.sections.carVolume}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5} divider={<Divider />}>
            <Row
              label={
                <>
                  <span>{strings.rows.carChange}</span>
                  <InfoIcon id="car_change" />
                </>
              }
              value={Number(carTotals?.car_change ?? 0)}
              unit="台/日"
              integer
            />
            <Row
              label={
                <>
                  <span>{strings.rows.distance}</span>
                  <InfoIcon id="distance_km" />
                </>
              }
              value={Number((carTotals?.length_m ?? 0) / 1000)}
              unit="km"
              decimals={1}
            />
            <Row
              label={
                <>
                  <span>{strings.rows.trafficVolume}</span>
                  <InfoIcon id="traffic_volume_sum" />
                </>
              }
              before={Number(carTotals?.before_cars_per_day ?? 0)}
              after={Number(carTotals?.after_cars_per_day ?? 0)}
              unit="台/日"
              integer
            />
            <Row
              label={
                <>
                  <span>{strings.rows.vehkm}</span>
                  <InfoIcon id="vehkm_sum" />
                </>
              }
              before={Number(carTotals?.before_vehicle_km_per_day ?? 0)}
              after={Number(carTotals?.after_vehicle_km_per_day ?? 0)}
              unit="台キロ/日"
              integer
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ⑤ 旅行速度・総走行時間（合計） */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.sections.speed}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5} divider={<Divider />}>
            <Row
              label={
                <>
                  <span>{strings.rows.speed}</span>
                  <InfoIcon id="speed_before_after" />
                </>
              }
              before={Number(r5.speed_before_kmh ?? 0)}
              after={Number(r5.speed_after_kmh ?? 0)}
              decimals={1}
              unit="km/h"
            />
            <Row
              label={
                <>
                  <span>{strings.rows.timePerVehicle}</span>
                  <InfoIcon id="time_per_vehicle_before_after" />
                </>
              }
              before={Number(r5.time_per_vehicle_before_h ?? 0)}
              after={Number(r5.time_per_vehicle_after_h ?? 0)}
              unit="時間/台"
              
            />
            <Row
              label={
                <>
                  <span>{strings.rows.totalVehicleTime}</span>
                  <InfoIcon id="total_vehicle_time_before_after" />
                </>
              }
              before={Number(r5.total_time_before_vehicle_h ?? 0)}
              after={Number(r5.total_time_after_vehicle_h ?? 0)}
              unit="時間台"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ⑥ 便益（合計） */}
     <Accordion defaultExpanded disableGutters>
       <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 700 }}>{strings.sections.benefits}</Typography>
       </AccordionSummary>
       <AccordionDetails>
         <Stack spacing={0.5} divider={<Divider />}>
           <Row
             label={
               <>
                <span>{strings.rows.benefitTravelTime}</span>
                 <InfoIcon id="annual_benefits_tt" />
               </>
             }
            value={Number(benefitTotals?.ann_tt_k ?? 0)}
            unit="千円/年"
            integer
          />

           <Row
             label={
               <>
                <span>{strings.rows.benefitOperatingCost}</span>
                 <InfoIcon id="annual_benefits_oc" />
               </>
             }
            value={Number(benefitTotals?.ann_oc_k ?? 0)}
            unit="千円/年"
            integer
          />

           <Row
             label={
               <>
                <span>{strings.rows.benefitAccident}</span>
                 <InfoIcon id="annual_benefits_ac" />
               </>
             }
            value={Number(benefitTotals?.ann_ac_k ?? 0)}
            unit="千円/年"
            integer
          />
        </Stack>
      </AccordionDetails>

    </Accordion>

      {/* ⑦ CO2削減量算出（合計） */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>{strings.sections.co2}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5} divider={<Divider />}>
            <Row
              label={
                <>
                  <span>{strings.rows.co2Reduction}</span>
                  <InfoIcon id="co2_reduction_tpy" />
                </>
              }
              value={Math.round(Number(r7 ?? 0))}
              unit="t-CO₂/年"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

  
    </Paper>
  );
}
