// TableCols.jsx
import React from "react";

/**
 * EqualColGroup
 * Makes columns equal width *within this table only*.
 *
 * @param {number} cols          Total number of columns in this table (including any trailing auto col).
 * @param {number} leadingPx     Optional fixed px width for a leading column (e.g., expand icon). 0 = none.
 * @param {boolean} trailingAuto If true, the LAST column is auto-width; the others are equal %.
 */
export function EqualColGroup({ cols, leadingPx = 0, trailingAuto = false }) {
  if (!Number.isFinite(cols) || cols <= 0) {
    throw new Error("EqualColGroup: 'cols' must be a positive number.");
  }

  // If trailingAuto: last col is auto; equalize the first (cols - 1).
  const equalCount = trailingAuto ? cols - 1 : cols;
  const pct = `${100 / equalCount}%`;

  return (
    <colgroup>
      {leadingPx > 0 && <col style={{ width: `${leadingPx}px` }} />}
      {Array.from({ length: equalCount }).map((_, i) => (
        <col key={`eq-${i}`} style={{ width: pct }} />
      ))}
      {trailingAuto && <col />} {/* auto-width last col */}
    </colgroup>
  );
}

export const cellTextSx = {
  whiteSpace: { xs: "normal", sm: "nowrap" },
  overflow: "hidden",
  textOverflow: "ellipsis",
  wordBreak: "break-word",
};
  