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

export const TransactionRoutes = router;
