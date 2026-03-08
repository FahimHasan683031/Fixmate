import { Queue } from "bullmq";
import { redisConfig } from "../config/redis";

export const emailQueue = new Queue("email-queue", { connection: redisConfig });

// producer function
export async function addEmailJob(data: { to: string; subject: string; body: string }) {
  await emailQueue.add("send-email", data, {
    attempts: 3, // retry 3 times if failed
    backoff: { type: "exponential", delay: 5000 }, // 5s -> 10s -> 20s
    removeOnComplete: true,
    removeOnFail: false,
  });
}
