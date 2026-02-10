import { useCallback, useMemo, useState } from "react";
import html2canvas from "html2canvas";

function waitNextPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setInteractionsEnabled(map, enabled) {
  if (!map) return;
  const fn = enabled ? "enable" : "disable";
  map.dragging?.[fn]?.();
  map.touchZoom?.[fn]?.();
  map.scrollWheelZoom?.[fn]?.();
  map.doubleClickZoom?.[fn]?.();
  map.boxZoom?.[fn]?.();
  map.keyboard?.[fn]?.();
}

async function refreshMap(mapRef, tileLayerRef) {
  window.dispatchEvent(new Event("resize"));
  mapRef?.current?.invalidateSize?.({ animate: false });
  tileLayerRef?.current?.redraw?.();
  mapRef?.current?.eachLayer?.((l) => l?.redraw?.());
  await waitNextPaint();
  await waitNextPaint();
}

function waitTilesLoaded(tileLayerRef) {
  const tl = tileLayerRef?.current;
  if (!tl) return Promise.resolve();
  const pending = tl._tilesToLoad ?? 0;
  if (pending === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const onLoad = () => {
      tl.off?.("load", onLoad);
      resolve();
    };
    tl.on?.("load", onLoad);
  });
}

function normalizeClone({
  doc,
  width,
  height,
  liveMap,
  rootSelector,
  solidifyMaterialSymbolsInLeafletDivIcons,
  legendSelector,
}) {
  doc.querySelectorAll("[data-html2canvas-ignore]").forEach((el) => el.remove());

  const hideSelectors = [
    ".leaflet-control-container",
    ".leaflet-control",
    ".leaflet-control-attribution",
    ".leaflet-pane.leaflet-popup-pane",
    ".leaflet-pane.leaflet-tooltip-pane",
  ];
  hideSelectors.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => {
      el.style.display = "none";
    });
  });

  const root =
    (rootSelector ? doc.querySelector(rootSelector) : null) ||
    doc.querySelector("[data-map-root]") ||
    doc.querySelector(".leaflet-container")?.closest("[data-map-root]") ||
    doc.body.firstElementChild ||
    doc.body;

  if (root) {
    root.style.position = "relative";
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    root.style.maxWidth = "none";
    root.style.maxHeight = "none";
    root.style.margin = "0";
    root.style.transform = "";

    const clearDim = (el) => {
      el.style.opacity = "1";
      el.style.mixBlendMode = "normal";
      return el;
    };
    clearDim(root);
    root.querySelectorAll("*").forEach(clearDim);
  }

  const clonedMap = doc.querySelector(".leaflet-container");
  if (clonedMap) {
    clonedMap.style.width = `${width}px`;
    clonedMap.style.height = `${height}px`;
    clonedMap.style.maxWidth = "none";
    clonedMap.style.maxHeight = "none";
    clonedMap.style.transform = "";
  }

  const livePane = liveMap?.getPane?.("tilePane");
  const liveCS = livePane ? window.getComputedStyle(livePane) : null;
  const liveOpacity = (liveCS?.opacity || "1").trim();

  const style = doc.createElement("style");
  style.textContent = `
    .leaflet-tile {
      transition: none !important;
      opacity: ${liveOpacity} !important;
    }
    .leaflet-fade-anim .leaflet-tile {
      transition: none !important;
    }
  `;
  doc.head.appendChild(style);

  if (solidifyMaterialSymbolsInLeafletDivIcons) {
    const markerSpans = doc.querySelectorAll(
      ".leaflet-div-icon .material-symbols-outlined.filled, " +
        ".leaflet-div-icon .material-symbols-rounded.filled, " +
        ".leaflet-div-icon .material-symbols-sharp.filled"
    );

    markerSpans.forEach((span) => {
      const inlineStyle = span.style || {};
      const fontSize = parseFloat(inlineStyle.fontSize || "24") || 24;
      const color = inlineStyle.color || "#e53935";

      span.textContent = "";
      span.style.fontFamily = "inherit";
      span.style.fontVariationSettings = "";
      span.style.background = color;
      span.style.borderRadius = "50%";
      span.style.width = `${fontSize}px`;
      span.style.height = `${fontSize}px`;
      span.style.display = "inline-block";
      span.style.lineHeight = `${fontSize}px`;
      span.style.color = "transparent";
      span.style.boxShadow = "0 0 2px rgba(0,0,0,0.4)";
    });
  }

  if (legendSelector) {
    doc.querySelectorAll(legendSelector).forEach((card) => {
      card.style.backgroundColor = "#ffffff";
      card.style.opacity = "1";
      card.style.mixBlendMode = "normal";
      card.querySelectorAll("*").forEach((child) => {
        if (!child.style) return;
        child.style.opacity = child.style.opacity || "1";
        child.style.mixBlendMode = child.style.mixBlendMode || "normal";
      });
    });
  }
}

async function captureToCanvas({
  container,
  mapRef,
  rootSelector,
  solidifyMaterialSymbolsInLeafletDivIcons,
  legendSelector,
  onClone,
}) {
  await waitNextPaint();

  const rect = container.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const exportScale = Math.min(window.devicePixelRatio || 2, 2);

  return await html2canvas(container, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    scale: exportScale,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    removeContainer: true,
    imageTimeout: 0,
    onclone: (doc) => {
      normalizeClone({
        doc,
        width,
        height,
        liveMap: mapRef?.current,
        rootSelector,
        solidifyMaterialSymbolsInLeafletDivIcons,
        legendSelector,
      });
      onClone?.(doc, { width, height });
    },
  });
}

async function downloadCanvasAsPng(canvas, filename) {
  await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Blob creation failed"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png", 1);
  });
}

export function useMapExport({
  containerRef,
  mapRef,
  tileLayerRef,
  getFilename,
  lastInteractionTime = 0,
  cooldownMs = 5000,
  postTilesDelayMs = 3000,
  rootSelector,
  solidifyMaterialSymbolsInLeafletDivIcons = false,
  legendSelector,
  onClone,
}) {
  const [exporting, setExporting] = useState(false);

  const exportPng = useCallback(async () => {
    const container = containerRef?.current;
    if (!container) throw new Error("capture root not found");
    if (exporting) return;

    try {
      setExporting(true);
      setInteractionsEnabled(mapRef?.current, false);

      await refreshMap(mapRef, tileLayerRef);
      await waitTilesLoaded(tileLayerRef);

      const sinceInteraction = Date.now() - (lastInteractionTime || 0);
      if (sinceInteraction < cooldownMs) {
        await waitMs(cooldownMs - sinceInteraction);
      }

      await waitMs(postTilesDelayMs);

      const canvas = await captureToCanvas({
        container,
        mapRef,
        rootSelector,
        solidifyMaterialSymbolsInLeafletDivIcons,
        legendSelector,
        onClone,
      });

      const filename = typeof getFilename === "function" ? getFilename() : "map.png";
      await downloadCanvasAsPng(canvas, filename);
    } finally {
      setInteractionsEnabled(mapRef?.current, true);
      setExporting(false);
    }
  }, [
    containerRef,
    cooldownMs,
    exporting,
    getFilename,
    lastInteractionTime,
    legendSelector,
    mapRef,
    onClone,
    postTilesDelayMs,
    rootSelector,
    solidifyMaterialSymbolsInLeafletDivIcons,
    tileLayerRef,
  ]);

  return useMemo(() => ({ exporting, exportPng }), [exportPng, exporting]);
}

