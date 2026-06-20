import os from "node:os";
import { z } from "zod";

/** Zod schema for validating runtime configuration from environment variables. */
const configSchema = z.object({
  transcriptionProvider: z.enum(["local"]).default("local"),
  whisperModel: z.enum(["tiny", "base", "small", "medium", "large"]).default("medium"),
  captionWhisperModel: z.enum(["tiny", "base", "small", "medium", "large"]).default("base"),
  maxParallelClips: z.coerce.number().int().min(1).max(10).default(3),
  fastMode: z.coerce.boolean().default(true),
  removeSilence: z.coerce.boolean().default(false),
  captionRenderer: z.enum(["ffmpeg", "remotion"]).default("ffmpeg"),
  silenceThresholdDb: z.coerce.number().default(-35),
  silenceMinDuration: z.coerce.number().default(0.8),
  outputWidth: z.coerce.number().default(1080),
  outputHeight: z.coerce.number().default(1920),
  clipSpeed: z.coerce.number().min(1).max(2).default(1.2),
  maxClips: z.coerce.number().int().min(0).default(0),
  clipNiche: z.string().default("auto"),
  clipMinDuration: z.coerce.number().int().min(5).max(600).default(30),
  clipMaxDuration: z.coerce.number().int().min(5).max(600).default(90),
  clipTwoPass: z.coerce.boolean().default(true),
  clipMinScore: z.coerce.number().min(0).max(100).default(0),
  clipDedupeOverlap: z.coerce.number().min(0).max(1).default(0.4),
  maxTopK: z.coerce.number().int().min(1).max(50).default(10),
  preferYouTubeTranscripts: z.coerce.boolean().default(true),
  captionAnimate: z.coerce.boolean().default(true),
  captionFontSize: z.coerce.number().int().min(24).max(96).default(52),
  captionPrimaryColor: z.string().default("#FFFFFF"),
  captionHighlightColor: z.string().default("#FFD700"),
  captionPosition: z.enum(["bottom", "top", "middle"]).default("bottom"),
  captionBackgroundOpacity: z.coerce.number().min(0).max(1).default(0.8),
  captionUpperCase: z.coerce.boolean().default(true),
  captionFontFamily: z.string().default("Arial, Helvetica, sans-serif"),
  captionShowBackground: z.coerce.boolean().default(true),
  paths: z.object({
    data: z.string().default("./data"),
    output: z.string().default("./output"),
  }).default({}),
  // Kokoro-82M local open-weight TTS (runs offline via ONNX, no API key required).
  kokoroModelId: z.string().default("onnx-community/Kokoro-82M-v1.0-ONNX"),
  kokoroDtype: z.enum(["fp32", "fp16", "q8", "q4", "q4f16"]).default("q8"),
  kokoroDefaultVoice: z.string().default("af_heart"),
  kokoroSpeed: z.coerce.number().min(0.5).max(2.0).default(1.0),
  // Number of sentences synthesized concurrently by Kokoro. TTS is the second
  // biggest stage and runs sentence-by-sentence; synthesizing a few in parallel
  // overlaps phonemization with inference. Set to 1 to restore sequential output.
  kokoroConcurrency: z.coerce.number().int().min(1).max(16).default(4),
  // Number of parallel Chrome workers Remotion uses to rasterize overlay frames.
  // Frame rasterization (not encoding) dominates the overlay render, so this is
  // the main lever. Defaults to ~80% of cores, leaving headroom for ffmpeg.
  remotionConcurrency: z.coerce.number().int().min(1).max(64).default(Math.max(1, Math.floor(os.cpus().length * 0.8))),
});

/** Inferred configuration type from the schema. */
export type Config = z.infer<typeof configSchema>;

function readEnv(name: string): string | undefined {
  if (typeof Bun !== "undefined") {
    return Bun.env[name];
  }
  return process.env[name];
}

export function loadConfig(): Config {
  return configSchema.parse({
    transcriptionProvider: readEnv("TRANSCRIPTION_PROVIDER"),
    whisperModel: readEnv("WHISPER_MODEL"),
    captionWhisperModel: readEnv("CAPTION_WHISPER_MODEL"),
    maxParallelClips: readEnv("MAX_PARALLEL_CLIPS"),
    fastMode: readEnv("FAST_MODE"),
    removeSilence: readEnv("REMOVE_SILENCE"),
    captionRenderer: readEnv("CAPTION_RENDERER"),
    silenceThresholdDb: readEnv("SILENCE_THRESHOLD_DB"),
    silenceMinDuration: readEnv("SILENCE_MIN_DURATION"),
    outputWidth: readEnv("OUTPUT_WIDTH"),
    outputHeight: readEnv("OUTPUT_HEIGHT"),
    clipSpeed: readEnv("CLIP_SPEED"),
    maxClips: readEnv("MAX_CLIPS"),
    clipNiche: readEnv("CLIP_NICHE"),
    clipMinDuration: readEnv("CLIP_MIN_DURATION"),
    clipMaxDuration: readEnv("CLIP_MAX_DURATION"),
    clipTwoPass: readEnv("CLIP_TWO_PASS"),
    clipMinScore: readEnv("CLIP_MIN_SCORE"),
    clipDedupeOverlap: readEnv("CLIP_DEDUPE_OVERLAP"),
    maxTopK: readEnv("MAX_TOP_K"),
    preferYouTubeTranscripts: readEnv("PREFER_YOUTUBE_TRANSCRIPTS"),
    captionAnimate: readEnv("CAPTION_ANIMATE"),
    captionFontSize: readEnv("CAPTION_FONT_SIZE"),
    captionPrimaryColor: readEnv("CAPTION_PRIMARY_COLOR"),
    captionHighlightColor: readEnv("CAPTION_HIGHLIGHT_COLOR"),
    captionPosition: readEnv("CAPTION_POSITION"),
    captionBackgroundOpacity: readEnv("CAPTION_BACKGROUND_OPACITY"),
    captionUpperCase: readEnv("CAPTION_UPPER_CASE"),
    captionFontFamily: readEnv("CAPTION_FONT_FAMILY"),
    captionShowBackground: readEnv("CAPTION_SHOW_BACKGROUND"),
    paths: {},
    kokoroModelId: readEnv("KOKORO_MODEL_ID"),
    kokoroDtype: readEnv("KOKORO_DTYPE"),
    kokoroDefaultVoice: readEnv("KOKORO_DEFAULT_VOICE"),
    kokoroSpeed: readEnv("KOKORO_SPEED"),
    kokoroConcurrency: readEnv("KOKORO_CONCURRENCY"),
    remotionConcurrency: readEnv("REMOTION_CONCURRENCY"),
  });
}
