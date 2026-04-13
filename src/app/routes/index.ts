import express from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { PaymentRoutes } from '../modules/payment/payment.route';
import { ChatRoutes } from '../modules/chat/chat.routes';
import { MessageRoutes } from '../modules/message/message.routes';
import { NotificationRoutes } from '../modules/notification/notification.routes';
import { ClientRoutes } from '../modules/client/client.route';
import { AdminRoutes } from '../modules/admin/admin.route';
import { ProviderRoutes } from '../modules/provider/provider.route';
import { SupportRoutes } from '../modules/HelpAndSupport/support.route';
import { TokenRoutes } from '../modules/token/token.route';
import { CategoryRoutes } from '../modules/category/category.route';
import { BookingRoutes } from '../modules/booking/booking.route';
import { VerificationRoutes } from '../modules/verification/verification.route';
import { TermsAndPolicyRoutes } from '../modules/terms&policy/terms&policy.route';
import { ServiceRoutes } from '../modules/service/service.route';
import { ReviewRoutes } from '../modules/review/review.route';
import { FavoritesRoutes } from '../modules/favorites/favorites.route';
import { UserRoutes } from '../modules/user/user.route';
import { PenaltyRoutes } from '../modules/penalty/penalty.route';
import { DisputeRoutes } from '../modules/dispute/dispute.route';
import { TransactionRoutes } from '../modules/transaction/transaction.route';
import { SettingRoutes } from '../modules/setting/setting.route';
import { SubscriptionRoutes } from '../modules/subscription/subscription.route';

const router = express.Router();

const apiRoutes = [
  { path: '/auth', route: AuthRoutes },
  { path: '/user', route: UserRoutes },
  { path: '/payment', route: PaymentRoutes },
  { path: '/token', route: TokenRoutes },
  { path: '/chat', route: ChatRoutes },
  { path: '/message', route: MessageRoutes },
  { path: '/notification', route: NotificationRoutes },
  { path: '/client', route: ClientRoutes },
  { path: '/admin', route: AdminRoutes },
  { path: '/provider', route: ProviderRoutes },
  { path: '/support', route: SupportRoutes },
  { path: '/categories', route: CategoryRoutes },
  { path: '/bookings', route: BookingRoutes },
  { path: '/verification', route: VerificationRoutes },
  { path: '/terms-policy', route: TermsAndPolicyRoutes },
  { path: '/services', route: ServiceRoutes },
  { path: '/reviews', route: ReviewRoutes },
  { path: '/favorites', route: FavoritesRoutes },
  { path: '/penalty', route: PenaltyRoutes },
  { path: '/dispute', route: DisputeRoutes },
  { path: '/transactions', route: TransactionRoutes },
  { path: '/settings', route: SettingRoutes },
  { path: '/subscriptions', route: SubscriptionRoutes },
];

apiRoutes.forEach(route => router.use(route.path, route.route));
export default router;
