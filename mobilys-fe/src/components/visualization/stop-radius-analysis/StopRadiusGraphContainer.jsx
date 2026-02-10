import { Box, Paper } from "@mui/material";
import StopRadiusPopulationGraph from "./graph/StopRadiusPopulationGraph";
import StopRadiusPOIGraph from "./graph/StopRadiusPOIGraph";
import { VISUALIZATION } from "@/strings";

export default function StopRadiusGraphContainer({
  data,
  radius,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.stopRadiusAnalysis,
}) {
  if (!data) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, textAlign: "center" }}>
        {VISUALIZATION.stopRadiusAnalysis.components.graphContainer.emptyState}
      </Paper>
    );
  }

  const {
    stop_group_method,
    population_graph: legacyPop,
    POI_graph: legacyPoi,
    population_total,
    poi_summary,
    poi_for_map,
  } = data || {};

  const population_graph =
    (Array.isArray(legacyPop) && legacyPop.length)
      ? legacyPop
      : population_total
        ? [{
            id: "ALL",
            age_0_14: Number(population_total.age_0_14 || 0),
            age_15_64: Number(population_total.age_15_64 || 0),
            age_65_up: Number(population_total.age_65_up || 0),
            total_population: Number(population_total.total_population || 0),
          }]
        : [];

  const POI_graph =
    (Array.isArray(legacyPoi) && legacyPoi.length)
      ? legacyPoi
      : Array.isArray(poi_summary)
        ? [{
            id: "ALL",
            pois: poi_summary.map(s => ({
              type: s.type,
              data: (Array.isArray(poi_for_map) ? poi_for_map : [])
                .filter(p => p.type === s.type)
                .map(p => ({
                  poi_name: p.poi_name || "",
                  address: p.address || "",
                  lat: Number(p.lat),
                  lng: Number(p.lng),
                })),
            })),
          }]
        : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <StopRadiusPOIGraph method={stop_group_method} data={POI_graph} radius={radius} scenarioName={scenarioName} screenName={screenName}/>
      <StopRadiusPopulationGraph method={stop_group_method} data={population_graph} radius={radius} scenarioName={scenarioName} screenName={screenName}/>
    </Box>
  );
}
