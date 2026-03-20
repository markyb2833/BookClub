import { Queue } from "bullmq";

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
};

// One queue per job domain — easy to scale or prioritise separately
export const notificationQueue = new Queue("notifications", { connection });
export const feedQueue = new Queue("feed", { connection });
export const statsQueue = new Queue("stats", { connection });
export const importQueue = new Queue("import", { connection });
