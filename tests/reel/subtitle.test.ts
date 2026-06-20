import { describe, test, expect } from "bun:test";
import {
  generateApproximateSegments,
  segmentsToSRT,
} from "@/reel/subtitle";

describe("ReelSubtitle", () => {
  describe("generateApproximateSegments", () => {
    test("creates readable script-based timing without transcription", () => {
      const segments = generateApproximateSegments("one two three four five six seven", 7000);

      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].startMs).toBe(0);
      expect(segments.at(-1)?.endMs).toBe(7000);
      expect(segments.map((segment) => segment.text).join(" ")).toBe(
        "one two three four five six seven",
      );
    });
  });

  describe("segmentsToSRT", () => {
    test("converts segments to SRT format", () => {
      const segments = [
        { index: 1, startMs: 0, endMs: 5000, text: "Hello world" },
        { index: 2, startMs: 5000, endMs: 10000, text: "This is a test" },
      ];

      const srt = segmentsToSRT(segments);

      expect(srt).toContain("1\n00:00:00,000 --> 00:00:05,000\nHello world");
      expect(srt).toContain("2\n00:00:05,000 --> 00:00:10,000\nThis is a test");
    });

    test("handles empty segments", () => {
      expect(segmentsToSRT([])).toBe("");
    });

    test("formats timestamps correctly", () => {
      const segments = [{ index: 1, startMs: 3661500, endMs: 3667500, text: "Test" }];

      const srt = segmentsToSRT(segments);

      expect(srt).toContain("01:01:01,500");
      expect(srt).toContain("01:01:07,500");
    });
  });
});
