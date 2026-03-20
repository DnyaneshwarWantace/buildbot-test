// Run this file separately to start the job worker:
// npx tsx worker.ts

import { startWorker } from "./lib/queue";

console.log("[worker] starting...");
const worker = startWorker();
console.log(`[worker] ready, concurrency: ${process.env.WORKER_CONCURRENCY || 10}`);

process.on("SIGTERM", async () => {
  console.log("[worker] shutting down...");
  await worker.close();
  process.exit(0);
});
