import * as admin from 'firebase-admin';
import path from 'path';
import config from '../../../config';
import { logger } from '../../../shared/logger';

// Initialize Firebase Admin
let isFirebaseInitialized = false;

const initializeFirebase = () => {
    try {
        if (admin.apps.length === 0) {
            const base64key = config.firebase_service_account_base64;
            if (!base64key) {
                logger.error('Firebase initialization failed: FIREBASE_SERVICE_ACCOUNT_BASE64 not found in config');
                return;
            }

            const serviceAccountKey = JSON.parse(Buffer.from(base64key, 'base64').toString('utf-8'));

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountKey),
            });
            logger.info('Firebase Admin initialized successfully using base64 config');
        }

        isFirebaseInitialized = true;
    } catch (error: any) {
        logger.error('Firebase Admin initialization failed:', error);
    }
};

const sendPushNotification = async (
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, any>
) => {
    if (!isFirebaseInitialized) {
        initializeFirebase();
    }

    if (!isFirebaseInitialized) {
        logger.warn('Push notification skipped: Firebase not initialized');
        return;
    }

    // Convert all data values to strings (FCM requirement)
    const stringifiedData: Record<string, string> = {};
    if (data) {
        Object.entries(data).forEach(([key, value]) => {
            stringifiedData[key] = value?.toString() || '';
        });
    }

    const message: admin.messaging.Message = {
        notification: {
            title,
            body,
        },
        data: stringifiedData,
        token: fcmToken,
    };

    try {
        const response = await admin.messaging().send(message);
        logger.info('Push notification sent successfully:', response);
        return response;
    } catch (error) {
        logger.error('Error sending push notification:', error);
    }
};

export const PushNotificationService = {
    sendPushNotification,
};
