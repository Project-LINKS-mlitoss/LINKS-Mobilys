import React from "react";
import { UI } from "../constant/ui.js";
import { MESSAGES } from "../strings/index.js";

export default function EmptyState({ message = MESSAGES.info.noData, image }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: UI.emptyState.paddingY,
      }}>
      <img
        src={image}
        alt="Empty Data"
        style={{
          width: UI.emptyState.imageWidthPx,
          marginBottom: UI.emptyState.imageMarginBottomPx,
          opacity: UI.emptyState.imageOpacity,
        }}
        draggable={false}
      />
      <div
        style={{
          color: UI.emptyState.textColor,
          fontSize: UI.emptyState.textFontSizePx,
          fontWeight: UI.emptyState.textFontWeight,
          letterSpacing: UI.emptyState.letterSpacing,
          textAlign: "center",
        }}>
        {message}
      </div>
    </div>
  );
}
