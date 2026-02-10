/**
 * Formats a date string into a Japanese date-time format.
 * @param {*} dateString - The date string to format.
 * @returns The formatted date string.
 */
export function formatJPDateTime(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("ja-JP", {
        dateStyle: "short",
        timeStyle: "short",
        hour12: false,
    });
}

/**
 * Formats a date string into a Japanese date format (YYYY/MM/DD).
 * @param {*} dateString - The date string to format.
 * @returns The formatted date string.
 */
export function formatJPDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}

export function formatDateISO(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Formats a date or date-string into a compact, filename-safe
 * timestamp string: YYYYMMDD_HHmmss
 * - Avoids characters that are invalid on Windows (e.g. ":" "/")
 * - Returns empty string if the value cannot be parsed
 */
export function formatDateTimeForFilename(value) {
    if (!value) return "";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");

    return `${year}${month}${day}`;
}
