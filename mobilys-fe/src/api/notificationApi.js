import { get, patch, post } from "./middleware";

export const getNotifications = () =>
  get(`/gtfs/data/notifications/`);

export const getNotificationsDetail = (params) =>
  get(`/gtfs/data/notifications/detail/`, params);

export const readNotification = (id, data) =>
  patch(`/gtfs/data/notifications/${id}/`, data);

export const readAllNotification = () =>
  post(`/gtfs/data/notifications/mark-all-read/`);