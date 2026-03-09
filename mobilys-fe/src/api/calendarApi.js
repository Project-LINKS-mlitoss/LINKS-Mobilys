// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get } from "./middleware";

export const getServicePerScenario = (params = {}) =>
  get(`/gtfs/data/calendar`, params);