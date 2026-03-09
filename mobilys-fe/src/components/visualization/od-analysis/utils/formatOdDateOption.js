// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { VISUALIZATION } from "@/strings";

const isAllDateOption = (value) =>
  value === VISUALIZATION.common.filters.all || value === VISUALIZATION.common.filters.allAlt;

/**
 * Formats OD analysis date options (YYYYMMDD) into `YYYY/MM/DD (曜)`.
 * - Accepts "すべて" and "全て" as the "all" option.
 */
export function formatOdDateOption(dateStr) {
  if (!dateStr || isAllDateOption(dateStr)) return VISUALIZATION.common.filters.all;

  const raw = String(dateStr);
  if (!/^\d{8}$/.test(raw)) return raw;

  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const dateObj = new Date(`${y}-${m}-${d}`);
  const dayKanji = VISUALIZATION.common.weekdays.short[dateObj.getDay()];

  return `${y}/${m}/${d} (${dayKanji})`;
}
