// This file contains utility functions for text manipulation
// such as truncating text to a specified length and formatting text to be more readable.

/**
 * Trims the text to a specified length and adds ellipsis if it exceeds that length.
 * @param {string} text - The text to be trimmed.
 * @param {number} maxLength - The maximum length of the text. Default is 24.
 * @return {string} - The trimmed text with ellipsis if it was longer than maxLength.
 */
export function trimText(text, maxLength = 24) {
    if (!text) return "";
    return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

/**
 * Normalize section label display (e.g. 運行区間).
 * Replace all ASCII tildes "~" with hyphen "-" for consistent UI.
 * Does not mutate the original value.
 *
 * @param {string | any} value
 * @returns {string | any}
 */
export function formatSectionLabel(value) {
    return typeof value === "string" ? value.replace(/~/g, " - ") : value;
}
