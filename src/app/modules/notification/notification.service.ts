import { JwtPayload } from 'jsonwebtoken';
import { INotification } from './notification.interface';
import { Notification } from './notification.model';
import { FilterQuery } from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';

import { PushNotificationService } from './pushNotification.service';
import { User } from '../user/user.model';

// insert notification
const insertNotification = async (payload: Partial<INotification>): Promise<INotification> => {
    const result = await Notification.create(payload);

    // --- PUSH NOTIFICATION ---
    if (result.message) {
        const receiverId = result.for.toString();
        const receiverUser = await User.findById(receiverId).select('fcmToken fullName');

        if (receiverUser && receiverUser.fcmToken) {
            await PushNotificationService.sendPushNotification(
                receiverUser.fcmToken,
                "New Notification",
                result.message
            );
        }
    }

    // --- SOCKET NOTIFICATION ---
    //@ts-ignore
    const io = global.io;
    if (io && result.for) {
        io.emit(`notification::${result.for.toString()}`, result);

    }

    return result;
};

// get notifications
const getNotificationFromDB = async (user: JwtPayload, query: FilterQuery<any>): Promise<Object> => {
    const result = new QueryBuilder(Notification.find({ for: user.id }), query).paginate();
    const notifications = await result.modelQuery;
    const pagination = await result.getPaginationInfo();

    const unreadCount = await Notification.countDocuments({
        for: user.id,
        isRead: false,
    });

    // Mark all unread notifications for this user as read
    await Notification.updateMany(
        { for: user.id, isRead: false },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        }
    );

    const resultData: Record<string, any> = {
        meta: pagination,
        data: notifications,
        unreadCount
    };

    return resultData;
};

// get unread notification count
const getUnreadCountFromDB = async (user: JwtPayload): Promise<number> => {
    const count = await Notification.countDocuments({
        for: user.id,
        isRead: false,
    });
    return count;
};


export const NotificationService = {
    insertNotification,
    getNotificationFromDB,
    getUnreadCountFromDB,
};
