// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * UI constants.
 *
 * Purpose: store commonly used UI values (colors, sizes, z-index, durations,
 * breakpoints) to keep them consistent and easy to change.
 */

export const STORAGE_KEYS = {
    selectedScenarioVisualization: "selected-scenario-visualization",
};

export const VISUALIZATION_LAYOUT = {
    pageHeight: "86vh",
    pageMarginTop: -4,
    headerHeight: 72,
    leftPanel: {
        defaultRatio: 0.35,
        expandedRatio: 0.65,
        minWidthPx: 320,
        maxWidthPx: 900,
    },
    routeTimetable: {
        detailsModalMinWidthPx: 600,
    },
    tables: {
        rowIndexColWidthPx: 60,
        statusColWidthPx: 120,
    },
};

export const Z_INDEX = {
    visualization: {
        busRunningBackdrop: 6002,
        busRunningDialog: 6001,
        busRunningDialogContent: 6009,
        odFilterBackdrop: 6003,
        analysisDialog: 9000,
        globalLoadingBackdrop: 15000,
    },
};

export const POLLING_INTERVAL_MS = {
    roadNetworkGraphStatus: 5000,
};

export const PAGE_BANNER_UI = {
    tintedBgAlpha: 0.06,
    tintedBorderAlpha: 0.25,
    overflowTolerancePx: 2,
    fallbackLineHeightPx: 20,
    textColor: "#6d6b6bff",
};

export const TIME = {
    minutesPerDay: 24 * 60,
    secondsPerMinute: 60,
    secondsPerHour: 60 * 60,
    metersPerKm: 1000,
};

export const UI = {
    STORAGE_KEYS,
    VISUALIZATION_LAYOUT,
    Z_INDEX,
    POLLING_INTERVAL_MS,
    PAGE_BANNER_UI,
    TIME,
    homeTile: {
        heightPx: 220,
        widthPx: 300,
    },
    gtfs: {
        fallbackDash: "—",
        validator: {
            maxNoticeGroups: 50,
            maxSampleRows: 50,
            validatedAtLocale: "ja-JP",
        },
        import: {
            errorModal: {
                maxRows: 500,
                zIndexOffset: 10000,
                backdropZIndexOffset: 9999,
            },
        },
    },
    ridership: {
        fallbackDash: "-",
        uploadList: {
            tableMinWidthPx: 1080,
            actionButtonHeightPx: 36,
            iconButtonMinWidthPx: 40,
            iconButtonHeightPx: 36,
        },
        uploadDetail: {
            rawTableMaxHeightPx: 320,
            rawKeyColWidthPx: 240,
            affectedRowsPreviewLimit: 10,
        },
    },
    userManagement: {
        fallbackDash: "—",
        projectTab: {
            iconColWidthPx: 48,
            indentPerLevelPx: 12,
        },
        rolesTab: {
            createdAtColWidthPx: 220,
        },
    },
    login: {
        noProjectValue: "__NO_PROJECT__",
        page: {
            minHeight: "80vh",
            backgroundColor: "#ffffff",
            paddingX: 2,
        },
        header: {
            marginBottom: 4,
            titleMarginTop: 2,
            titleFontWeight: "bold",
        },
        logo: {
            widthPx: 350,
        },
        button: {
            marginTop: 2,
        },
        progress: {
            submitSizePx: 20,
            confirmSizePx: 18,
        },
        alert: {
            marginTop: 3,
        },
        projectSelect: {
            stackSpacing: 2,
            stackMarginTop: 1,
        },
    },
    timing: {
        exportCompleteSnackbarDelayMs: 2500,
    },
    emptyState: {
        paddingY: "40px 0",
        imageWidthPx: 120,
        imageMarginBottomPx: 16,
        imageOpacity: 0.7,
        textColor: "#232A3D",
        textFontSizePx: 18,
        textFontWeight: 500,
        letterSpacing: 0.2,
    },
    fileUploader: {
        backgroundColor: "#f6fbfd",
        borderRadius: 2,
        minHeightPx: 140,
        paddingX: "2px",
        borderWidthPx: 2,
        borderColorDefault: "#e3e6ec",
        borderColorDragActive: "#90caf9",
        transitionBorder: "border-color .15s ease",
        disabledOpacity: 0.7,
        iconFontSizePx: 56,
        filenameTrimLength: 30,
        filenameText: {
            fontSizePx: 16,
            color: "#222",
        },
        acceptText: {
            fontSizePx: 13,
            colorDefault: "#888",
            colorError: "#d32f2f",
        },
        disabledOverlay: {
            bgcolor: "rgba(255,255,255,0.8)",
            zIndex: 5,
            textColor: "#aaa",
            textFontSizePx: 17,
            textFontWeight: 500,
        },
    },
    fileUploadStatus: {
        widthPx: 420,
        padding: 4,
        borderRadius: 2,
        backgroundColor: "#f6fbfd",
        imageWidthPx: 50,
        imageOpacity: 0.7,
        filenameTrimLength: 30,
        importingColor: "#888",
        successColor: "#4caf50",
        errorColor: "#d32f2f",
    },
    globalSnackbar: {
        autoHideDurationMs: 2500,
        maxWidthPx: 430,
        padding: 2,
        titleMarginBottom: 1,
        longContent: {
            maxChars: 60,
            maxLines: 3,
            maxHeightPx: 120,
            scrollbarWidthPx: 7,
        },
        copyIconColor: "#888",
    },
    mapLayerButton: {
        fab: {
            rightPx: 12,
            bottomPx: 12,
            zIndex: 1000,
            sizePx: 40,
            borderRadius: 3,
            bgColor: "#fff",
            shadow: "0 6px 16px rgba(0,0,0,.22)",
        },
        popover: {
            panelWidthPx: 200,
            cardWidthPx: 46,
            thumbnailHeightPx: 56,
            bgColor: "rgba(255,255,255,.96)",
            shadow: "0 10px 28px rgba(0,0,0,.20)",
        },
        selected: {
            borderColor: "#111",
            shadow: "0 4px 14px rgba(0,0,0,.16)",
        },
        unselected: {
            borderColor: "#e5e5e5",
            labelColor: "#bdbdbd",
            hoverShadow: "0 6px 16px rgba(0,0,0,.16)",
        },
    },
    notificationPopover: {
        minWidthPx: 320,
        maxWidthPx: 400,
        unreadBgColor: "#f3f6fd",
        hoverBgColor: "#e3eafc",
    },
    sideNavbar: {
        drawerWidthPx: 280,
        notificationsPollIntervalMs: 10000,
    },
    timeRangeSlider: {
        dayMinutes: 24 * 60,
        stepMinutes: 60,
    },
};
