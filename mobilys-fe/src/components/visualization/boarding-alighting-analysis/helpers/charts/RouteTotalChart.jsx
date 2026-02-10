import React, { useCallback, useMemo, useState } from "react";
import { Box } from "@mui/material";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VISUALIZATION } from "@/strings";
import { addStopSequenceLabels, stripSequenceSuffix } from "../../utils";
import { RouteTotalTooltip } from "./ChartTooltips";
import { ChartDot, ChartLegend } from "./ChartLegend";

const LINE_COLOR = "#D99F3C";
const BAR_UP = "#90B6F8";
const BAR_DOWN = "#F2A7B8";

const RouteTotalChart = React.memo(
  function RouteTotalChart({ data, width, height }) {
    const [activeSeries, setActiveSeries] = useState("ALL");

    const dataWithSequence = useMemo(() => addStopSequenceLabels(data), [data]);

    const handleLegendClick = useCallback((key) => {
      setActiveSeries((prev) => (prev === key ? "ALL" : key));
    }, []);

    if (!Array.isArray(data) || data.length === 0) {
      return (
        <Box sx={{ p: 2, color: "#888" }}>
          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.emptyState}
        </Box>
      );
    }

    return (
      <ComposedChart
        width={width ?? 800}
        height={height ?? 400}
        data={dataWithSequence}
        margin={{ top: 10, right: 20, bottom: 60, left: 20 }}
      >
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="stopLabel"
          tick={{ fontSize: 12, fill: "#666" }}
          angle={-45}
          textAnchor="end"
          interval={0}
          height={60}
          tickFormatter={stripSequenceSuffix}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#666" }}
          label={{
            value:
              VISUALIZATION.boardingAlightingAnalysis.components
                .routesVisualizationChart.axis.people,
            angle: -90,
            position: "insideLeft",
            offset: 10,
            style: { fill: "#666", fontSize: 12 },
          }}
        />
        <Tooltip content={<RouteTotalTooltip />} />
        <Legend
          verticalAlign="top"
          align="left"
          content={
            <ChartLegend
              activeSeries={activeSeries}
              onLegendClick={handleLegendClick}
            />
          }
        />

        {(activeSeries === "ALL" || activeSeries === "boardings") && (
          <Bar
            name={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.boardings}
            dataKey="boardings"
            barSize={8}
            fill={BAR_UP}
            opacity={0.9}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-in-out"
          />
        )}
        {(activeSeries === "ALL" || activeSeries === "alightings") && (
          <Bar
            name={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.alightings}
            dataKey="alightings"
            barSize={8}
            fill={BAR_DOWN}
            opacity={0.9}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-in-out"
          />
        )}
        {(activeSeries === "ALL" || activeSeries === "inVehicle") && (
          <Line
            type="monotone"
            name={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.inVehicle}
            dataKey="inVehicle"
            stroke={LINE_COLOR}
            strokeWidth={4}
            dot={<ChartDot />}
            activeDot={{ r: 7 }}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-in-out"
          />
        )}
      </ComposedChart>
    );
  },
  (prev, next) =>
    prev.data === next.data &&
    prev.width === next.width &&
    prev.height === next.height
);

export default RouteTotalChart;

