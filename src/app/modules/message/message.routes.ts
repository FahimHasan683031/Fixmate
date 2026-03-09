import express, { Router } from "express";
import { MessageControllers } from "./message.controller";
import auth from "../../middleware/auth";
import { USER_ROLES } from "../../../enum/user";
import validateRequest from "../../middleware/validateRequest";
import { fileAndBodyProcessorUsingDiskStorage } from "../../middleware/processReqBody";
import { MessageValidations } from "./message.validation";

const router = express.Router();

router.route("/")
  .post(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    fileAndBodyProcessorUsingDiskStorage(),
    validateRequest(MessageValidations.sendMessageValidator),
    MessageControllers.create
  );

router.route("/:id")
  .get(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    validateRequest(MessageValidations.getMessagesOfChat),
    MessageControllers.messagesOfChat
  )
  .patch(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    fileAndBodyProcessorUsingDiskStorage(),
    validateRequest(MessageValidations.updateMessage),
    MessageControllers.updateMessage
  )
  .delete(
    auth(USER_ROLES.PROVIDER, USER_ROLES.CLIENT, USER_ROLES.ADMIN),
    validateRequest(MessageValidations.deleteMessage),
    MessageControllers.deleteMessage
  );

export const MessageRoutes = router;
