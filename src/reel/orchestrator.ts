import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "../utils/logger";
import { getVideoDuration, runFfmpeg } from "../utils/ffmpeg";
import type { Config } from "../config";
import { downloadSourceVideo, detectPlatformFromUrl, type DownloadedSourceClip } from "./source-url";
import { generateSpeechKokoro } from "./tts-kokoro";
import { generateSubtitles, expandSegmentsToWordTimestamps } from "./subtitle";
import { saveReelToHistory } from "./history";
import {
  normalizeStoryScript,
  chunkStoryText,
  buildCardTimeline,
  renderStoryCardOverlay,
  composeStoryCardReel,
  validateStoryCardOptions,
  saveTimeline,
  DEFAULT_STORY_CARD_OPTIONS,
  type BuildTimelineInput,
} from "./story-card";
import type { ReelJob, ReelPipelineOutput, ReelScriptInput, ReelStepResult, ReelPipelineMetadata, ReelSource } from "./types";

const log = createLogger("reel:orchestrator");

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

/**
 * Maps narration tone to a Kokoro speaking-speed multiplier. Kokoro has no
 * free-text style prompt, so tone is expressed by slowing the cadence for
 * intimate/dramatic deliveries; the base speed is never exceeded.
 */
function ttsSpeedForTone(tone: string, baseSpeed: number): number {
  switch (tone) {
    case "dramatic":
      return Math.min(baseSpeed, 0.95);
    default:
      return baseSpeed;
  }
}

/**
 * Runs a pipeline step while publishing its progress onto the job in real time.
 *
 * The step is appended as `in_progress` before `fn` runs and flipped to
 * `success`/`failed` afterwards. Each transition reassigns `job.steps` and bumps
 * `job.updatedAt` so the SSE snapshot stream sees a changed payload and pushes the
 * update immediately, instead of every step landing at once when the job finishes.
 */
async function measureStep<T>(job: ReelJob, steps: ReelStepResult[], stepName: string, fn: () => Promise<T>): Promise<{ result: T; stepResult: ReelStepResult }> {
  const start = Date.now();
  const entry: ReelStepResult = { step: stepName, status: "in_progress", durationMs: 0 };
  steps.push(entry);
  job.steps = [...steps];
  job.updatedAt = new Date().toISOString();
  try {
    const result = await fn();
    entry.status = "success";
    entry.durationMs = Date.now() - start;
    job.steps = [...steps];
    job.updatedAt = new Date().toISOString();
    log.info(`${stepName} completed in ${entry.durationMs}ms`);
    return { result, stepResult: entry };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    entry.status = "failed";
    entry.durationMs = Date.now() - start;
    entry.error = message;
    job.steps = [...steps];
    job.updatedAt = new Date().toISOString();
    log.error(`${stepName} failed: ${message}`);
    return { result: undefined as T, stepResult: entry };
  }
}

export class ReelOrchestrator {
  private config: Config;
  private jobs: Map<string, ReelJob> = new Map();

  constructor(config: Config) {
    this.config = config;
  }

  getJob(jobId: string): ReelJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): ReelJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createJob(input: ReelScriptInput): ReelJob {
    const id = `reel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const job: ReelJob = {
      id, script: input.text, sourceUrl: input.source.url,
      voiceId: input.voiceId ?? this.config.kokoroDefaultVoice,
      tone: input.tone ?? "storytelling",
      quality: input.quality ?? "standard",
      ttsProvider: "kokoro",
      ttsModel: input.ttsModel ?? this.config.kokoroModelId,
      storyCard: input.storyCard,
      status: "queued", videoPath: null, audioPath: null,
      subtitlePath: null, durationMs: null, error: null,
      steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    this.jobs.set(id, job);
    return job;
  }

  async runJob(jobId: string): Promise<ReelPipelineOutput> {
    const job = this.jobs.get(jobId);
    if (!job) {throw new Error(`Reel job not found: ${jobId}`);}
    job.status = "running";
    job.updatedAt = new Date().toISOString();
    const overallStart = Date.now();
    const steps: ReelStepResult[] = [];
    let clipPath: string | undefined;
    // Records each step onto the job as it runs so progress streams live (see measureStep).
    const measure = <T>(stepName: string, fn: () => Promise<T>) => measureStep(job, steps, stepName, fn);

    try {
      const { stepResult: validateStep } = await measure("Validate Story Input", async () => {
        const validation = validateStoryCardOptions(job.script, job.storyCard ?? {});
        if (!validation.valid) {throw new Error(`Story card validation failed: ${validation.errors.join(", ")}`);}
        return validation;
      });
      if (validateStep.status === "failed") {throw new Error(validateStep.error ?? "Validation failed");}

      const { result: normalized, stepResult: normalizeStep } = await measure("Normalize Script", async () => {
        return normalizeStoryScript(job.script);
      });
      if (normalizeStep.status === "failed") {throw new Error(normalizeStep.error ?? "Script normalization failed");}

      const { result: clip, stepResult: assetStep } = await measure("Select Asset", async () => {
        const source: ReelSource = { type: "url", url: job.sourceUrl, platform: detectPlatformFromUrl(job.sourceUrl) };
        return this.selectSourceAsset(source);
      });
      if (!clip) {throw new Error(assetStep.error ?? "Asset selection failed");}
      clipPath = clip.path;
      if (assetStep.status === "failed") {throw new Error(assetStep.error ?? "Asset selection failed");}

      const { result: ttsOutput, stepResult: ttsStep } = await measure("Text-to-Speech", async () => {
        return generateSpeechKokoro(job.script, this.config, {
          model: job.ttsModel, voice: job.voiceId,
          speed: ttsSpeedForTone(job.tone, this.config.kokoroSpeed),
        });
      });
      if (ttsStep.status === "failed") {throw new Error(ttsStep.error ?? "TTS failed");}
      job.audioPath = ttsOutput.audioPath;
      const ttsDurationMs = ttsOutput.durationMs;

      let subtitleSegments: import("./types").ReelSubtitleSegment[] = [];
      if (job.storyCard?.timingMode === "word-aligned") {
        const { result: subtitleOutput, stepResult: subStep } = await measure("Generate Subtitles", async () => {
          return generateSubtitles(ttsOutput.audioPath, job.script, this.config);
        });
        if (subStep.status === "success" && subtitleOutput) {
          subtitleSegments = subtitleOutput.segments;
          job.subtitlePath = subtitleOutput.srtPath;
        }
      }

      const { result: chunks, stepResult: chunkStep } = await measure("Chunk Story", async () => {
        const storyOptions = { ...DEFAULT_STORY_CARD_OPTIONS, ...job.storyCard };
        return chunkStoryText(normalized!, storyOptions);
      });
      if (chunkStep.status === "failed") {throw new Error(chunkStep.error ?? "Chunking failed");}

      const { result: timeline, stepResult: timelineStep } = await measure("Build Timeline", async () => {
        const storyOptions = { ...DEFAULT_STORY_CARD_OPTIONS, ...job.storyCard };
        const timelineInput: BuildTimelineInput = {
          chunks: chunks!, normalized: normalized!, audioDurationMs: ttsDurationMs, options: storyOptions,
          wordTimestamps: subtitleSegments.length > 0 ? expandSegmentsToWordTimestamps(subtitleSegments) : undefined,
        };
        return buildCardTimeline(timelineInput);
      });
      if (timelineStep.status === "failed") {throw new Error(timelineStep.error ?? "Timeline building failed");}

      const outputDir = join(this.config.paths.output, "reels");
      await saveTimeline(timeline!, outputDir, job.id);

      // Background prep and overlay render both depend only on the selected clip
      // and the TTS duration, and are independent of each other (the Remotion
      // overlay is rendered with a transparent background — it never reads the
      // prepared clip). Run them concurrently so the shorter background encode is
      // hidden under the much longer overlay render instead of running in series.
      const storyOptions = { ...DEFAULT_STORY_CARD_OPTIONS, ...job.storyCard };
      const [
        { result: preparedBgPath, stepResult: bgPrepStep },
        { result: overlayResult, stepResult: overlayStep },
      ] = await Promise.all([
        measure("Prepare Background Video", async () => {
          return this.prepareBackgroundVideo(clipPath!, ttsDurationMs / 1000, {
            dim: storyOptions.backgroundDim, blur: storyOptions.backgroundBlur,
          });
        }),
        measure("Render Card Overlay", async () => {
          return renderStoryCardOverlay({
            jobId: job.id, timeline: timeline!, outputDir,
            width: this.config.outputWidth, height: this.config.outputHeight, fps: 30,
            quality: job.quality as "draft" | "standard" | "high",
            concurrency: this.config.remotionConcurrency,
          });
        }),
      ]);
      if (bgPrepStep.status === "failed") {throw new Error(bgPrepStep.error ?? "Background video preparation failed");}
      if (overlayStep.status === "failed") {throw new Error(overlayStep.error ?? "Overlay rendering failed");}

      const { result: videoPath, stepResult: compositeStep } = await measure("Composite Video", async () => {
        return composeStoryCardReel({
          backgroundVideoPath: preparedBgPath!,
          ttsAudioPath: ttsOutput.audioPath,
          overlayVideoPath: overlayResult!.overlayPath,
          outputPath: join(outputDir, `${job.id}.mp4`),
          durationMs: ttsDurationMs,
          width: this.config.outputWidth, height: this.config.outputHeight, fps: 30,
          quality: job.quality as "draft" | "standard" | "high",
        });
      });
      if (compositeStep.status === "failed") {throw new Error(compositeStep.error ?? "Video composition failed");}

      const totalRenderTime = Date.now() - overallStart;
      job.videoPath = videoPath;
      job.durationMs = ttsDurationMs;
      const metadata: ReelPipelineMetadata = {
        totalDuration: formatDuration(ttsDurationMs), assetUsed: clipPath!,
        voiceId: job.voiceId, modelId: job.ttsModel,
        renderTimeMs: totalRenderTime, steps, storyCard: job.storyCard,
      };
      job.status = "completed";
      job.steps = steps;
      job.updatedAt = new Date().toISOString();
      log.info(`Story card reel ${jobId} completed in ${totalRenderTime}ms: ${videoPath}`);
      void saveReelToHistory(job).catch(() => {});
      return { videoPath, audioPath: ttsOutput.audioPath, subtitlePath: job.subtitlePath ?? null, durationMs: ttsDurationMs, segments: subtitleSegments, metadata };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = message;
      job.steps = steps;
      job.updatedAt = new Date().toISOString();
      log.error(`Story card reel ${jobId} failed: ${message}`);
      throw err;
    }
  }

  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  private async selectSourceAsset(source: ReelSource): Promise<DownloadedSourceClip | null> {
    return downloadSourceVideo(source, this.config);
  }

  private async prepareBackgroundVideo(videoPath: string, durationSec: number, options?: { dim?: number; blur?: number }): Promise<string> {
    const tempDir = join(this.config.paths.data, "reels", "temp");
    await mkdir(tempDir, { recursive: true });
    const width = this.config.outputWidth;
    const height = this.config.outputHeight;

    // Async ffprobe/ffmpeg (the previous spawnSync calls blocked Node's event
    // loop, which would freeze a concurrently-running Remotion render).
    const videoDuration = await getVideoDuration(videoPath);
    const outputPath = join(tempDir, `bg_${Date.now()}.mp4`);

    let videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    if (options?.dim && options.dim > 0) {videoFilter += `,eq=brightness=${-options.dim}`;}
    if (options?.blur && options.blur > 0) {videoFilter += `,boxblur=${Math.min(options.blur, 30)}:1`;}

    const args = ["-y", "-i", videoPath, "-t", String(durationSec), "-vf", videoFilter, "-c:v", "libx264", "-preset", "ultrafast", "-an", "-pix_fmt", "yuv420p", outputPath];
    if (videoDuration < durationSec) {
      const loopCount = Math.ceil(durationSec / videoDuration);
      args.splice(1, 0, "-stream_loop", String(loopCount - 1));
    }
    await runFfmpeg(args);
    return outputPath;
  }
}
