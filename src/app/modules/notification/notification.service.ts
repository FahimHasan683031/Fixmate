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
    if (result.title && result.message) {
        console.log(`[NotificationService] Processing push for: ${result.title}. Type: ${result.type}`);

        const receiverId = result.receiver.toString();
        console.log(`[NotificationService] Fetching token for receiver: ${receiverId}`);

        const receiverUser = await User.findById(receiverId).select('fcmToken fullName');

        if (receiverUser) {
            if (receiverUser.fcmToken) {
                console.log(`[NotificationService] Sending push to ${receiverUser.fullName || 'User'} (Token found)`);
                await PushNotificationService.sendPushNotification(
                    receiverUser.fcmToken,
                    result.title,
                    result.message,
                    { referenceId: result.referenceId, screen: result.screen }
                );
            } else {
                console.warn(`[NotificationService] Push skipped: No fcmToken found for user ${receiverId}`);
            }
        } else {
            console.error(`[NotificationService] Push error: Receiver user not found in DB: ${receiverId}`);
        }
    }

    // --- SOCKET NOTIFICATION ---
    //@ts-ignore
    const io = global.io;
    if (io) {
        if (result.receiver) {
            io.emit(`notification::${result.receiver.toString()}`, result);
        }
    }

    return result;
};

// get notifications
const getNotificationFromDB = async (user: JwtPayload, query: FilterQuery<any>): Promise<Object> => {
    const result = new QueryBuilder(Notification.find({ receiver: user.id }), query).paginate();
    const notifications = await result.modelQuery;
    const pagination = await result.getPaginationInfo();

    const unreadCount = await Notification.countDocuments({
        receiver: user.id,
        read: false,
    });

    // Mark all unread notifications for this user as read
    await Notification.updateMany(
        { receiver: user.id, read: false },
        { $set: { read: true } }
    );

    const data: Record<string, any> = {
        notifications,
        pagination,
        unreadCount
    };

    return data;
};

// get unread notification count
const getUnreadCountFromDB = async (user: JwtPayload): Promise<number> => {
    const count = await Notification.countDocuments({
        receiver: user.id,
        read: false,
    });
    return count;
};


export const NotificationService = {
    insertNotification,
    getNotificationFromDB,
    getUnreadCountFromDB,
};
