import mongoose from 'mongoose';
import { Penalty } from './penalty.model';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { createCancellationRefundRecord } from '../payment/payment.service';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { NotificationService } from '../notification/notification.service';


// client cancellation penalty
export const applyClientCancellationPenalty = async (
  bookingId: string,
  transactionId: string,
  customerId: string,
  originalPrice: number,
  penaltyFee: number
) => {
  const refundedAmount = originalPrice - penaltyFee;

  await createCancellationRefundRecord(bookingId, refundedAmount, penaltyFee, 0);

  if (refundedAmount > 0) {
    await refundPaystackTransaction(transactionId, refundedAmount);
  }

  if (penaltyFee > 0) {
    const [userObj, bookingObj] = await Promise.all([
      User.findById(customerId).select('customId').lean(),
      Booking.findById(bookingId).select('customId').lean(),
    ]);

    await Penalty.create({
      user: (userObj as any)?.customId,
      type: 'CLIENT',
      booking: (bookingObj as any)?.customId,
      amount: penaltyFee,
      taken: penaltyFee,
      due: 0,
      reason: `Client cancelled booking. Penalty: ${penaltyFee}`,
      status: 'COMPLETED',
    });

    await NotificationService.insertNotification({
      for: customerId as any,
      message: `Your booking cancellation has been processed. A penalty fee of ${penaltyFee} was deducted from your refund.`,
    });
  }
};


// provider cancellation penalty
export const applyProviderCancellationPenalty = async (
  bookingId: string,
  transactionId: string,
  providerId: string,
  originalPrice: number,
  penaltyFee: number
) => {
  await createCancellationRefundRecord(bookingId, originalPrice, 0, penaltyFee);

  if (originalPrice > 0) {
    await refundPaystackTransaction(transactionId, originalPrice);
  }

  if (penaltyFee <= 0) return;

  const [provider, bookingObj] = await Promise.all([
    User.findById(providerId).select('providerDetails.wallet customId').lean(),
    Booking.findById(bookingId).select('customId').lean(),
  ]);

  const currentWallet = (provider as any)?.providerDetails?.wallet || 0;
  const taken = currentWallet > 0 ? Math.min(currentWallet, penaltyFee) : 0;
  const due = penaltyFee - taken;
  const status = due > 0 ? 'PENDING' : 'COMPLETED';

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (due > 0) {
      const pendingDueTotal = await Penalty.aggregate([
        { $match: { user: (provider as any)?.customId, status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$due' } } },
      ]).session(session);

      const newTotalDue = (pendingDueTotal[0]?.total || 0) + due;

      await User.findByIdAndUpdate(
        providerId,
        { 'providerDetails.wallet': -newTotalDue },
        { session }
      );
    } else {
      await User.findByIdAndUpdate(
        providerId,
        { $inc: { 'providerDetails.wallet': -penaltyFee } },
        { session }
      );
    }

    await Penalty.create(
      [
        {
          user: (provider as any)?.customId,
          type: 'PROVIDER',
          booking: (bookingObj as any)?.customId,
          amount: penaltyFee,
          taken,
          due,
          reason: `Provider cancelled booking. Penalty: ${penaltyFee}`,
          status,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await NotificationService.insertNotification({
    for: providerId as any,
    message: `You cancelled a booking. Penalty: ${penaltyFee} assessed (Withheld: ${taken}, Outstanding: ${due}).`,
  });
};
