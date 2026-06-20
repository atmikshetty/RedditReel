import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "../../utils/logger";
import type { StoryCardTimeline } from "./types";

const log = createLogger("story-card:card-timeline");

/** Returns the file path for a saved story card timeline JSON. */
export function getTimelinePath(outputDir: string, jobId: string): string {
  return join(outputDir, jobId, "story-card-timeline.json");
}

/** Saves a story card timeline to disk as JSON. */
export async function saveTimeline(timeline: StoryCardTimeline, outputDir: string, jobId: string): Promise<string> {
  const dir = join(outputDir, jobId);
  await mkdir(dir, { recursive: true });
  const path = getTimelinePath(outputDir, jobId);
  await writeFile(path, JSON.stringify(timeline, null, 2));
  log.info(`Saved timeline: ${path} (${timeline.items.length} items)`);
  return path;
}

/** Calculates the total frame count from a timeline. */
export function getTimelineFrameCount(timeline: StoryCardTimeline): number {
  return Math.ceil((timeline.videoDurationMs / 1000) * timeline.fps);
}

/** Returns the active timeline item at a given millisecond timestamp. */
export function getActiveItemAtMs(timeline: StoryCardTimeline, ms: number): StoryCardTimeline["items"][number] | undefined {
  return timeline.items.find((item) => item.startMs <= ms && ms < item.endMs);
}

/** Returns the active timeline item at a given frame number. */
export function getActiveItemAtFrame(timeline: StoryCardTimeline, frame: number): StoryCardTimeline["items"][number] | undefined {
  return getActiveItemAtMs(timeline, (frame / timeline.fps) * 1000);
}
