// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import * as React from "react";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import logo from "../assets/logo/MobilysLogo.png";
import { useLocation, useNavigate } from "react-router-dom";
import Collapse from "@mui/material/Collapse";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { logout } from "../services/userService";
import { useAuthStore } from "../state/authStore";
import Badge from "@mui/material/Badge";
import { getNotificationsData } from "../services/notificationService";
import NotificationPopover from "./NotificationPopover.jsx";
import { useSnackbarStore } from "../state/snackbarStore";
import CircularProgress from "@mui/material/CircularProgress";
import { UI } from "../constant/ui.js";
import { ERRORS, NAVIGATION } from "../strings/index.js";

const drawerWidth = 280;
const NOTIFICATIONS_LABEL = NAVIGATION.sideNavbar.items.notifications;



const sections = [
  {
    title: "",
    items: [
      {
        label: NAVIGATION.sideNavbar.items.notifications,
        icon: (
          <span className="material-symbols-outlined outlined">
            notifications
          </span>
        ),
        path: "",
      },
    ],
  },
  {
    title: NAVIGATION.sideNavbar.sections.home,
    items: [
      {
        label: NAVIGATION.sideNavbar.items.home,
        icon: (
          <span
            className="material-symbols-outlined outlined"
            style={{ fontSize: 24, verticalAlign: "middle" }}
            aria-label="home"
          >
            home
          </span>
        ),
        path: "/scenarios",
      },
    ],
  },
  {
    title: NAVIGATION.sideNavbar.sections.dataManagement,
    items: [
      {
        label: NAVIGATION.sideNavbar.items.gtfsImport,
        icon: (
          <span className="material-symbols-outlined outlined">
            upload_file
          </span>
        ),
        path: "/import-data",
      },
      {
        label: NAVIGATION.sideNavbar.items.additionalDataImport,

        icon: (
          <span className="material-symbols-outlined outlined">
            drive_folder_upload
          </span>
        ),
        path: "/additional-data",
      },
      {
        label: "かんたん便数編集",
        icon: (
          <span className="material-symbols-outlined">
            edit_square
          </span>
        ),
        path: "/sim/simple",
      },
      {
        label: NAVIGATION.sideNavbar.items.scenarioEdit,

        icon: (
          <span className="material-symbols-outlined outlined">
            edit_document
          </span>
        ),
        path: "/edit-data",
      },
    ],
  },
  {
    title: NAVIGATION.sideNavbar.sections.analysis,
    items: [
      {
        label: NAVIGATION.sideNavbar.items.visualization,
        icon: (
          <span className="material-symbols-outlined outlined">
            directions_bus
          </span>
        ),
        subItems: [
          { label: NAVIGATION.sideNavbar.items.routeTimetable, path: "/route-timetable" },
          { label: NAVIGATION.sideNavbar.items.numberOfBusRunning, path: "/number-of-bus-running-visualization" },
          { label: NAVIGATION.sideNavbar.items.bufferAnalysis, path: "/buffer-analysis" },
          { label: NAVIGATION.sideNavbar.items.roadNetworkAnalysisOsm, path: "/road-network-analysis" },
          { label: NAVIGATION.sideNavbar.items.roadNetworkAnalysisDrm, path: "/road-network-analysis-drm" },
          { label: NAVIGATION.sideNavbar.items.stopRadiusAnalysis, path: "/stop-radius-analysis" },
        ],
      },
      {
        label: NAVIGATION.sideNavbar.items.boardingAlightingAnalysis,
        icon: (
          <span className="material-symbols-outlined outlined">
            monitoring
          </span>
        ),
        path: "/boarding-alighting-analysis",
      },
      {
        label: NAVIGATION.sideNavbar.items.odAnalysis,
        icon: (
          <span className="material-symbols-outlined outlined">
            conversion_path
          </span>
        ),
        path: "/od-analysis",
      },
    ],
  },
  {
    title: NAVIGATION.sideNavbar.sections.simulation,
    items: [
      {
        label: NAVIGATION.sideNavbar.items.simulation,
        icon: (
          <span className="material-symbols-outlined outlined">
            text_compare
          </span>
        ),
        path: "/simulation",
      },
    ],
  },
  // footer (user_management/logout) is handled separately at the bottom
];

export default function SideNavbar({ closable = false, open, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const logoutState = useAuthStore((state) => state.logout);
  const username = useAuthStore((state) => state.username);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [openSubMenus, setOpenSubMenus] = React.useState({});
  const toggleSub = (key) => setOpenSubMenus((prev) => ({ ...prev, [key]: !prev[key] }));

  const [notifications, setNotifications] = React.useState([]);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const openPopover = Boolean(anchorEl);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  React.useEffect(() => {
    let timer;
    const fetchNotifications = async () => {
      try {
        const res = await getNotificationsData();
        setNotifications(res?.data?.data || []);
      } catch {
        setNotifications([]);
      }
    };
    fetchNotifications();
    timer = setInterval(fetchNotifications, UI.sideNavbar.notificationsPollIntervalMs);
    return () => clearInterval(timer);
  }, []);

  const handleNotificationClick = (event) => setAnchorEl(event.currentTarget);
  const handleNotificationClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    try {
      await logout(useAuthStore.getState().refresh);
      if (logoutState) logoutState();
      navigate("/login", { replace: true });
      window.location.reload();
    } catch {
      showSnackbar(ERRORS.auth.logoutFailed, "error");
    }
  };

  // All sections are visible to all users
  const visibleSections = sections;



  return (
    <>
      {closable && !open && (
        <IconButton
          edge="start"
          onClick={onToggle}
          sx={{ position: "fixed", top: 16, left: 16, zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant={closable ? "persistent" : "permanent"}
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          zIndex: (theme) => theme.zIndex.drawer + 2,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#fff",
            borderRight: "1px solid #f0f0f0",
            zIndex: (theme) => theme.zIndex.drawer + 2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          },
        }}
      >
        {/* top area */}
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
            }}
          >
            <img src={logo} alt="Mobilys Logo" style={{ height: 45 }} />
            {closable && (
              <IconButton onClick={onToggle}>
                <ChevronLeftIcon />
              </IconButton>
            )}
          </Box>

          {/* main sections */}
          <List sx={{ px: 0 }}>
            {visibleSections.map((section, idx) => (
              <Box key={section.title || `sec-${idx}`} sx={{ mb: 2 }}>
                {section.title && section.items.length > 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      pl: 3,
                      color: "#B0B0B0",
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      fontSize: 13,
                      mb: 1,
                      display: "block",
                    }}
                  >
                    {section.title}
                  </Typography>
                )}

                {section.items.map((item) => {
                  const isActive = item.path && location.pathname === item.path;
                  const hasSub = Array.isArray(item.subItems) && item.subItems.length > 0;

                  // お知らせ (always show)
                  if (item.label === NOTIFICATIONS_LABEL) {
                    return (
                      <React.Fragment key={item.label}>
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={handleNotificationClick}
                            sx={{ borderRadius: 2, py: 1.5, "&:hover": { bgcolor: "#E6F0FF" } }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 40,
                                color: "#222",
                                fontSize: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: 32,
                              }}
                            >
                              <span className="material-symbols-outlined outlined">
                                notifications
                              </span>
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box
                                  sx={{
                                    position: "relative",
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    height: 28,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 16,
                                      fontWeight: 500,
                                      color: "#717171",
                                    }}
                                  >
                                    {NOTIFICATIONS_LABEL}
                                  </span>
                                  {unreadCount > 0 && (
                                    <Badge
                                      badgeContent={unreadCount}
                                      color="error"
                                      sx={{
                                        position: "absolute",
                                        right: 0,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        "& .MuiBadge-badge": {
                                          fontSize: 13,
                                          minWidth: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          padding: 0,
                                          color: "#fff",
                                          backgroundColor: "#d32f2f",
                                        },
                                      }}
                                    />
                                  )}
                                </Box>
                              }
                            />
                          </ListItemButton>
                        </ListItem>

                        <NotificationPopover
                          open={openPopover}
                          anchorEl={anchorEl}
                          onClose={handleNotificationClose}
                          notifications={notifications}
                          setNotifications={setNotifications}
                          navigate={navigate}
                        />
                      </React.Fragment>
                    );
                  }


                  const visibleSubItems = hasSub ? item.subItems : [];

                  return (
                    <React.Fragment key={item.label}>
                      <ListItem disablePadding sx={{ mb: 0.5, "&:last-child": { mb: 0 } }}>
                        <ListItemButton
                          selected={isActive}
                          onClick={() => {
                            if (hasSub) {
                              toggleSub(item.label);
                            } else if (item.path) {
                              navigate(item.path);
                            }
                          }}
                          sx={{
                            borderRadius: 0,
                            py: 1.5,
                            pl: 3,
                            color: "#222",
                            "&:hover": { backgroundColor: "#F3F6FB" },
                            "& .MuiListItemIcon-root": { color: "#222" },
                            ...(isActive
                              ? {
                                backgroundColor: "#E6F0FF",
                                color: "#1976d2",
                                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                                  color: "#1976d2",
                                  fontWeight: 600,
                                },
                              }
                              : {}),
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: 16,
                              fontWeight: isActive ? 600 : 500,
                              color: isActive ? "#0077FF" : "#717171",
                            }}
                          />
                          {hasSub ? (openSubMenus[item.label] ? <ExpandLess /> : <ExpandMore />) : null}
                        </ListItemButton>
                      </ListItem>

                      {hasSub && (
                        <Collapse in={openSubMenus[item.label]} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding>
                            {visibleSubItems.map((sub) => (
                              <ListItemButton
                                key={sub.label}
                                sx={{ pl: 6 }}
                                selected={location.pathname === sub.path}
                                onClick={() => navigate(sub.path)}
                              >
                                <ListItemText primary={sub.label} />
                              </ListItemButton>
                            ))}
                          </List>
                        </Collapse>
                      )}
                    </React.Fragment>
                  );
                })}
              </Box>
            ))}
          </List>
        </Box>

        {/* footer: user-management + logout */}
        <List sx={{ px: 0, pb: 2, pt: 0 }}>
          {/* User info */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              sx={{
                borderRadius: 0,
                py: 1.5,
                pl: 3,
                color: "#222",
                "&:hover": { backgroundColor: "#F3F6FB" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <span className="material-symbols-outlined outlined">
                  account_circle
                </span>
              </ListItemIcon>
              <ListItemText
                primary={username || NAVIGATION.sideNavbar.accountFallback}
                primaryTypographyProps={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "#717171",
                  noWrap: true,
                }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 0,
                py: 1.5,
                pl: 3,
                bgcolor: "#F8F8F8",
                "&:hover": { bgcolor: "#E6F0FF" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: "#222", fontSize: 28 }}>
                <span className="material-symbols-outlined outlined">
                  logout
                </span>
              </ListItemIcon>
              <ListItemText
                primary={NAVIGATION.sideNavbar.items.logout}
                primaryTypographyProps={{ fontSize: 16, fontWeight: 500, color: "#222" }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
    </>
  );
}
