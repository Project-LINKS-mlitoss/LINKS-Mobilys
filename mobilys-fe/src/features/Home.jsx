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
