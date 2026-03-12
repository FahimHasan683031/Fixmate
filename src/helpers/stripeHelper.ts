import Stripe from "stripe";
import config from "../config";
import { Request } from "express";

export const { checkout, customers, paymentIntents, refunds, transfers, accounts, accountLinks } = new Stripe(config.stripe.stripeSecretKey!);

interface metadata {
  bookingId: string;
  providerId: string;
  serviceId: string;
  customerId: string;
}

export const createCheckoutSession = async (req: Request, amount: number, metadata: metadata, productName: string) => {
  const session = await checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: "ZAR", product_data: { name: productName }, unit_amount: amount * 100 }, quantity: 1 }],
    mode: "payment",
    // success_url: `${req.protocol}://${req.headers.host}/api/v1/payment/success?sessionId={CHECKOUT_SESSION_ID}`,
    // cancel_url: `${req.protocol}://${req.headers.host}/api/v1/payment/failure`,
    success_url: `${config.backend_url}/api/v1/payment/success?sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.backend_url}/api/v1/payment/failure`,
    metadata: {
      bookingId: metadata.bookingId,
      providerId: metadata.providerId,
      serviceId: metadata.serviceId,
      customerId: metadata.customerId
    }
  });

  return { sessionUrl: session.url, id: session.id };
};
