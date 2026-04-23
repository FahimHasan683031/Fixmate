import mongoose from 'mongoose';
import { Penalty } from './penalty.model';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import { createCancellationRefundRecord } from '../payment/payment.service';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { NotificationService } from '../notification/notification.service';
import { TransactionService } from '../transaction/transaction.service';


// client cancellation penalty
export const applyClientCancellationPenalty = async (
  bookingId: string,
  transactionId: string,
  customerId: string,
  originalPrice: number,
  penaltyFee: number
) => {
  const refundedAmount = originalPrice - penaltyFee;

  await createCancellationRefundRecord(bookingId, refundedAmount);

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

    await TransactionService.recordTransaction({
      type: 'PENALTY',
      user: customerId,
      booking: bookingId,
      amount: penaltyFee,
      status: 'COMPLETED',
    });

    await NotificationService.insertNotification({
      for: customerId as any,
      message: `Your booking cancellation has been processed. A penalty fee of $${penaltyFee} was deducted from your refund as per our cancellation policy.`,
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
  await createCancellationRefundRecord(bookingId, originalPrice);

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

    if (taken > 0) {
      await TransactionService.recordTransaction({
        type: 'PENALTY',
        user: providerId,
        booking: bookingId,
        amount: taken,
        status: 'COMPLETED',
      });
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await NotificationService.insertNotification({
    for: providerId as any,
    message: `A cancellation penalty of $${penaltyFee} has been applied. $${taken} was withheld from your wallet, and $${due} remains outstanding.`,
  });
};

// provider settle pending penalty dues
export const settlePendingPenaltyDues = async (
  providerId: string,
  incomingAmount: number,
): Promise<number> => {
  const provider = await User.findById(providerId).select('customId providerDetails.wallet').lean();
  if (!provider || !(provider as any).customId) return incomingAmount;

  const providerCustomId = (provider as any).customId as string;

  const pendingPenalties = await Penalty.find({ user: providerCustomId, status: 'PENDING' })
    .sort('createdAt')
    .lean();

  if (pendingPenalties.length === 0) return incomingAmount;

  const totalDue = pendingPenalties.reduce((sum, p) => sum + (p.due || 0), 0);
  const session = await mongoose.startSession();
  let remainingForProvider = incomingAmount;

  try {
    session.startTransaction();

    if (incomingAmount >= totalDue) {
      remainingForProvider = incomingAmount - totalDue;

      for (const penalty of pendingPenalties) {
        await Penalty.findByIdAndUpdate(
          penalty._id,
          { $set: { status: 'COMPLETED', due: 0, taken: penalty.amount } },
          { session }
        );

        // Find the booking ID from customId to record as ObjectId in transaction
        const booking = await Booking.findOne({ customId: penalty.booking }).select('_id').lean();

        // Record individual transaction for each settled penalty
        await TransactionService.recordTransaction({
          type: 'PENALTY',
          user: providerId as any,
          booking: booking?._id as any,
          amount: penalty.due || 0,
          status: 'COMPLETED',
        });
      }

      const currentWallet = (provider as any)?.providerDetails?.wallet || 0;
      await User.findByIdAndUpdate(
        providerId,
        { 'providerDetails.wallet': currentWallet < 0 ? currentWallet + totalDue : currentWallet },
        { session }
      );
    } else {
      remainingForProvider = 0;
      let budget = incomingAmount;

      for (const penalty of pendingPenalties) {
        if (budget <= 0) break;
        const deductible = Math.min(budget, penalty.due || 0);
        const newDue = (penalty.due || 0) - deductible;
        const newTaken = (penalty.amount || 0) - newDue;
        await Penalty.findByIdAndUpdate(
          penalty._id,
          { $set: { due: newDue, taken: newTaken, status: newDue === 0 ? 'COMPLETED' : 'PENDING' } },
          { session }
        );

        // Find the booking ID from customId to record as ObjectId in transaction
        const booking = await Booking.findOne({ customId: penalty.booking }).select('_id').lean();

        // Record individual transaction for the partial deduction
        await TransactionService.recordTransaction({
          type: 'PENALTY',
          user: providerId as any,
          booking: booking?._id as any,
          amount: deductible,
          status: 'COMPLETED',
        });

        budget -= deductible;
      }

      const currentWallet = (provider as any)?.providerDetails?.wallet || 0;
      await User.findByIdAndUpdate(
        providerId,
        { 'providerDetails.wallet': currentWallet < 0 ? currentWallet + incomingAmount : currentWallet },
        { session }
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const deducted = incomingAmount - remainingForProvider;
  if (deducted > 0) {
    await NotificationService.insertNotification({
      for: providerId as any,
      message: `A total of $${deducted.toFixed(2)} was deducted from your earnings to settle your outstanding penalty dues. The remaining $${remainingForProvider.toFixed(2)} has been credited to your wallet.`,
    });
  }

  return remainingForProvider;
};
