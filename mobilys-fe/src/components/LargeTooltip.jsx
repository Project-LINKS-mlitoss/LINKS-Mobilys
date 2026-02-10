import Tooltip, { tooltipClasses } from "@mui/material/Tooltip";
import { styled } from "@mui/material/styles";

const StyledTooltip = styled(({ className, ...props }) => (
  <Tooltip
    {...props}
    placement="bottom"
    arrow
    classes={{ popper: className }}
  />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: "#fff",
    color: "#333",
    boxShadow: theme.shadows[2],
    borderRadius: 10,
    fontSize: 16,
    padding: "12px 18px",
    textAlign: "left",
    lineHeight: 1.5,
    maxWidth: 360,
    fontWeight: 500,
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: "#fff",
  },
}));

// Props:
// - title: tooltip content
// - props: element trigger (icon, button, dsb)
const LargeTooltip = ({ title, ...props }) => (
  <StyledTooltip title={title} {...props}></StyledTooltip>
);

export default LargeTooltip;
