// src/components/gtfs/GTFSValidationNoticeDetail.jsx
import React from "react";
import {
    Box,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Link,
} from "@mui/material";
import { UI } from "../../../constant/ui";
import { GTFS } from "../../../strings/domains/gtfs";

/**
 * Detail block for a single notice:
 * - Title / code
 * - HTML description
 * - Docs link
 * - Sample records as dynamic table
 */
export default function GTFSValidationNoticeDetail({
    notice,
    descriptionOverride,
    descriptionAsHtml = true,
}) {
    const ui = GTFS.validationTab.validator.noticeDetail;
    const {
        code,
        title,
        description,
        totalNotices,
        sampleNotices,
        sampleFields,
    } = notice;
    const maxDisplayRows = UI.gtfs.validator.maxSampleRows;

    const docsUrl = `https://gtfs-validator.mobilitydata.org/rules.html#${encodeURIComponent(
        code
    )}-rule`;

    const samples = Array.isArray(sampleNotices) ? sampleNotices : [];
    const displayCount = Math.min(samples.length, maxDisplayRows);
    const displayedSamples = samples.slice(0, maxDisplayRows);
    const totalCount =
        typeof totalNotices === "number" && totalNotices > 0
            ? totalNotices
            : samples.length;
    const showLimitNotice =
        displayCount > 0 &&
        (totalCount > displayCount || samples.length > displayCount);

    // Start from sampleFields if BE provides them
    let fields = Array.isArray(sampleFields) ? [...sampleFields] : [];

    // Fallback: if no sampleFields, infer columns from sampleNotices
    if (!fields.length && samples.length) {
        const keySet = new Set();
        samples.forEach((sample) => {
            if (!sample) return;
            Object.keys(sample).forEach((k) => {
            keySet.add(k);
            });
        });
        fields = Array.from(keySet);
    }

    const detailDescription = descriptionOverride ?? description;

    return (
        <Box>
            <Typography variant="subtitle1" gutterBottom>
                {title || code}
            </Typography>

            {detailDescription && (
                <Box
                    sx={{
                        mb: 1.5,
                        borderTop: "4px solid #000",
                        borderBottom: "4px solid #000",
                        p: 1,
                        maxHeight: 280,
                        overflow: "auto",
                    }}
                >
                    {descriptionAsHtml ? (
                        <div
                            // Backend must sanitize this HTML.
                            dangerouslySetInnerHTML={{ __html: detailDescription }}
                        />
                    ) : (
                        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                            {detailDescription}
                        </Typography>
                    )}
                </Box>
            )}

            <Typography variant="body2" sx={{ mb: 1 }}>
                {ui.docsLink.prefix}
                <Link href={docsUrl} target="_blank" rel="noreferrer">
                    {ui.docsLink.linkText}
                </Link>
                {ui.docsLink.suffix}
            </Typography>

            {showLimitNotice && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                >
                    {ui.limitTemplate
                        .replace("{total}", totalCount.toLocaleString())
                        .replace("{display}", displayCount.toLocaleString())}
                </Typography>
            )}

            {fields.length > 0 && displayedSamples.length > 0 ? (
                <Box sx={{ mt: 1, overflowX: "auto" }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {fields.map((field) => (
                                    <TableCell key={field}>
                                        <Typography
                                            variant="caption"
                                            fontWeight="bold"
                                        >
                                            {field}
                                        </Typography>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayedSamples.map((sample, idx) => (
                                <TableRow key={idx}>
                                    {fields.map((field) => (
                                        <TableCell key={field}>
                                            <Typography variant="caption">
                                                {sample[field] != null
                                                    ? String(sample[field])
                                                    : ui.na}
                                            </Typography>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    {ui.noSamples}
                </Typography>
            )}
        </Box>
    );
}
