// @ts-expect-error: no types available for paystack-api wrapper
import paystack from 'paystack-api';
import config from '../config';
import { Request } from 'express';

// Initialize Paystack with secret key from config (fallback to empty string to avoid crashes if not yet set)
const paystackInstance = paystack(config.paystack.secretKey || 'sk_test_placeholder_key_remove_later');

interface PaymentMetadata {
  bookingId: string;
  providerId: string;
  serviceId: string;
  customerId: string;
  [key: string]: any; // Allow other properties
}

export const createPaystackCheckout = async (req: Request, amount: number, metadata: PaymentMetadata, customerEmail: string) => {
  // Paystack amounts are also in the lowest currency unit (e.g., kobo for NGN, pesewas for GHS). 
  // Assuming 'amount' is in main unit, multiply by 100.
  const response = await paystackInstance.transaction.initialize({
    email: customerEmail,
    amount: amount * 100, // Converts to lowest denominator
    callback_url: `${config.backend_url}/api/v1/payment/success`,
    metadata: {
      custom_fields: Object.keys(metadata).map(key => ({
        display_name: key,
        variable_name: key,
        value: metadata[key as keyof PaymentMetadata]
      }))
    }
  });

  return { sessionUrl: response.data.authorization_url, id: response.data.reference };
};

export const createPaystackSubaccount = async (businessName: string, settlementBank: string, accountNumber: string) => {
  const response = await paystackInstance.subaccount.create({
    business_name: businessName,
    settlement_bank: settlementBank,
    account_number: accountNumber,
    percentage_charge: 10 // 10% platform fee
  });
  
  return response.data;
};

export const verifyPaystackTransaction = async (reference: string) => {
    return await paystackInstance.transaction.verify({ reference });
};

export const refundPaystackTransaction = async (reference: string) => {
    return await paystackInstance.refund.create({ transaction: reference });
};

export const createTransferRecipient = async (name: string, accountNumber: string, bankCode: string) => {
    const response = await paystackInstance.transfer_recipient.create({
        type: 'nuban',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'ZAR' // South African Rand
    });
    return response.data;
};

export const initiateTransfer = async (amount: number, recipient: string, reason: string) => {
    const response = await paystackInstance.transfer.create({
        source: 'balance',
        amount: amount * 100, // Converts to lowest denominator (cents)
        recipient,
        reason
    });
    return response.data;
};

export default paystackInstance;
