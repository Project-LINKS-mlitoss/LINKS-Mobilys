// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Box, Typography } from "@mui/material";
import { UI } from "../../../constant/ui";
import { GTFS } from "../../../strings/domains/gtfs";

/**
 * Top summary section for validation report
 */
export default function GTFSValidationSummary({
    report,
    overrideScenarioName,
}) {
    const ui = GTFS.validationTab.validator.summary;
    const {
        scenario_id,
        scenario_name,
        validated_at,
        validator_version,
    } = report;

    const displayName =
        overrideScenarioName || scenario_name || ui.unnamedScenario;

    const dateStr = validated_at
        ? new Date(validated_at).toLocaleString(UI.gtfs.validator.validatedAtLocale)
        : ui.na;

    const blockingErrors = report?.blocking_errors || [];
    const warnings = report?.warnings || [];
    const infos = report?.infos || [];
    const legacyNotices = report?.notices || [];

    const unsafeNotices = [
        ...blockingErrors,
        ...warnings,
        ...infos,
        ...legacyNotices,
    ];

    const getNoticeCount = (n) => {
        if (!n) return 0;
        if (typeof n.totalNotices === "number") return n.totalNotices;
        if (typeof n.total_notices === "number") return n.total_notices;
        if (typeof n.notice_count === "number") return n.notice_count;
        if (typeof n.count === "number") return n.count;
        return 0;
    };

    const severities = ["ERROR", "WARNING", "INFO"];

    const severityCountsFE = severities.reduce((acc, sev) => {
        const sum = unsafeNotices
            .filter((n) => n?.severity === sev)
            .reduce((s, n) => s + getNoticeCount(n), 0);
        acc[sev] = sum;
        return acc;
    }, {});

    const totalNoticesFE = severities.reduce(
        (sum, sev) => sum + (severityCountsFE[sev] || 0),
        0
    );

    const totalNoticeGroupsFE = unsafeNotices.length;

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 1,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                backgroundColor: (theme) => theme.palette.background.paper,
            }}
        >
            <Typography variant="h6" gutterBottom>
                {ui.title}
            </Typography>

            <Typography variant="subtitle1" gutterBottom>
                {displayName}
            </Typography>

            <Typography variant="body2" color="text.secondary">
                {ui.validatedAtTemplate.replace("{date}", dateStr)}
            </Typography>
        </Box>
    );
}
