import { Box, Slider, Typography } from "@mui/material";
import { UI } from "../constant/ui.js";
import { LABELS } from "../strings/index.js";

function toJpHour(mins = 0) {
  const h = Math.floor(mins / 60);
  return `${h}${LABELS.common.hourSuffix}`;
}

function toHHmmDisplay(mins = 0) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = String(h).padStart(1, "0"); 
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function minutesToHHmmss(mins = 0, { isEnd = false } = {}) {
  if (isEnd && mins >= 24 * 60) return "23:59:59";
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(Math.round(mins % 60)).padStart(2, "0");
  return `${h}:${m}:00`;
}

export function minutesToHHmm(mins = 0, { isEnd = false } = {}) {
  if (isEnd && mins >= 24 * 60) return "23:59";
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(Math.round(mins % 60)).padStart(2, "0");
  return `${h}:${m}`;
}

export default function TimeRangeSlider({
  value = [0, UI.timeRangeSlider.dayMinutes],
  onChange = () => {},
  label = LABELS.common.timeRange,
}) {
  const [start, end] = Array.isArray(value) ? value : [0, UI.timeRangeSlider.dayMinutes];
  const displayStart = toHHmmDisplay(start);
  const displayEnd = end >= UI.timeRangeSlider.dayMinutes ? "24:00" : toHHmmDisplay(end);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">
        {label} {displayStart} - {displayEnd}
      </Typography>

      <Slider
        value={value}
        onChange={(_, v) => onChange(v)}
        min={0}
        max={UI.timeRangeSlider.dayMinutes}
        step={UI.timeRangeSlider.stepMinutes}
        marks={[0, 6, 12, 18, 24].map((h) => {
          const mins = h * 60;
          return { value: mins, label: toJpHour(mins) };
        })}
        valueLabelDisplay="off"            
        getAriaValueText={toJpHour}
      />
    </Box>
  );
}
