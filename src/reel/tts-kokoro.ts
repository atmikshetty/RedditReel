import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import { createLogger } from "../utils/logger";
import { Semaphore } from "../utils/semaphore";
import type { Config } from "../config";
import type { ReelTTSOutput } from "./types";
import { KOKORO_DEFAULT_VOICE, KOKORO_VOICE_IDS } from "./constants";
import { concatFloat32, encodeWavPcm16 } from "./wav";

const log = createLogger("reel:tts-kokoro");

/** Supported ONNX quantization levels for the Kokoro model. */
export type KokoroDtype = "fp32" | "fp16" | "q8" | "q4" | "q4f16";

/** Options for local Kokoro-82M speech generation. */
export interface KokoroTTSOptions {
  /** Hugging Face model id (defaults to config.kokoroModelId). */
  model?: string;
  /** ONNX quantization level (defaults to config.kokoroDtype). */
  dtype?: KokoroDtype;
  /** Voice id, e.g. "af_heart" (defaults to config.kokoroDefaultVoice). */
  voice?: string;
  /** Speaking speed multiplier in [0.5, 2.0] (defaults to config.kokoroSpeed). */
  speed?: number;
}

/**
 * Lazily-loaded, process-wide cache of Kokoro model instances keyed by
 * `${modelId}:${dtype}`. Loading the model is expensive (download + ONNX init),
 * so we reuse a single instance across all TTS calls in a run.
 */
const modelCache = new Map<string, Promise<KokoroTTS>>();

function loadModel(modelId: string, dtype: KokoroDtype): Promise<KokoroTTS> {
  const key = `${modelId}:${dtype}`;
  const cached = modelCache.get(key);
  if (cached) {return cached;}

  log.info(`Loading Kokoro model ${modelId} (dtype=${dtype}, device=cpu)…`);
  const loading = KokoroTTS.from_pretrained(modelId, { dtype, device: "cpu" }).then((tts) => {
    log.info(`Kokoro model ${modelId} ready`);
    return tts;
  });
  // Drop the cache entry on failure so a later call can retry the load.
  loading.catch(() => modelCache.delete(key));
  modelCache.set(key, loading);
  return loading;
}

/** Resolves a requested voice to a valid Kokoro voice, falling back to the default. */
function resolveVoice(requested: string | undefined): string {
  if (requested && KOKORO_VOICE_IDS.has(requested)) {return requested;}
  if (requested) {log.warn(`Unknown Kokoro voice "${requested}", falling back to ${KOKORO_DEFAULT_VOICE}`);}
  return KOKORO_DEFAULT_VOICE;
}

/** Clamps the speaking speed into Kokoro's supported [0.5, 2.0] range. */
function resolveSpeed(requested: number | undefined, fallback: number): number {
  const speed = requested ?? fallback;
  return Math.max(0.5, Math.min(2.0, speed));
}

/**
 * Generates narration audio locally with Kokoro-82M and writes a WAV file.
 *
 * Uses the streaming sentence splitter so arbitrarily long scripts are
 * synthesized chunk-by-chunk (Kokoro has a per-utterance token limit) and then
 * concatenated into a single file. No network/API key is required once the
 * model weights are cached.
 *
 * @param text Narration script.
 * @param config Runtime configuration.
 * @param overrides Per-call voice/speed/model overrides.
 * @returns The audio file path, duration in ms, and format ("wav").
 */
export async function generateSpeechKokoro(
  text: string,
  config: Config,
  overrides?: KokoroTTSOptions,
): Promise<ReelTTSOutput> {
  const trimmed = text.trim();
  if (!trimmed) {throw new Error("Cannot generate speech from empty text");}

  const modelId = overrides?.model ?? config.kokoroModelId;
  const dtype = overrides?.dtype ?? config.kokoroDtype;
  const voice = resolveVoice(overrides?.voice ?? config.kokoroDefaultVoice);
  const speed = resolveSpeed(overrides?.speed, config.kokoroSpeed);

  log.info(`Generating speech via Kokoro: voice=${voice}, speed=${speed} (${trimmed.length} chars)`);

  const tts = await loadModel(modelId, dtype);

  // Split into sentences up front (Kokoro has a per-utterance token limit), then
  // synthesize them concurrently and concatenate in order. Parallelism overlaps
  // each sentence's phonemization with another's inference; the concatenated
  // result is identical to sequential synthesis — only the scheduling changes.
  const splitter = new TextSplitterStream();
  splitter.push(trimmed);
  splitter.close();
  const sentences = [...splitter.sentences];
  if (sentences.length === 0) {sentences.push(trimmed);}

  // `voice` is validated against KOKORO_VOICE_IDS above; cast the options to
  // satisfy the library's `keyof typeof VOICES` literal-union parameter type.
  const genOptions = { voice, speed } as Parameters<KokoroTTS["generate"]>[1];
  const concurrency = Math.max(1, Math.min(config.kokoroConcurrency, sentences.length));
  log.info(`Synthesizing ${sentences.length} sentences (concurrency=${concurrency})`);

  const sem = new Semaphore(concurrency);
  const sampleArrays: (Float32Array | undefined)[] = new Array(sentences.length);
  let sampleRate = 24000;
  await Promise.all(sentences.map(async (sentence, index) => {
    await sem.acquire();
    try {
      const audio = await tts.generate(sentence, genOptions);
      sampleArrays[index] = audio.audio;
      sampleRate = audio.sampling_rate;
    } finally {
      sem.release();
    }
  }));

  // Concatenate in sentence order, dropping any empty results.
  const chunks = sampleArrays.filter((a): a is Float32Array => a !== undefined && a.length > 0);
  if (chunks.length === 0) {throw new Error("Kokoro TTS produced no audio");}

  const merged = concatFloat32(chunks);
  const wav = encodeWavPcm16(merged, sampleRate);

  const outputDir = join(config.paths.data, "reels", "audio");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, `narration_kokoro_${Date.now()}.wav`);
  await writeFile(outputPath, wav);

  const durationMs = Math.round((merged.length / sampleRate) * 1000);
  log.info(`Generated ${durationMs}ms audio at ${outputPath}`);

  return { audioPath: outputPath, durationMs, format: "wav" };
}
