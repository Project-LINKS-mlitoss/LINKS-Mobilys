// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import CircularProgress from "@mui/material/CircularProgress";
import { readNotificationData, readAllNotificationsData, getNotificationsDetailData } from "../services/notificationService";
import { useSnackbarStore } from "../state/snackbarStore";
import ErrorDetailsModal from "./ErrorDetailsModal";
import { UI } from "../constant/ui.js";
import { NOTIFICATION } from "../strings/index.js";

export default function NotificationPopover({
  open,
  anchorEl,
  onClose,
  notifications,
  setNotifications,
  navigate,
}) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  
  // State for error details modal
  const [errorModalOpen, setErrorModalOpen] = React.useState(false);
  const [selectedNotification, setSelectedNotification] = React.useState(null);
  const [loadingNotificationId, setLoadingNotificationId] = React.useState(null);

  const handleMarkAllAsRead = async () => {
    try {
      await readAllNotificationsData();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showSnackbar({
        title: NOTIFICATION.popover.snackbar.markAllReadSuccess,
        severity: "success",
      });
    } catch {
      showSnackbar({
        title: NOTIFICATION.popover.snackbar.markAllReadFailed,
        severity: "error",
      });
    }
  };

  // Check if notification is an error type
  const isErrorNotification = (notif) => {
    return notif.description?.toLowerCase().includes("error");
  };

  const handleNotificationClick = async (notif) => {
    // Mark as read
    if (!notif.is_read) {
      try {
        await readNotificationData(notif.id, { is_read: true });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch {
        showSnackbar(NOTIFICATION.popover.snackbar.markReadFailed, "error");
      }
    }

    // Error notification → open modal with details
    if (isErrorNotification(notif)) {
      setLoadingNotificationId(notif.id);
      try {
        const response = await getNotificationsDetailData({ notification_id: notif.id });
        const detailData = response?.data?.data || response?.data || response;

        if (detailData) {
          setSelectedNotification(detailData);
          setErrorModalOpen(true);
        } else {
          showSnackbar({
            title: NOTIFICATION.popover.snackbar.detailUnavailable,
            severity: "error",
          });
        }
      } catch (error) {
        console.error("Failed to fetch notification detail:", error);
        showSnackbar({
          title: NOTIFICATION.popover.snackbar.detailFetchFailed,
          severity: "error",
        });
      } finally {
        setLoadingNotificationId(null);
      }
      return;
    }

    // Snackbar-type notification (e.g. scenario already deleted)
    if (notif.screen_menu === "snackbar") {
      const message =
        notif.error_response?.message ||
        NOTIFICATION.popover.snackbar.scenarioDeletedFallback;

      showSnackbar({
        title: message,
        severity: "error",
      });

      onClose();
      return;
    }

    // Navigate to notification_path if it exists
    if (notif.notification_path) {
      onClose();
      navigate(notif.notification_path);
    }
  };

  const handleErrorModalClose = () => {
    setErrorModalOpen(false);
    setSelectedNotification(null);
  };

  const getNotificationIcon = (notif) => {
    if (isErrorNotification(notif)) {
      return (
        <span
          className="material-symbols-outlined outlined"
          style={{
            color: "#E53935",
            fontSize: 22,
            lineHeight: 1,
            verticalAlign: "middle",
          }}
        >
          error
        </span>
      );
    }

    return (
      <span
        className="material-symbols-outlined outlined"
        style={{
          color: "#1976D2",
          fontSize: 22,
          lineHeight: 1,
          verticalAlign: "middle",
        }}
      >
        info
      </span>
    );
  };

  return (
    <>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            minWidth: UI.notificationPopover.minWidthPx,
            maxWidth: UI.notificationPopover.maxWidthPx,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              {NOTIFICATION.popover.title}
            </Typography>
            {unreadCount > 0 && (
              <IconButton
                size="small"
                onClick={handleMarkAllAsRead}
                sx={{ ml: 1 }}
                title={NOTIFICATION.popover.markAllReadTitle}
              >
                <Typography variant="caption" color="primary">
                  {NOTIFICATION.popover.markAllRead}
                </Typography>
              </IconButton>
            )}
          </Box>

          {notifications.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {NOTIFICATION.popover.empty}
            </Typography>
          ) : (
            <List dense>
              {notifications.map((notif) => {
                const icon = getNotificationIcon(notif);
                const isError = isErrorNotification(notif);
                const isLoading = loadingNotificationId === notif.id;

                return (
                  <ListItem
                    key={notif.id}
                    alignItems="center"
                    sx={{
                      bgcolor: notif.is_read
                        ? "inherit"
                        : UI.notificationPopover.unreadBgColor,
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: isLoading ? "wait" : "pointer",
                      opacity: isLoading ? 0.7 : 1,
                      "&:hover": { bgcolor: UI.notificationPopover.hoverBgColor },
                    }}
                    onClick={() => !isLoading && handleNotificationClick(notif)}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 36,
                        height: "100%",
                        mr: 1,
                      }}
                    >
                      {isLoading ? (
                        <CircularProgress size={20} />
                      ) : (
                        icon
                      )}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography fontWeight={notif.is_read ? 400 : 700} fontSize={14}>
                            {notif.message}
                          </Typography>
                          {isError && (
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: 16,
                                color: "#E53935",
                                marginLeft: 4,
                              }}
                            >
                              info
                            </span>
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" color="text.secondary">
                            {notif.description}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(notif.created_at).toLocaleString()}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Popover>

      {/* Error Details Modal */}
      <ErrorDetailsModal
        open={errorModalOpen}
        onClose={handleErrorModalClose}
        notification={selectedNotification}
      />
    </>
  );
}
