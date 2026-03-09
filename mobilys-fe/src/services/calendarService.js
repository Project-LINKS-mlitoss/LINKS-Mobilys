// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { getServicePerScenario } from "../api/calendarApi";

export const getServicePerScenarioData = async (params = {}) => {
  const response = await getServicePerScenario(params);
  return response;
}