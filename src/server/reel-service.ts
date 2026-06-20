import { loadConfig } from "../config";
import { ReelOrchestrator } from "../reel/orchestrator";
import type { ReelJob, ReelScriptInput } from "../reel/types";
import { createLogger } from "../utils/logger";

const log = createLogger("reel-service");

/** Singleton service that manages reel job lifecycle. */
export class ReelService {
  private config = loadConfig();
  private orchestrator = new ReelOrchestrator(this.config);

  createJob(input: ReelScriptInput): ReelJob {
    return this.orchestrator.createJob(input);
  }

  async runJob(jobId: string): Promise<void> {
    try { await this.orchestrator.runJob(jobId); }
    catch (err) { log.error(`Reel job ${jobId} failed: ${err instanceof Error ? err.message : String(err)}`); }
  }

  getJob(jobId: string): ReelJob | undefined {
    return this.orchestrator.getJob(jobId);
  }

  listJobs(): ReelJob[] {
    return this.orchestrator.listJobs();
  }

  deleteJob(jobId: string): boolean {
    return this.orchestrator.deleteJob(jobId);
  }
}

declare global {
  var rawRedditReelService: ReelService | undefined;
}

/** Returns the singleton ReelService instance, creating it if needed. */
export function getReelService(): ReelService {
  if (!globalThis.rawRedditReelService) {
    globalThis.rawRedditReelService = new ReelService();
  }
  return globalThis.rawRedditReelService;
}
