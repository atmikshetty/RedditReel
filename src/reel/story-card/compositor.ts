import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { access, mkdir } from "node:fs/promises";
import { createLogger } from "../../utils/logger";
import { STORY_CARD_QUALITY_PRESETS } from "./constants";
import type { ComposeStoryCardReelInput } from "./types";

const log = createLogger("story-card:compositor");

async function assertInputFile(path: string, label: string): Promise<void> {
  try { await access(path); } catch { throw new Error(`Missing story card ${label}: ${path}`); }
}

/**
 * Builds the FFmpeg arguments for composing the final story card reel.
 */
export function buildStoryCardFfmpegArgs(input: ComposeStoryCardReelInput): string[] {
  const { backgroundVideoPath, ttsAudioPath, overlayVideoPath, outputPath, durationMs, width, height, fps, quality } = input;
  const durationSec = durationMs / 1000;
  const qs = STORY_CARD_QUALITY_PRESETS[quality] ?? STORY_CARD_QUALITY_PRESETS.standard;
  return [
    "-y", "-i", backgroundVideoPath, "-i", overlayVideoPath, "-i", ttsAudioPath,
    "-t", String(durationSec),
    // The background is already W×H from prepareBackgroundVideo, so it only needs
    // its frame rate normalized — no redundant rescale and no full-frame RGBA
    // conversion (only the overlay carries alpha). The overlay keeps its scale so
    // a reduced-resolution draft overlay is upscaled back to full size.
    "-filter_complex", `[0:v]fps=${fps}[bg];[1:v]scale=${width}:${height},format=rgba[ov];[bg][ov]overlay=0:0:eof_action=pass:format=auto[v]`,
    "-map", "[v]", "-map", "2:a",
    "-c:v", "libx264", "-preset", qs.preset, "-crf", String(qs.crf), "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", qs.audioBitrate, "-ar", "48000",
    "-af", `afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0, durationSec - 0.5)}:d=0.5,loudnorm=I=-16:LRA=11:TP=-1.5`,
    "-shortest", "-movflags", "+faststart", outputPath,
  ];
}

/**
 * Composes the final story card reel by overlaying cards on background video with TTS audio.
 */
export async function composeStoryCardReel(input: ComposeStoryCardReelInput): Promise<string> {
  const { outputPath, durationMs } = input;
  await mkdir(dirname(outputPath), { recursive: true });
  await Promise.all([assertInputFile(input.backgroundVideoPath, "background video"), assertInputFile(input.overlayVideoPath, "overlay video"), assertInputFile(input.ttsAudioPath, "audio")]);
  log.info(`Compositing story card reel: duration=${durationMs / 1000}s`);

  const ffmpegArgs = buildStoryCardFfmpegArgs(input);
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ffmpegArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
    proc.on("close", (code) => { if (code === 0) { log.info(`Story card reel composed: ${outputPath}`); resolve(outputPath); } else {reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));} });
    proc.on("error", (err) => reject(new Error(`FFmpeg spawn failed: ${err.message}`)));
  });
}
