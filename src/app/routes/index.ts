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



const router = express.Router();

const apiRoutes = [
    { path: "/auth", route: AuthRoutes },
    { path: "/payment", route: PaymentRoutes },
    { path: "/token", route: TokenRoutes },
    { path: "/chat", route: ChatRoutes },
    { path: "/message", route: MessageRoutes },
    { path: "/notification", route: NotificationRoutes },
    { path: "/client", route: ClientRoutes },
    { path: "/admin", route: AdminRoutes },
    { path: "/provider", route: ProviderRoutes },
    { path: "/support", route: SupportRoutes }
]




// router.post('/webhook', handleStripeWebhook);

apiRoutes.forEach(route => router.use(route.path, route.route));
export default router;
