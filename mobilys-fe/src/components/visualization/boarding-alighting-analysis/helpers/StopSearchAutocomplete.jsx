// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Autocomplete, TextField } from "@mui/material";
import { VISUALIZATION } from "@/strings";
import { POPPER_Z } from "../../bus-running-visualization/MapVisualization";

export function StopSearchAutocomplete({
    stopOptions,
    selectedStop,
    setSelectedStop,
    searchInput,
    setSearchInput,
    extraSx = {},
    keyProp,
}) {
    return (
        <Autocomplete
            key={keyProp}
            options={stopOptions}
            value={selectedStop}
            onChange={(e, val) => setSelectedStop(val)}
            inputValue={searchInput}
            onInputChange={(e, val) => setSearchInput(val)}
            isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
            getOptionLabel={(opt) => (opt ? `${opt.label}` : "")}
            clearOnEscape
            disablePortal
            componentsProps={{ popper: { sx: { zIndex: POPPER_Z } } }}
            slotProps={{ popper: { sx: { zIndex: POPPER_Z } } }}
            sx={{
                width: 300,
                position: "absolute",
                top: 25,
                left: 55,
                zIndex: POPPER_Z,
                background: "#fff",
                boxShadow: 2,
                borderRadius: 2,
                ...extraSx,
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    size="small"
                    label={VISUALIZATION.common.map.labels.stopSelect}
                />
            )}
            data-html2canvas-ignore
        />
    );
}
