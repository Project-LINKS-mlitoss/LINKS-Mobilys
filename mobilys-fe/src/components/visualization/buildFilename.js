// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { VISUALIZATION } from "@/strings";

export function buildFilename(
  scenarioName,
  screenName,
  type /* "map" | "graph" */,
  graphName,
  ext /* optional: e.g., "png" */
) {
  const safe = (s) =>
    (s ?? VISUALIZATION.common.filenames.unset)
      .toString()
      .replace(/[\\/:*?"<>|]/g, "_") // remove invalid file chars
      .replace(/\s+/g, "_")          // replace spaces with underscores
      .replace(/_+/g, "_")           // collapse multiple underscores
      .replace(/^_+|_+$/g, "")       // trim underscores
      .slice(0, 120);                // keep name within safe length

  const tail =
    type === "map"
      ? VISUALIZATION.common.filenames.mapSuffix
      : (graphName ?? VISUALIZATION.common.filenames.graphSuffix);
  const base = `${safe(scenarioName)}_${safe(screenName)}_${safe(tail)}`;

  // If an extension is provided, append it (normalized, no leading dot)
  const normalizedExt =
    typeof ext === "string" && ext.trim() ? ext.trim().replace(/^\.+/, "") : "";

  return normalizedExt ? `${base}.${normalizedExt}` : base;
}
