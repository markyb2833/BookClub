// Separate Prisma instance for the worker process
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
type PrismaClientType = InstanceType<typeof PrismaClient>;

export const prisma: PrismaClientType = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
