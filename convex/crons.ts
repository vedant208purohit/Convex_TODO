import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * 15-minute automatic payment synchronization job.
 * Automatically synchronizes transactions, refunds, and settlements
 * across active connected payment gateways. Disconnected gateways are skipped.
 */
crons.interval(
  "payment-gateway-sync-15m",
  { minutes: 15 },
  (internal.paymentGateways as any).runScheduledSync
);

export default crons;
