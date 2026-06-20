import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { buildStoryCardFfmpegArgs, composeStoryCardReel } from "../../src/reel/story-card/compositor";

describe("story card compositor", () => {
  test("builds an ffmpeg graph that places transparent cards over the background", () => {
    const args = buildStoryCardFfmpegArgs({
      backgroundVideoPath: "background.mp4",
      overlayVideoPath: "cards.mov",
      ttsAudioPath: "voice.mp3",
      outputPath: "final.mp4",
      durationMs: 3500,
      width: 1080,
      height: 1920,
      fps: 30,
      quality: "draft",
    });

    expect(args.slice(0, 7)).toEqual([
      "-y",
      "-i",
      "background.mp4",
      "-i",
      "cards.mov",
      "-i",
      "voice.mp3",
    ]);

    const filterIndex = args.indexOf("-filter_complex");
    expect(filterIndex).toBeGreaterThan(0);
    // Background is only fps-normalized (already W×H, no rescale or RGBA convert).
    expect(args[filterIndex + 1]).toContain("[0:v]fps=30[bg]");
    expect(args[filterIndex + 1]).not.toContain("format=rgba[bg]");
    // Only the overlay carries alpha and is scaled to full size.
    expect(args[filterIndex + 1]).toContain("format=rgba[ov]");
    expect(args[filterIndex + 1]).toContain("overlay=0:0");
    expect(args[filterIndex + 1]).toContain("eof_action=pass");

    expect(args).toContain("[v]");
    expect(args).toContain("2:a");
    expect(args).toContain("libx264");
    expect(args).not.toContain("copy");
    expect(args.at(-1)).toBe("final.mp4");
  });

  test("fails before spawning ffmpeg when a composite input is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "story-card-composite-"));
    try {
      const backgroundPath = join(dir, "background.mp4");
      const audioPath = join(dir, "voice.mp3");
      await writeFile(backgroundPath, "placeholder");
      await writeFile(audioPath, "placeholder");

      await expect(
        composeStoryCardReel({
          backgroundVideoPath: backgroundPath,
          overlayVideoPath: join(dir, "missing-overlay.mov"),
          ttsAudioPath: audioPath,
          outputPath: join(dir, "final.mp4"),
          durationMs: 1000,
          width: 1080,
          height: 1920,
          fps: 30,
          quality: "draft",
        }),
      ).rejects.toThrow("Missing story card overlay video");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
