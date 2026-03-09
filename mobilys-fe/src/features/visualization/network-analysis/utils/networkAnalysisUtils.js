// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
export function toNumber(val, fallback = 0) {
  const n = parseFloat(String(val).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function getTodayISODate() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export function getCurrentTimeHHMM() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getCurrentTimeHHMMSS() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function clampDateToRange(rawDate, { startDate = "", endDate = "" } = {}) {
  if (!rawDate) return rawDate;
  let nextDate = rawDate;
  if (startDate && nextDate < startDate) nextDate = startDate;
  if (endDate && nextDate > endDate) nextDate = endDate;
  return nextDate;
}

export function getScenarioId(selectedScenario) {
  if (!selectedScenario) return "";
  return typeof selectedScenario === "object" ? selectedScenario.id : selectedScenario;
}

export function getScenarioDisplayName(selectedScenarioObj, fallbackName = "") {
  return (
    selectedScenarioObj?.name ||
    selectedScenarioObj?.label ||
    selectedScenarioObj?.scenario_name ||
    selectedScenarioObj?.scenarioName ||
    (selectedScenarioObj?.id ? String(selectedScenarioObj.id) : fallbackName)
  );
}

