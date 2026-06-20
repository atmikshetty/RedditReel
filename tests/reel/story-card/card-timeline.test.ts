import { describe, test, expect } from "bun:test";

import {
  getActiveItemAtMs,
  getActiveItemAtFrame,
  getTimelineFrameCount,
} from "@/reel/story-card/card-timeline";
import type { StoryCardTimeline } from "@/reel/story-card/types";

function makeTimeline(items: Array<{ startMs: number; endMs: number; text: string }>): StoryCardTimeline {
  return {
    version: 1,
    audioDurationMs: 10000,
    videoDurationMs: 10000,
    width: 1080,
    height: 1920,
    fps: 30,
    items: items.map((item, index) => ({
      id: `card_${String(index).padStart(3, "0")}`,
      index,
      text: item.text,
      startMs: item.startMs,
      endMs: item.endMs,
      durationMs: item.endMs - item.startMs,
      progress: item.endMs / 10000,
      isTitleCard: false,
      isOutroCard: false,
      visual: {
        themeId: "reddit-light",
        layoutMode: "center-card",
        transition: "scale-fade",
        position: "center",
      },
    })),
    metadata: {
      title: "Test",
      subreddit: "r/AskReddit",
      username: "u/test",
      totalWords: 20,
      chunkCount: items.length,
      timingMode: "estimated",
    },
  };
}

describe("card-timeline", () => {
  test("getActiveItemAtMs finds active item at given time", () => {
    const timeline = makeTimeline([
      { startMs: 0, endMs: 3000, text: "First" },
      { startMs: 3000, endMs: 6000, text: "Second" },
      { startMs: 6000, endMs: 10000, text: "Third" },
    ]);

    expect(getActiveItemAtMs(timeline, 1000)?.text).toBe("First");
    expect(getActiveItemAtMs(timeline, 3500)?.text).toBe("Second");
    expect(getActiveItemAtMs(timeline, 8000)?.text).toBe("Third");
  });

  test("getActiveItemAtMs returns undefined when no item is active", () => {
    const timeline = makeTimeline([
      { startMs: 0, endMs: 3000, text: "First" },
    ]);

    expect(getActiveItemAtMs(timeline, 4000)).toBeUndefined();
    expect(getActiveItemAtMs(timeline, -100)).toBeUndefined();
  });

  test("getActiveItemAtFrame converts frame to ms correctly", () => {
    const timeline = makeTimeline([
      { startMs: 0, endMs: 3000, text: "First" },
    ]);

    // At 30fps, frame 45 = 1500ms
    expect(getActiveItemAtFrame(timeline, 45)?.text).toBe("First");
    // At 30fps, frame 100 = 3333ms (after end)
    expect(getActiveItemAtFrame(timeline, 100)).toBeUndefined();
  });

  test("getTimelineFrameCount returns correct frame count", () => {
    const timeline = makeTimeline([
      { startMs: 0, endMs: 5000, text: "First" },
    ]);

    expect(getTimelineFrameCount(timeline)).toBe(300); // 10000ms / 1000 * 30 = 300
  });

  test("getTimelineFrameCount handles fractional seconds", () => {
    const timeline: StoryCardTimeline = {
      ...makeTimeline([{ startMs: 0, endMs: 3333, text: "First" }]),
      videoDurationMs: 3333,
    };

    expect(getTimelineFrameCount(timeline)).toBe(100); // ceil(3333 / 1000 * 30) = ceil(99.99) = 100
  });
});
