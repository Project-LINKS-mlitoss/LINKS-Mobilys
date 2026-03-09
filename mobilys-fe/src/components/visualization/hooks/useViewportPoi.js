// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useState, useCallback, useRef } from "react";
import {
    getPOIsByBBox,
    getUserPOIsByBBox,
} from "../../../api/visualizationApi";
import { VISUALIZATION } from "@/strings";

/**
 * Custom hook for managing viewport-based POI fetching
 *
 * Extracts POI data fetching logic from ViewportPoiLayer component.
 * Handles caching, debouncing, and state management for POI features.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.scenarioId - Current scenario ID
 * @param {string} options.datasetId - Dataset ID filter
 * @param {Array} options.categories - Category filters
 * @param {boolean} options.showMLIT - Show MLIT POIs (hospital, school)
 * @param {boolean} options.showCustom - Show custom user POIs
 * @param {number} options.minPointZoom - Minimum zoom level to show POIs
 *
 * @returns {Object} Hook state and methods
 * @returns {Array} features - Array of POI features
 * @returns {boolean} loading - Loading state
 * @returns {Error|null} error - Error state
 * @returns {Function} fetchPois - Manual fetch trigger
 * @returns {Function} clearCache - Clear cached data
 */
export function useViewportPoi({
    scenarioId,
    datasetId,
    categories,
    showMLIT = true,
    showCustom = true,
    minPointZoom = 9,
}) {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const cacheRef = useRef(new Map());

    const buildCacheKey = useCallback(() => {
        return [
            scenarioId || "none",
            datasetId || "all",
            categories ? JSON.stringify(categories) : "no-cat",
            showMLIT ? "mlit" : "no-mlit",
            showCustom ? "custom" : "no-custom",
        ].join("|");
    }, [scenarioId, datasetId, categories, showMLIT, showCustom]);

    const fetchPois = useCallback(
        async (currentZoom) => {
            // Skip if zoom too low
            if (currentZoom < minPointZoom) {
                setFeatures([]);
                return;
            }

            // Skip if no scenario
            if (!scenarioId) {
                setFeatures([]);
                return;
            }

            const cacheKey = buildCacheKey();

            // Return cached data if available
            if (cacheRef.current.has(cacheKey)) {
                setFeatures(cacheRef.current.get(cacheKey));
                return;
            }

            // Fetch from API
            setLoading(true);
            setError(null);

            try {
                const baseParams = {};
                if (categories) baseParams.categories = categories;

                const [mlitHosp, mlitSchool, customRes] = await Promise.all([
                    showMLIT
                        ? getPOIsByBBox(scenarioId, {
                              ...baseParams,
                              dataset_id: "nlni_ksj-p04",
                          })
                        : Promise.resolve({ items: [] }),
                    showMLIT
                        ? getPOIsByBBox(scenarioId, {
                              ...baseParams,
                              dataset_id: "nlni_ksj-p29",
                          })
                        : Promise.resolve({ items: [] }),
                    showCustom
                        ? getUserPOIsByBBox(scenarioId, {
                              ...baseParams,
                              ...(datasetId ? { dataset_id: datasetId } : {}),
                          })
                        : Promise.resolve({ items: [] }),
                ]);

                const rawItems = [
                    ...(mlitHosp?.items ?? mlitHosp?.data?.items ?? []),
                    ...(mlitSchool?.items ?? mlitSchool?.data?.items ?? []),
                    ...(customRes?.items ?? customRes?.data?.items ?? []),
                ];

                // Process and deduplicate features
                const seen = new Set();
                const processedFeatures = [];

                for (const item of rawItems) {
                    const title =
                        String(item.title ?? item.name ?? "").trim() ||
                        VISUALIZATION.common.poiTypes.unknown;
                    const lat = Number(item.lat);
                    const lon = Number(item.lon);

                    if (!Number.isFinite(lat) || !Number.isFinite(lon))
                        continue;

                    const source = (
                        item.dataset_id ??
                        item.source ??
                        "custom"
                    ).toString();
                    let internalType = (item.type ?? item.category ?? "")
                        .toString()
                        .trim();

                    // For MLIT data, assign internal type
                    if (source !== "custom") {
                        internalType = assignInternalType(item) ?? internalType;
                        // Only include hospital and school from MLIT
                        if (
                            internalType &&
                            internalType !==
                                VISUALIZATION.common.poiTypes.hospital &&
                            internalType !==
                                VISUALIZATION.common.poiTypes.school
                        )
                            continue;
                    }

                    // Deduplicate by location and title
                    const key = `${title.toLowerCase()}_${round(lat, 5)}_${round(lon, 5)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    processedFeatures.push({
                        id: item.id ?? key,
                        title,
                        lat,
                        lon,
                        category: internalType || null,
                        source,
                        address: item.address ?? null,
                    });
                }

                // Cache the results
                cacheRef.current.set(cacheKey, processedFeatures);
                setFeatures(processedFeatures);
            } catch (err) {
                console.error("[useViewportPoi] Fetch error:", err);
                setError(err);
                setFeatures([]);
            } finally {
                setLoading(false);
            }
        },
        [
            scenarioId,
            datasetId,
            categories,
            showMLIT,
            showCustom,
            minPointZoom,
            buildCacheKey,
        ],
    );

    const clearCache = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    return {
        features,
        loading,
        error,
        fetchPois,
        clearCache,
    };
}

// Helper functions (copied from ViewportPoiLayer for consistency)
const round = (v, p = 4) => Math.round(v * 10 ** p) / 10 ** p;

// EN → JP mapping for MLIT data
const EN_TO_INTERNAL = {
    school: VISUALIZATION.common.poiTypes.school,
    hospital: VISUALIZATION.common.poiTypes.hospital,
    cafe: VISUALIZATION.common.poiTypes.cafe,
    park: VISUALIZATION.common.poiTypes.park,
    museum: VISUALIZATION.common.poiTypes.museum,
    shopping: VISUALIZATION.common.poiTypes.shopping,
    restaurant: VISUALIZATION.common.poiTypes.restaurant,
    supermarket: VISUALIZATION.common.poiTypes.supermarket,
};

const DATASET_FALLBACK = {
    "nlni_ksj-p04": VISUALIZATION.common.poiTypes.hospital,
    "nlni_ksj-p29": VISUALIZATION.common.poiTypes.school,
};

function assignInternalType(item) {
    const jp = (item.type ?? item.category ?? item.category_jp ?? "")
        .toString()
        .trim();

    // Check if we have a POI icon config for this type
    // (We'll assume POI_ICON_CONFIG is imported in the component)
    if (jp) return jp;

    const en = (item.category_en ?? item.category ?? item.type ?? "")
        .toString()
        .trim()
        .toLowerCase();
    if (en && EN_TO_INTERNAL[en]) return EN_TO_INTERNAL[en];

    const ds = (item.dataset_id ?? "").toString().trim();
    if (ds && DATASET_FALLBACK[ds]) return DATASET_FALLBACK[ds];

    return null;
}
