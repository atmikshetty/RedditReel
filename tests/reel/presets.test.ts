import { describe, test, expect } from "bun:test";
import { REEL_PRESETS, applyReelPreset } from "@/reel/presets";
import type { ReelScriptInput } from "@/reel/types";

describe("ReelPresets", () => {
  test("has at least 5 presets", () => {
    expect(REEL_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  test("each preset has required fields", () => {
    for (const preset of REEL_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.settings).toBeDefined();
    }
  });

  test("applyReelPreset merges settings into base input", () => {
    const base: ReelScriptInput = {
      text: "Test script for preset application",
      voiceId: "default-voice",
      source: { type: "url", url: "https://example.com/base.mp4" },
    };

    const result = applyReelPreset("story-short", base);
    expect(result.source).toEqual({ type: "url", url: "https://example.com/base.mp4" });
    expect(result.text).toBe("Test script for preset application");
    expect(result.voiceId).toBe("default-voice");
  });

  test("applyReelPreset returns base for unknown preset", () => {
    const base: ReelScriptInput = {
      text: "Test script for unknown preset",
      tone: "neutral",
      source: { type: "url", url: "https://example.com/base.mp4" },
    };

    const result = applyReelPreset("nonexistent", base);
    expect(result).toEqual(base);
  });

  test("presets have unique IDs", () => {
    const ids = REEL_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("action-packed preset uses high quality", () => {
    const actionPacked = REEL_PRESETS.find((p) => p.id === "action-packed");
    expect(actionPacked).toBeDefined();
    expect(actionPacked!.settings.quality).toBe("high");
  });

  test("reddit-story-short preset uses reddit-light theme", () => {
    const preset = REEL_PRESETS.find((p) => p.id === "reddit-story-short");
    expect(preset).toBeDefined();
    expect(preset!.settings.storyCard).toBeDefined();
    expect(preset!.settings.storyCard!.themeId).toBe("reddit-light");
  });

  test("reddit-story-dark preset uses reddit-dark theme", () => {
    const preset = REEL_PRESETS.find((p) => p.id === "reddit-story-dark");
    expect(preset).toBeDefined();
    expect(preset!.settings.storyCard!.themeId).toBe("reddit-dark");
  });
});
