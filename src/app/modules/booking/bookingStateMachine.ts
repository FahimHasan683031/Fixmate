import { Types } from 'mongoose';
import { Booking } from './booking.model';
import { BOOKING_STATUS } from '../../../enum/booking';
import ApiError from '../../../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { User } from '../user/user.model';

const VALID_TRANSITIONS: Record<string, BOOKING_STATUS[]> = {
  [BOOKING_STATUS.CREATED]: [BOOKING_STATUS.PAID, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.PAID]: [
    BOOKING_STATUS.REQUESTED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.REFUNDED,
  ],
  [BOOKING_STATUS.REQUESTED]: [
    BOOKING_STATUS.ACCEPTED,
    BOOKING_STATUS.DECLINED,
    BOOKING_STATUS.EXPIRED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.ACCEPTED]: [BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.IN_PROGRESS]: [
    BOOKING_STATUS.COMPLETED_BY_PROVIDER,
    BOOKING_STATUS.DISPUTED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.COMPLETED_BY_PROVIDER]: [
    BOOKING_STATUS.CONFIRMED_BY_CLIENT,
    BOOKING_STATUS.DISPUTED,
    BOOKING_STATUS.AUTO_SETTLED,
  ],
  [BOOKING_STATUS.CONFIRMED_BY_CLIENT]: [BOOKING_STATUS.SETTLED],
  [BOOKING_STATUS.SETTLED]: [BOOKING_STATUS.DISPUTED],
  [BOOKING_STATUS.AUTO_SETTLED]: [BOOKING_STATUS.DISPUTED],

  [BOOKING_STATUS.DECLINED]: [],
  [BOOKING_STATUS.EXPIRED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.DISPUTED]: [
    BOOKING_STATUS.SETTLED,
    BOOKING_STATUS.REFUNDED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.REFUNDED]: [],
};

export class BookingStateMachine {
  static async transitionState(
    bookingId: string | Types.ObjectId,
    role: 'client' | 'provider' | 'admin' | 'system',
    targetState: BOOKING_STATUS,
    reason: string = '',
  ) {
    return this.executeTransition(bookingId, role, targetState, reason, false);
  }

  static async adminForceState(
    bookingId: string | Types.ObjectId,
    targetState: BOOKING_STATUS,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Reason required for admin force.');
    return this.executeTransition(bookingId, 'admin', targetState, `[ADMIN FORCE] ${reason}`, true);
  }

  private static async executeTransition(
    bookingId: string | Types.ObjectId,
    _role: string,
    targetState: BOOKING_STATUS,
    _reason: string,
    isForce: boolean,
  ) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');

    const currentState = booking.bookingStatus as BOOKING_STATUS;
    const strictProgression = [
      BOOKING_STATUS.CREATED,
      BOOKING_STATUS.PAID,
      BOOKING_STATUS.REQUESTED,
      BOOKING_STATUS.ACCEPTED,
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.COMPLETED_BY_PROVIDER,
      BOOKING_STATUS.CONFIRMED_BY_CLIENT,
      BOOKING_STATUS.SETTLED,
      BOOKING_STATUS.AUTO_SETTLED,
    ];

    const currentIndex = strictProgression.indexOf(currentState);
    const targetIndex = strictProgression.indexOf(targetState);
    const isExceptionState = targetIndex === -1;

    if (!isForce) {
      if (!isExceptionState && targetIndex <= currentIndex) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `Invalid state transition: Cannot change booking backwards from ${currentState} to ${targetState}`,
        );
      } else if (
        isExceptionState &&
        !(VALID_TRANSITIONS[currentState] || []).includes(targetState)
      ) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `Invalid state transition: Exception state ${targetState} not allowed from ${currentState}`,
        );
      }
    }

    booking.bookingStatus = targetState;
    booking.currentStats = booking.currentStats || {};

    if (!isExceptionState) {
      for (let i = 0; i <= targetIndex; i++) booking.currentStats[strictProgression[i]] = true;
    } else {
      booking.currentStats[targetState] = true;
    }

    const now = new Date();
    const responseTime = now.getTime() - booking.createdAt.getTime();

    const metricsUpdate: any = { $inc: {}, $set: {} };

    if (targetState === BOOKING_STATUS.ACCEPTED) {
      metricsUpdate.$inc['providerDetails.metrics.acceptedJobs'] = 1;
      metricsUpdate.$inc['providerDetails.metrics.totalResponseTime'] = responseTime;
      metricsUpdate.$inc['providerDetails.metrics.totalResponseCount'] = 1;
      booking.respondedAt = now;
    } else if (targetState === BOOKING_STATUS.DECLINED) {
      metricsUpdate.$inc['providerDetails.metrics.declinedJobs'] = 1;
      metricsUpdate.$inc['providerDetails.metrics.totalResponseTime'] = responseTime;
      metricsUpdate.$inc['providerDetails.metrics.totalResponseCount'] = 1;
      booking.respondedAt = now;
    } else if (targetState === BOOKING_STATUS.EXPIRED) {
      metricsUpdate.$inc['providerDetails.metrics.declinedJobs'] = 1;
    } else if (targetState === BOOKING_STATUS.COMPLETED_BY_PROVIDER) {
      metricsUpdate.$inc['providerDetails.metrics.completedJobs'] = 1;
    } else if (targetState === BOOKING_STATUS.DISPUTED) {
      metricsUpdate.$inc['providerDetails.metrics.disputedJobs'] = 1;
    }

    if (Object.keys(metricsUpdate.$inc).length > 0 || Object.keys(metricsUpdate.$set).length > 0) {
      await User.findByIdAndUpdate(booking.provider, metricsUpdate);
      await (User as any).updateRankingScore(booking.provider);
    }

    booking.markModified('currentStats');
    await booking.save();

    return booking;
  }
}
