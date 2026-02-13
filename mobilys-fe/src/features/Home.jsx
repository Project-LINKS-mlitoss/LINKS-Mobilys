// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Box, Typography } from "@mui/material";

import { HOME } from "../strings";

export default function Home() {
  return (
    <Box>
      <Typography variant="h4" component="h1">
        {HOME.title}
      </Typography>
    </Box>
  );
}
