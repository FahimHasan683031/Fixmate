import ApiError from "../../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import { accountLinks, accounts, checkout } from "../../../helpers/stripeHelper";
import { PAYMENT_STATUS } from "../../../enum/payment";
import { Notification } from "../notification/notification.model";
import { redisDB } from "../../../redis/connectedUsers";
import { Request } from "express";
import { sendNotification } from "../../../helpers/SocketUtils";
import { Booking } from "../booking/booking.model";
import { Payment } from "./payment.model";
import { Service } from "../service/service.model";
import { User } from "../user/user.model";
import { emailQueue } from "../../../queues/email.queue";

const success = async (query: any) => {
  const sessionId = query.sessionId;
  if (!sessionId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Session ID is required");
  }

  const session = await checkout.sessions.retrieve(sessionId);
  if (!session) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Session not found");
  }

  if (session.payment_status !== "paid") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment not completed");
  }

  const serviceId = new Types.ObjectId(session?.metadata?.serviceId);
  const providerId = new Types.ObjectId(session?.metadata?.providerId);
  const customerId = new Types.ObjectId(session?.metadata?.customerId);
  const bookingID = new Types.ObjectId(session?.metadata?.bookingId);

  const booking = await Booking.findById(bookingID);
  if (!booking) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Booking not found");
  }
  if (booking.isPaid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Booking already paid");
  }

  // Update booking
  await Booking.findByIdAndUpdate(bookingID, {
    isPaid: true,
    transactionId: session.payment_intent as string,
    paymentId: session.id
  }, { new: true });

  const serviceData = await Service.findById(serviceId).lean();
  const providerData = await User.findById(providerId).lean();
  const customerData = await User.findById(customerId).lean();

  if (!serviceData || !providerData || !customerData) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Related data not found");
  }

  // Create Payment record
  await Payment.create({
    service: serviceId,
    provider: providerId,
    customer: customerId,
    booking: booking._id,
    amount: serviceData.price,
    paymentId: session.id,
    paymentStatus: PAYMENT_STATUS.COMPLETED,
  });

  // Notify provider
  const notification = await Notification.create({
    receiver: providerId,
    title: "New Booking Request",
    message: `You have a new booking request, ${customerData.name} has requested a booking for ${serviceData.category}`,
    type: "USER"
  });

  //@ts-ignore
  const socket = global.io;
  if (socket) {
    await sendNotification(socket, notification);
  }

  const isProviderOnline = await redisDB.get(`user:${providerId}`);
  if (!isProviderOnline) {
    await emailQueue.add("push-notification", {
      notification: {
        title: "You got a new booking request",
        body: `${customerData.name} has requested a booking for ${serviceData.category}`
      },
      token: providerData?.fcmToken
    }, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  return `
    <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f4f4f4; }
                .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #4CAF50; }
                p { color: #555; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Payment Successful!</h1>
                <p>Your payment has been processed successfully. You can now close this window.</p>
            </div>
        </body>
    </html>
    `;
};

const createConnectedAccount = async (req: Request) => {
  const user = req.user;
  const userOnDB = await User.findById(user.authId || user.id);
  if (!userOnDB) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }

  const account = await accounts.create({
    type: "express",
    email: userOnDB.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    metadata: {
      userId: (user.authId || user.id).toString()
    }
  });

  const onboardLink = await accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.SERVER_DOMAIN}/api/v1/payment/account/refresh/${account.id}`,
    return_url: `${process.env.SERVER_DOMAIN}/api/v1/payment/account/${account.id}`,
    type: "account_onboarding"
  });

  return onboardLink.url;
};

const refreshAccount = async (req: Request) => {
  const { id } = req.params;
  if (!id) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Account ID is required");
  }

  const host = req.headers.host as string;
  const protocol = req.protocol as string;

  const onboardLink = await accountLinks.create({
    account: id,
    refresh_url: `${protocol}://${host}/api/v1/payment/account/refresh/${id}`,
    return_url: `${protocol}://${host}/api/v1/payment/account/${id}`,
    type: "account_onboarding"
  });

  return `
    <html>
        <body>
            <p>Please reconnect your account <a href="${onboardLink.url}">here</a>.</p>
        </body>
    </html>
    `;
};

const successAccount = async (req: Request) => {
  const { id } = req.params;
  if (!id) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Account ID is required");
  }

  const account = await accounts.retrieve(id);
  if (!account) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Account not found");
  }

  const userId = account?.metadata?.userId;
  if (!userId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User ID not found in account metadata");
  }

  await User.findByIdAndUpdate(new Types.ObjectId(userId), { stripeAccountId: account.id });

  return `
    <html>
        <body>
            <h1>Account Connected Successfully!</h1>
            <p>Your Stripe account has been linked. You can now receive payments.</p>
        </body>
    </html>
    `;
};

export const PaymentServices = {
  success,
  createConnectedAccount,
  refreshAccount,
  successAccount
};
