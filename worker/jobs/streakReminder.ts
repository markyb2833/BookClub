import { Job } from "bullmq";
import { prisma } from "../lib/prisma";

/**
 * Streak Reminder Job
 * Runs nightly. Finds users with an active streak who haven't logged
 * reading today, and creates a streak_reminder notification.
 */
export async function streakReminderJob(_job: Job) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Users who have a current streak > 0 and notify_streak enabled
  const usersWithStreak = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM users u
    JOIN reading_stats_cache rsc ON rsc.user_id = u.id
    JOIN user_settings us ON us.user_id = u.id
    WHERE rsc.current_streak > 0
      AND rsc.month IS NULL
      AND us.notify_streak = true
      AND u.id NOT IN (
        SELECT DISTINCT user_id
        FROM reading_sessions
        WHERE date = ${today}::date
      )
  `;

  for (const user of usersWithStreak) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "streak_reminder",
        body: "Don't break your reading streak! Log some reading today.",
      },
    });
  }

  return { notified: usersWithStreak.length };
}
