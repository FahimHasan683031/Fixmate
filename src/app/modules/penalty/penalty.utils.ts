import { Types } from 'mongoose';
import { Penalty } from './penalty.model';
import { User } from '../user/user.model';
import { IUser } from '../user/user.interface';
import { createCancellationRefundRecord } from '../payment/payment.service';
import { refundPaystackTransaction } from '../../../helpers/paystackHelper';
import { NotificationService } from '../notification/notification.service';

/**
 * Handle a cancellation from the Client.
 * Deducts percentages based on booking status phase,
 * refunds the rest to the client via paystack,
 * logs a completed Penalty for platform accounting,
 * and updates exactly the booking payment tracking record.
 */
export const applyClientCancellationPenalty = async (
  bookingId: string,
  transactionId: string,
  customerId: string,
  serviceId: string,
  originalPrice: number,
  penaltyFee: number
) => {
  const refundedAmount = originalPrice - penaltyFee;

  // Track the penalty strictly on the single booking Payment ledger.
  await createCancellationRefundRecord(
    bookingId,
    refundedAmount,
    penaltyFee, // clientPenalty
    0           // providerPenalty
  );

  if (refundedAmount > 0) {
    await refundPaystackTransaction(transactionId, refundedAmount);
  }

  if (penaltyFee > 0) {
    // Platform keeps the fee (no wallet injection)
    await Penalty.create({
      user: new Types.ObjectId(customerId),
      type: 'CLIENT',
      booking: new Types.ObjectId(bookingId),
      service: new Types.ObjectId(serviceId),
      amount: penaltyFee,
      taken: penaltyFee,
      due: 0,
      reason: `Client cancelled booking, incurring a penalty of ${penaltyFee}`,
      status: 'COMPLETED',
    });

    await NotificationService.insertNotification({
      for: customerId as any,
      message: `Your booking cancellation has been processed. A penalty fee of ${penaltyFee} was deducted from your refund.`,
    });
  }
};

/**
 * Handle a cancellation from the Provider.
 * Provider flat rates a fee (30).
 * Checks the provider wallet dynamically:
 * If balance > fee, drains it instantly and completes it.
 * If balance < fee, drains remainder and establishes a pending debt. 
 * Recomputes all previous pending debts to drive wallet negatively exactly.
 */
export const applyProviderCancellationPenalty = async (
  bookingId: string,
  transactionId: string,
  providerId: string,
  serviceId: string,
  originalPrice: number,
  penaltyFee: number // Fixed 30
) => {
  // Provider cancellation instantly gives client full 100% refund
  const refundedAmount = originalPrice;

  await createCancellationRefundRecord(
    bookingId,
    refundedAmount,
    0,         // clientPenalty
    penaltyFee // providerPenalty
  );

  if (refundedAmount > 0) {
    await refundPaystackTransaction(transactionId, refundedAmount);
  }

  if (penaltyFee > 0) {
    // Probe provider's current holding capacity
    const provider = (await User.findById(providerId).select('providerDetails.wallet').lean()) as IUser;
    let currentWallet = provider?.providerDetails?.wallet || 0;

    let taken = 0;
    let due = 0;
    let status = 'COMPLETED';

    // Has sufficient coverage
    if (currentWallet >= penaltyFee) {
      taken = penaltyFee;
      due = 0;
      
      // Deduct immediately
      await User.findByIdAndUpdate(providerId, {
         $inc: { 'providerDetails.wallet': -penaltyFee }
      });
    } else {
      // Insufficient balance handling (e.g., Wallet = 15, Penalty = 30)
      if (currentWallet > 0) {
         taken = currentWallet; // Wipe out what they had left
      } else {
         taken = 0; // If they had nothing, or already negative, can't take anything
      }
      
      due = penaltyFee - taken; // Note how much is missing (e.g. 30 - 15 = 15)
      status = 'PENDING';

      // Calculate all PREVIOUS pending penalties' total dues
      const pendingPenalties = await Penalty.find({
        user: new Types.ObjectId(providerId),
        status: 'PENDING',
      }).lean();

      const previousDueTotal = pendingPenalties.reduce((sum, p) => sum + (p.due || 0), 0);
      const newTotalDue = previousDueTotal + due;

      // Direct wipe-to-debt state (as instructed: -(totalPending Penalties + due))
      await User.findByIdAndUpdate(providerId, {
        'providerDetails.wallet': -newTotalDue,
      });
    }

    await Penalty.create({
      user: new Types.ObjectId(providerId),
      type: 'PROVIDER',
      booking: new Types.ObjectId(bookingId),
      service: new Types.ObjectId(serviceId),
      amount: penaltyFee,
      taken,
      due,
      reason: `Provider cancelled booking, incurring a penalty of ${penaltyFee}`,
      status,
    });

    await NotificationService.insertNotification({
      for: providerId as any,
      message: `You cancelled an accepted booking. A fixed penalty of ${penaltyFee} was assessed (Withheld: ${taken}, Outstanding Due: ${due}).`,
    });
  }
};

