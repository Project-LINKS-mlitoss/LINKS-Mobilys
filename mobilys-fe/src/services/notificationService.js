import {
    getNotifications,
    readNotification,
    readAllNotification,
    getNotificationsDetail,
} from "../api/notificationApi";

export const getNotificationsData = async () => {
    const response = await getNotifications();
    return response;
};

export const getNotificationsDetailData = async (params) => {
    const response = await getNotificationsDetail(params);
    return response;
};

export const readNotificationData = async (id, data) => {
    const response = await readNotification(id, data);
    return response;
};

export const readAllNotificationsData = async () => {
    const response = await readAllNotification();
    return response;
};
