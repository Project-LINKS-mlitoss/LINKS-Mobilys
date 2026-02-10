export function DotTrip(props) {
  const { cx, cy, stroke } = props || {};
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const color = stroke || "#111827";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={color}
      stroke="#ffffff"
      strokeWidth={1.5}
    />
  );
}