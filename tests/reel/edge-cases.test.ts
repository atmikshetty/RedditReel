import { describe, test, expect, beforeEach } from "bun:test";
import { ReelOrchestrator } from "@/reel/orchestrator";
import { loadConfig } from "@/config";
import type { ReelScriptInput } from "@/reel/types";

describe("ReelOrchestrator edge cases", () => {
  let orchestrator: ReelOrchestrator;
  let config: ReturnType<typeof loadConfig>;

  beforeEach(() => {
    config = loadConfig();
    orchestrator = new ReelOrchestrator(config);
  });

  test("createJob handles very long script text", () => {
    const longText = Array(500).fill("word").join(" ");
    const input: ReelScriptInput = {
      text: longText,
      source: { type: "url", url: "https://example.com/long.mp4" },
    };

    const job = orchestrator.createJob(input);
    expect(job.script).toBe(longText);
    expect(job.script.length).toBeGreaterThan(1000);
  });

  test("createJob handles script with special characters", () => {
    const specialText = 'Hello! What\'s up? 100% great — "amazing" & more...';
    const input: ReelScriptInput = {
      text: specialText,
      source: { type: "url", url: "https://example.com/special.mp4" },
    };

    const job = orchestrator.createJob(input);
    expect(job.script).toBe(specialText);
  });

  test("createJob records the source URL", () => {
    const input: ReelScriptInput = {
      text: "Testing source URL recording edge cases",
      source: { type: "url", url: "https://example.com/clip.mp4" },
    };

    const job = orchestrator.createJob(input);
    expect(job.sourceUrl).toBe("https://example.com/clip.mp4");
  });

  test("createJob handles all tone options", () => {
    const tones = ["storytelling", "dramatic", "neutral"] as const;

    for (const tone of tones) {
      const input: ReelScriptInput = {
        text: "Testing tone options in edge cases",
        source: { type: "url", url: "https://example.com/x.mp4" },
        tone,
      };

      const job = orchestrator.createJob(input);
      expect(job.tone).toBe(tone);
    }
  });

  test("createJob handles all quality levels", () => {
    const qualities = ["draft", "standard", "high"] as const;

    for (const quality of qualities) {
      const input: ReelScriptInput = {
        text: "Testing quality level options",
        source: { type: "url", url: "https://example.com/x.mp4" },
        quality,
      };

      const job = orchestrator.createJob(input);
      expect(job.quality).toBe(quality);
    }
  });

  test("listJobs returns empty array when no jobs exist", () => {
    const jobs = orchestrator.listJobs();
    expect(jobs).toHaveLength(0);
  });

  test("deleteJob on empty orchestrator returns false", () => {
    const deleted = orchestrator.deleteJob("nonexistent");
    expect(deleted).toBe(false);
  });

  test("job IDs are unique across multiple creations", () => {
    const inputs: ReelScriptInput[] = Array(10)
      .fill(null)
      .map((_, i) => ({
        text: `Script number ${i + 1} for uniqueness testing`,
        source: { type: "url", url: "https://example.com/x.mp4" },
      }));

    const jobs = inputs.map((input) => orchestrator.createJob(input));
    const ids = new Set(jobs.map((j) => j.id));

    expect(ids.size).toBe(10);
  });
});
