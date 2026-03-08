import express from 'express';
import handleStripeWebhook from '../../stripe/handleStripeWebhook';
import { UserRoutes } from '../modules/user/user.route';
import { AuthRoutes } from '../modules/auth/auth.route';
import { CategoryRoutes } from '../modules/category/category.route';
import { ReviewRoutes } from '../modules/review/review.route';
import { PaymentRoutes } from '../modules/payment/payment.route';
import { PublicRoutes } from '../modules/public/public.route';
import { TokenRoutes } from '../modules/token/token.route';
import { PlanRoutes } from '../modules/plan/plan.route';
import { SubscriptionRoutes } from '../modules/subscription/subscription.route';
import { ChatRoutes } from '../modules/chat/chat.routes';
import { MessageRoutes } from '../modules/message/message.routes';
import { NotificationRoutes } from '../modules/notification/notification.routes';
import { ClientRoutes } from '../modules/client/client.route';
import { AdminRoutes } from '../modules/admin/admin.route';
import { ProviderRoutes } from '../modules/provider/provider.route';
import { ServiceRoutes } from '../modules/service/service.route';
import { BookingRoutes } from '../modules/booking/booking.route';
import { TermsAndPolicyRoutes } from '../modules/terms&policy/terms&policy.route';
import { VerificationRoutes } from '../modules/verification/verification.route';
import { SupportRoutes } from '../modules/support/support.routes';



const router = express.Router();

const apiRoutes = [
    { path: "/user", route: UserRoutes },
    { path: "/auth", route: AuthRoutes },
    { path: "/category", route: CategoryRoutes },
    { path: "/review", route: ReviewRoutes },
    { path: "/payment", route: PaymentRoutes },
    { path: "/public", route: PublicRoutes },
    { path: "/token", route: TokenRoutes },
    { path: "/plan", route: PlanRoutes },
    { path: "/subscription", route: SubscriptionRoutes },
    { path: "/chat", route: ChatRoutes },
    { path: "/message", route: MessageRoutes },
    { path: "/notification", route: NotificationRoutes },
    { path: "/client", route: ClientRoutes },
    { path: "/admin", route: AdminRoutes },
    { path: "/provider", route: ProviderRoutes },
    { path: "/service", route: ServiceRoutes },
    { path: "/booking", route: BookingRoutes },
    { path: "/terms-and-policy", route: TermsAndPolicyRoutes },
    { path: "/verification", route: VerificationRoutes },
    { path: "/support", route: SupportRoutes }
]



router.post('/webhook', handleStripeWebhook);

apiRoutes.forEach(route => router.use(route.path, route.route));
export default router;
