import { Router } from 'express';
import { ChatControllers } from './chat.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { ChatValidations } from './chat.validation';

export const ChatRoutes = Router();

ChatRoutes.route('/')
  .get(auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN), ChatControllers.getAllChats)
  .post(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    validateRequest(ChatValidations.createChatSchema),
    ChatControllers.create,
  );


ChatRoutes.route('/:id')
  .get(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    validateRequest(ChatValidations.chatIdSchema),
    ChatControllers.getOneRoom,
  )
  .delete(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    validateRequest(ChatValidations.chatIdSchema),
    ChatControllers.deleteOnChat,
  );
