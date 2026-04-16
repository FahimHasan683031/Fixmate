import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { User } from '../user/user.model';
import { Service } from '../service/service.model';
import config from '../../../config';
import { JwtPayload } from 'jsonwebtoken';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { google } from 'googleapis';

// Types for incoming payload
interface IReceiptPayload {
  platform: 'apple' | 'google';
  transactionId?: string; // For Apple
  purchaseToken?: string; // For Google
  productId?: string; // For Google
}

const syncUserSubscriptionToServices = async (userId: string, isSubscribed: boolean) => {
  await Service.updateMany(
    { creator: userId },
    { $set: { isCreatorSubscribed: isSubscribed } }
  );
};

const verifyReceipt = async (userPayload: JwtPayload, payload: IReceiptPayload) => {
  const user = await User.findById(userPayload.authId);
  if (!user || user.role !== 'PROVIDER') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only providers can subscribe');
  }

  let expiryDate: Date | null = null;
  let originalTransactionId = '';

  if (payload.platform === 'apple') {
    if (!payload.transactionId) throw new ApiError(StatusCodes.BAD_REQUEST, 'transactionId is required for Apple platform');

    if (!config.appleIap.privateKey || !config.appleIap.keyId || !config.appleIap.issuerId || !config.appleIap.bundleId) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Apple IAP configuration is missing');
    }

    const signingKey = config.appleIap.privateKey.replace(/\\n/g, '\n');

    const appStoreClient = new AppStoreServerAPIClient(
      signingKey,
      config.appleIap.keyId,
      config.appleIap.issuerId,
      config.appleIap.bundleId,
      config.node_env === 'production' ? Environment.PRODUCTION : Environment.SANDBOX
    );

    try {
      const transactionInfo = await appStoreClient.getTransactionInfo(payload.transactionId);
      if (transactionInfo && transactionInfo.signedTransactionInfo) {
        // We initialize a verifier. Note: In production, root certificates should be provided.
        const verifier = new SignedDataVerifier(
          [], // Root certificates array
          false,
          config.node_env === 'production' ? Environment.PRODUCTION : Environment.SANDBOX,
          config.appleIap.bundleId
        );
        
        const decoded = await verifier.verifyAndDecodeTransaction(transactionInfo.signedTransactionInfo);
        
        if (decoded.expiresDate) {
          expiryDate = new Date(decoded.expiresDate);
        }
        originalTransactionId = decoded.originalTransactionId || decoded.transactionId || '';
      }
    } catch (error: any) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Apple verification failed: ${error.message}`);
    }
  } else if (payload.platform === 'google') {
    if (!payload.purchaseToken || !payload.productId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'purchaseToken and productId are required for Google platform');
    }

    if (!config.googleIap.serviceAccountEmail || !config.googleIap.privateKey || !config.googleIap.packageName) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Google IAP configuration is missing');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.googleIap.serviceAccountEmail,
        private_key: config.googleIap.privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const publisher = google.androidpublisher({ version: 'v3', auth });
    
    try {
      const res = await publisher.purchases.subscriptions.get({
        packageName: config.googleIap.packageName,
        subscriptionId: payload.productId,
        token: payload.purchaseToken,
      });

      if (res.data.expiryTimeMillis) {
        expiryDate = new Date(parseInt(res.data.expiryTimeMillis));
      }
      originalTransactionId = payload.purchaseToken;
    } catch (error: any) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Google verification failed: ${error.message}`);
    }
  }

  const isSubscribed = expiryDate ? expiryDate > new Date() : false;

  const updatedUser = await User.findByIdAndUpdate(
    userPayload.authId,
    {
      'providerDetails.subscription': {
        isSubscribed,
        platform: payload.platform,
        status: isSubscribed ? 'active' : 'expired',
        expiryDate,
        originalTransactionId: originalTransactionId || '',
        latestReceiptToken: payload.purchaseToken || payload.transactionId || null,
      },
    },
    { new: true }
  );

  // Sync to services
  await syncUserSubscriptionToServices(userPayload.authId, isSubscribed);

  return updatedUser?.providerDetails?.subscription;
};

const handleAppleWebhook = async (signedPayload: string) => {
  if (!config.appleIap.bundleId) return;

  const verifier = new SignedDataVerifier(
    [], 
    false,
    config.node_env === 'production' ? Environment.PRODUCTION : Environment.SANDBOX,
    config.appleIap.bundleId
  );

  try {
    const payload = await verifier.verifyAndDecodeNotification(signedPayload);
    const notificationType = payload.notificationType;
    const data = payload.data;

    if (data && data.signedTransactionInfo) {
      const transaction = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
      const originalTransactionId = transaction.originalTransactionId || transaction.transactionId;
      const expiryDate = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
      
      let isSubscribed = false;
      let status = 'none';

      // Use string comparison to avoid potential enum issues if types are strict
      const type = String(notificationType);

      if (['SUBSCRIBED', 'DID_RENEW', 'RENEWED'].includes(type)) {
        isSubscribed = true;
        status = 'active';
      } else if (['EXPIRED', 'DID_FAIL_TO_RENEW', 'REVOKE', 'REFUND'].includes(type)) {
        isSubscribed = false;
        status = 'expired';
      } else {
        // Basic safety check for current date
        isSubscribed = expiryDate ? expiryDate > new Date() : false;
        status = isSubscribed ? 'active' : 'expired';
      }

      const user = await User.findOneAndUpdate(
        { 'providerDetails.subscription.originalTransactionId': originalTransactionId },
        {
          'providerDetails.subscription.isSubscribed': isSubscribed,
          'providerDetails.subscription.status': status,
          'providerDetails.subscription.expiryDate': expiryDate,
        },
        { new: true }
      );

      if (user) {
        await syncUserSubscriptionToServices(user._id.toString(), isSubscribed);
      }
    }
  } catch (error) {
    console.error('Apple Webhook processing error:', error);
  }
};

const handleGoogleWebhook = async (body: any) => {
  if (!body.message || !body.message.data) return;
  
  try {
    const decodedData = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    const subscriptionNotification = decodedData.subscriptionNotification;
    
    if (!subscriptionNotification) return;

    const { purchaseToken, subscriptionId } = subscriptionNotification;

    if (!config.googleIap.serviceAccountEmail || !config.googleIap.privateKey || !config.googleIap.packageName) {
        return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.googleIap.serviceAccountEmail,
        private_key: config.googleIap.privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const publisher = google.androidpublisher({ version: 'v3', auth });
    
    const res = await publisher.purchases.subscriptions.get({
      packageName: config.googleIap.packageName,
      subscriptionId,
      token: purchaseToken,
    });

    const expiryDate = res.data.expiryTimeMillis ? new Date(parseInt(res.data.expiryTimeMillis)) : null;
    const finalIsSubscribed = expiryDate ? expiryDate > new Date() : false;

    const user = await User.findOneAndUpdate(
      { 'providerDetails.subscription.latestReceiptToken': purchaseToken },
      {
        'providerDetails.subscription.isSubscribed': finalIsSubscribed,
        'providerDetails.subscription.expiryDate': expiryDate,
        'providerDetails.subscription.status': finalIsSubscribed ? 'active' : 'expired',
      },
      { new: true }
    );

    if (user) {
      await syncUserSubscriptionToServices(user._id.toString(), finalIsSubscribed);
    }
  } catch (error) {
    console.error('Google Webhook processing error:', error);
  }
};

export const SubscriptionService = {
  verifyReceipt,
  handleAppleWebhook,
  handleGoogleWebhook,
};


