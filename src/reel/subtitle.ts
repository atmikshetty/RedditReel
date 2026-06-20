import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createLogger } from "../utils/logger";
import type { Config } from "../config";
import type { ReelSubtitleOutput, ReelSubtitleSegment } from "./types";

const log = createLogger("reel:subtitle");

function getAudioDurationMs(audioPath: string): number {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath], { encoding: "utf-8" });
  if (result.status !== 0) {throw new Error(result.stderr || `ffprobe exited with code ${result.status}`);}
  return Math.round(parseFloat(result.stdout.trim()) * 1000);
}

/**
 * Formats a millisecond timestamp into SRT time format (HH:MM:SS,mmm).
 */
function formatSRTTime(ms: number): string {
  const totalSec = ms / 1000;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = Math.floor(totalSec % 60);
  const millis = Math.round((totalSec - Math.floor(totalSec)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Generates approximate subtitle segments by evenly distributing words across duration.
 */
export function generateApproximateSegments(text: string, totalDurationMs: number): ReelSubtitleSegment[] {
  const words = text.split(/\s+/);
  const avgWordDuration = totalDurationMs / words.length;
  const segments: ReelSubtitleSegment[] = [];
  const maxWordsPerSegment = 7;
  let wordIndex = 0;
  let segmentIndex = 1;

  while (wordIndex < words.length) {
    const wordsRemaining = words.length - wordIndex;
    const wordCount = Math.min(maxWordsPerSegment, wordsRemaining);
    const segmentWords = words.slice(wordIndex, wordIndex + wordCount);
    const startMs = Math.round(wordIndex * avgWordDuration);
    const endMs = Math.round(Math.min((wordIndex + wordCount) * avgWordDuration, totalDurationMs));
    segments.push({ index: segmentIndex, startMs, endMs, text: segmentWords.join(" ") });
    wordIndex += wordCount;
    segmentIndex++;
  }
  return segments;
}

/**
 * Expands phrase-level subtitle segments into per-word timestamps (in seconds,
 * relative to the audio start).
 *
 * Whisper emits one timestamp per spoken phrase, not per word, so each segment's
 * duration is distributed evenly across its words. The resulting array is indexed
 * by absolute word position, which is what word-aligned card timing expects.
 */
export function expandSegmentsToWordTimestamps(segments: ReelSubtitleSegment[]): Array<{ start: number; end: number }> {
  const wordTimestamps: Array<{ start: number; end: number }> = [];
  for (const segment of segments) {
    const words = segment.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {continue;}
    const startSec = segment.startMs / 1000;
    const endSec = segment.endMs / 1000;
    const perWordSec = (endSec - startSec) / words.length;
    for (let i = 0; i < words.length; i++) {
      wordTimestamps.push({ start: startSec + i * perWordSec, end: startSec + (i + 1) * perWordSec });
    }
  }
  return wordTimestamps;
}

/**
 * Converts an array of subtitle segments to SRT format string.
 */
export function segmentsToSRT(segments: ReelSubtitleSegment[]): string {
  return segments.map((seg) =>
    `${seg.index}\n${formatSRTTime(seg.startMs)} --> ${formatSRTTime(seg.endMs)}\n${seg.text}\n`
  ).join("\n");
}

/**
 * Transcribes audio using Whisper CLI, falling back to empty segments on failure.
 */
export async function transcribeWithWhisper(audioPath: string, config: Config): Promise<ReelSubtitleSegment[]> {
  const tempDir = join(config.paths.data, "reels", "temp");
  await mkdir(tempDir, { recursive: true });
  const outputBase = join(tempDir, `whisper_${Date.now()}`);
  const modelDir = join(process.cwd(), "models");
  const modelPath = join(modelDir, `ggml-${config.whisperModel}.bin`);

  const result = spawnSync("whisper-cli", [
    "-m", modelPath,
    "-f", audioPath,
    "-l", "en",
    "-oj", "--output-json-full",
    "-of", outputBase,
    "-np",
  ], { encoding: "utf-8", timeout: 120000 });

  if (result.status !== 0) {
    log.warn(`Whisper failed, using approximate timing: ${result.stderr?.slice(0, 200)}`);
    return [];
  }

  try {
    const jsonData = JSON.parse(await readFile(`${outputBase}.json`, "utf-8"));
    if (!jsonData.transcription || !Array.isArray(jsonData.transcription)) {return [];}
    return jsonData.transcription
      .filter((s: { text: string; offsets: { from: number; to: number } }) => s.text?.trim())
      .map((s: { text: string; offsets: { from: number; to: number } }, i: number) => ({
        index: i + 1,
        startMs: Math.round(s.offsets.from),
        endMs: Math.round(s.offsets.to),
        text: s.text.trim(),
      }));
  } catch {
    return [];
  }
}

/**
 * Generates subtitle file from audio, using Whisper transcription or approximate timing.
 */
export async function generateSubtitles(
  audioPath: string,
  script: string,
  config: Config,
): Promise<ReelSubtitleOutput> {
  const audioDurationMs = getAudioDurationMs(audioPath);
  const segments = await transcribeWithWhisper(audioPath, config);
  const finalSegments = segments.length > 0 ? segments : generateApproximateSegments(script, audioDurationMs);

  const outputDir = join(config.paths.data, "reels", "subtitles");
  await mkdir(outputDir, { recursive: true });
  const srtPath = join(outputDir, `subs_${Date.now()}.srt`);
  const srtContent = segmentsToSRT(finalSegments);
  await writeFile(srtPath, srtContent);

  return { segments: finalSegments, srtPath, format: "srt" };
}
