import express from 'express';
import { TransactionController } from './transaction.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';

const router = express.Router();

// Get all transactions (Admin only)
router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  TransactionController.getAllTransactions
);

// Download transactions (Admin only)
router.get(
  '/download',
  auth(USER_ROLES.ADMIN),
  TransactionController.downloadTransactions
);

// Get single transaction details (Admin only)
router.get(
  '/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROVIDER, USER_ROLES.CLIENT),
  TransactionController.getTransactionById
);

export const TransactionRoutes = router;
