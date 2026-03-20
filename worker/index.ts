import { Worker, Queue } from "bullmq";
import { streakReminderJob } from "./jobs/streakReminder";
import { tierScoringJob } from "./jobs/tierScoring";

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
};

// ---------------------------------------------------------------------------
// Workers — process jobs from queues
// ---------------------------------------------------------------------------

const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    if (job.name === "streakReminder") return streakReminderJob(job);
  },
  { connection }
);

const statsWorker = new Worker(
  "stats",
  async (job) => {
    if (job.name === "tierScoring") return tierScoringJob(job);
  },
  { connection }
);

// ---------------------------------------------------------------------------
// Scheduled jobs — enqueue recurring tasks
// ---------------------------------------------------------------------------

async function scheduleRecurringJobs() {
  const notificationQueue = new Queue("notifications", { connection });
  const statsQueue = new Queue("stats", { connection });

  // Streak reminder — every night at 8pm UTC
  await notificationQueue.add(
    "streakReminder",
    {},
    {
      repeat: { pattern: "0 20 * * *" },
      jobId: "streak-reminder-recurring",
    }
  );

  // Tier scoring — every night at 2am UTC
  await statsQueue.add(
    "tierScoring",
    {},
    {
      repeat: { pattern: "0 2 * * *" },
      jobId: "tier-scoring-recurring",
    }
  );

  console.log("Recurring jobs scheduled");
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

notificationWorker.on("completed", (job) => {
  console.log(`[notifications] ${job.name} completed`, job.returnvalue);
});
notificationWorker.on("failed", (job, err) => {
  console.error(`[notifications] ${job?.name} failed`, err.message);
});
statsWorker.on("completed", (job) => {
  console.log(`[stats] ${job.name} completed`, job.returnvalue);
});
statsWorker.on("failed", (job, err) => {
  console.error(`[stats] ${job?.name} failed`, err.message);
});

scheduleRecurringJobs().then(() => {
  console.log("BookClub worker started");
});

process.on("SIGTERM", async () => {
  await notificationWorker.close();
  await statsWorker.close();
  process.exit(0);
});
