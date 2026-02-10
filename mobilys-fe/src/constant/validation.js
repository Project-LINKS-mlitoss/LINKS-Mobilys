/**
 * Validation constants.
 *
 * Purpose: store form validation limits and rules (min/max length, regex, numeric
 * limits) to keep them consistent and easy to adjust.
 */

export const VISUALIZATION_DEFAULTS = {
    walkingSpeedKmh: "4.8",
    roadNetwork: {
        maxWalkingDistanceM: 800,
        maxWalkingDistanceOptionsM: [300, 500, 800, 1000, 1500, 2000],
        graphBuildStatusStaleMs: 120_000,
        percentile: 50,
    },
    radiusAnalysis: {
        radiusM: 1000,
    },
    stopRadiusAnalysis: {
        radiusM: 300,
        minRadiusM: 0,
        maxRadiusM: 1000,
        stepRadiusM: 100,
    },
    bufferAnalysis: {
        timeIntervalsMinutes: [10, 20, 30, 40, 50, 60, 70, 80, 90],
        defaultActiveIntervalIndex: 8,
    },
};

export const VALIDATION = {
    VISUALIZATION_DEFAULTS,
    auth: {
        usernameMaxLen: 254,
        passwordNoSpacesRegex: /^\S*$/,
    },
    gtfs: {
        routeGroup: {
            nameMaxLen: 100,
        },
    },
    ridership: {
        upload: {
            maxFileSizeBytes: 50 * 1024 * 1024,
            acceptedExtensions: [".xlsx", ".xls", ".csv"],
            toleranceOptionsMinutes: [0, 5, 10, 15, 20],
            defaultToleranceMinutes: 5,
        },
    },
    userManagement: {
        minUsernameLen: 3,
        minPasswordLen: 8,
    },
};
