import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import ApiError from "../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import config from "../config";
import dotenv from "dotenv";

dotenv.config();

const base64key = config.firebase_service_account_base64!;
if (!base64key) {
  throw new ApiError(
    StatusCodes.NOT_FOUND,
    "Firebase service account key is not provided in environment variables"
  )
}
const firbaseServiceAccountKey = Buffer.from(base64key, "base64").toString("utf-8");
const servireAccountKey = JSON.parse(firbaseServiceAccountKey);

initializeApp({
  credential: cert(servireAccountKey)
});

export interface pushMessage {
  notification: {
    title: string;
    body: string;
  },
  token: string
}

export const messageSend = async (msg: pushMessage) => {
  try {
    const response = await getMessaging().send(msg);
    console.log("Message sent successfully:", response);
    return {
      message: "Successfully sent the message",
      status: true,
    };
  } catch (error) {
    console.log(error)
    throw new ApiError(
      StatusCodes.EXPECTATION_FAILED,
      "Error hapending on the push message"
    )
  }
}