import { VISUALIZATION } from "@/strings";

/**
 * Parse YYYYMMDD string to Date object
 * @param {string|number} s - Date string in YYYYMMDD format
 * @returns {Date|null} - Date object or null if invalid
 */
export function parseYyyymmdd(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (str.length !== 8) return null;
  const y = Number(str.slice(0, 4));
  const m = Number(str.slice(4, 6)) - 1;
  const d = Number(str.slice(6, 8));
  if (!y || !d) return null;
  return new Date(y, m, d);
}

/**
 * Format date as MM-DD(Day) - e.g., "03-01(Sat)"
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string
 */
export function formatDateLabel(date) {
  if (!date) return "";
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = VISUALIZATION.common.weekdays.short[date.getDay()];
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${mm}-${dd}(${w})`;
}

/**
 * Format date as YYYY年MM月DD日
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string
 */
export function formatDateYMD(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${VISUALIZATION.common.dateParts.yearSuffix}${m}${VISUALIZATION.common.dateParts.monthSuffix}${d}${VISUALIZATION.common.dateParts.daySuffix}`;
}
