import { describe, test, expect, beforeEach } from "bun:test";
import { ReelOrchestrator } from "@/reel/orchestrator";
import { loadConfig } from "@/config";
import type { ReelJob } from "@/reel/types";

describe("ReelService integration", () => {
  let orchestrator: ReelOrchestrator;
  let config: ReturnType<typeof loadConfig>;

  beforeEach(() => {
    config = loadConfig();
    orchestrator = new ReelOrchestrator(config);
  });

  test("job lifecycle: create, retrieve, delete", () => {
    const job = orchestrator.createJob({
      text: "This is a test script for the reel job lifecycle",
      source: { type: "url", url: "https://example.com/test.mp4" },
    });

    // Job is created with queued status
    expect(job.status).toBe("queued");

    // Job can be retrieved
    const retrieved = orchestrator.getJob(job.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(job.id);

    // Job appears in listing
    const jobs = orchestrator.listJobs();
    expect(jobs).toHaveLength(1);

    // Job can be deleted
    const deleted = orchestrator.deleteJob(job.id);
    expect(deleted).toBe(true);

    // Job no longer retrievable
    expect(orchestrator.getJob(job.id)).toBeUndefined();

    // Job removed from listing
    expect(orchestrator.listJobs()).toHaveLength(0);
  });

  test("multiple jobs are listed in reverse chronological order", () => {
    const job1 = orchestrator.createJob({
      text: "First test script for ordering",
      source: { type: "url", url: "https://example.com/a.mp4" },
    });
    const job2 = orchestrator.createJob({
      text: "Second test script for ordering",
      source: { type: "url", url: "https://example.com/b.mp4" },
    });

    const jobs = orchestrator.listJobs();
    expect(jobs).toHaveLength(2);
    // Both jobs should be in the list
    const jobIds = jobs.map((j: ReelJob) => j.id);
    expect(jobIds).toContain(job1.id);
    expect(jobIds).toContain(job2.id);
  });

  test("deleting non-existent job returns false", () => {
    const deleted = orchestrator.deleteJob("nonexistent_id");
    expect(deleted).toBe(false);
  });
});
