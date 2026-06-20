import { createLogger } from "../../utils/logger";
import type { StoryTextChunk, StoryCardTimeline, StoryCardTimelineItem, StoryCardOptions, NormalizedStoryScript } from "./types";

const log = createLogger("story-card:timing");
const MIN_CARD_DURATION_MS = 1200;
const MAX_CARD_DURATION_MS = 5500;
/** Default lead, in ms, by which each card appears before its spoken word. */
const DEFAULT_SYNC_LEAD_MS = 150;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Distributes total duration across cards, clamping each to min/max bounds. */
function smoothDurations(durations: number[], totalDurationMs: number): number[] {
  const total = durations.reduce((a, b) => a + b, 0);
  if (total === 0) {return durations.map(() => totalDurationMs / durations.length);}
  const scale = totalDurationMs / total;
  const scaled = durations.map((d) => d * scale);
  let remaining = totalDurationMs;
  for (let i = 0; i < scaled.length; i++) {
    scaled[i] = clamp(scaled[i], MIN_CARD_DURATION_MS, MAX_CARD_DURATION_MS);
    remaining -= scaled[i];
  }
  if (remaining > 0) {
    let distributable = remaining;
    for (let i = 0; i < scaled.length && distributable > 0; i++) {
      const canAdd = MAX_CARD_DURATION_MS - scaled[i];
      const add = Math.min(canAdd, distributable / (scaled.length - i));
      scaled[i] += add;
      distributable -= add;
    }
  } else if (remaining < 0) {
    let subtractable = -remaining;
    for (let i = 0; i < scaled.length && subtractable > 0; i++) {
      const canSubtract = scaled[i] - MIN_CARD_DURATION_MS;
      const subtract = Math.min(canSubtract, subtractable / (scaled.length - i));
      scaled[i] -= subtract;
      subtractable -= subtract;
    }
  }
  return scaled;
}

/**
 * Creates a single timeline item for a chunk over the given [startMs, endMs] window.
 * Cards are always anchored to the audio timeline, which begins at t=0, so the on-screen
 * text and the voiceover stay in sync.
 */
function createTimelineItem(
  chunk: StoryTextChunk,
  normalized: NormalizedStoryScript,
  options: StoryCardOptions,
  startMs: number,
  endMs: number,
  audioDurationMs: number,
): StoryCardTimelineItem {
  return {
    id: chunk.id, index: chunk.index, text: chunk.text,
    title: chunk.isTitleCard ? normalized.title : undefined,
    subreddit: normalized.subreddit, username: normalized.username,
    startMs, endMs, durationMs: endMs - startMs, progress: audioDurationMs > 0 ? endMs / audioDurationMs : 0,
    isTitleCard: chunk.isTitleCard ?? false, isOutroCard: chunk.isOutroCard ?? false,
    visual: { themeId: options.themeId ?? "reddit-light", layoutMode: options.layoutMode ?? "center-card", transition: options.transition ?? "scale-fade", position: options.cardPosition ?? "center" },
  };
}

/**
 * Builds a timeline using word-count estimation for card durations.
 *
 * Cards span the full audio: the first card is on screen from t=0 and the last card
 * ends exactly when the audio ends. The audio track plays from t=0 in the final
 * composite, so anchoring cards to the same origin keeps text and voiceover aligned.
 */
function buildEstimatedTimeline(chunks: StoryTextChunk[], audioDurationMs: number, normalized: NormalizedStoryScript, options: StoryCardOptions): StoryCardTimelineItem[] {
  const totalWords = chunks.reduce((sum, c) => sum + c.words.length, 0);
  const wordsDuration = totalWords > 0 ? audioDurationMs / totalWords : audioDurationMs;
  const rawDurations = chunks.map((chunk) => chunk.words.length * wordsDuration);
  const durations = smoothDurations(rawDurations, Math.max(audioDurationMs, chunks.length * MIN_CARD_DURATION_MS));
  let currentMs = 0;
  const items: StoryCardTimelineItem[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const startMs = currentMs;
    const endMs = startMs + durations[i];
    items.push(createTimelineItem(chunks[i], normalized, options, startMs, endMs, audioDurationMs));
    currentMs = endMs;
  }
  if (items.length > 0) {
    const last = items[items.length - 1];
    last.endMs = audioDurationMs;
    last.durationMs = last.endMs - last.startMs;
  }
  return items;
}

/**
 * Builds a timeline using word-level timestamp alignment from transcription.
 *
 * `wordTimestamps` is a per-word array (seconds, relative to the audio start). Each card
 * starts when its first spoken word begins and stays on screen until the next card's first
 * word, giving continuous, gap-free coverage that tracks the voiceover exactly.
 */
function buildWordAlignedTimeline(chunks: StoryTextChunk[], audioDurationMs: number, normalized: NormalizedStoryScript, options: StoryCardOptions, wordTimestamps?: Array<{ start: number; end: number }>): StoryCardTimelineItem[] {
  if (!wordTimestamps || wordTimestamps.length === 0) {return buildEstimatedTimeline(chunks, audioDurationMs, normalized, options);}
  const lastWordIdx = wordTimestamps.length - 1;

  // Start time (ms) of each card, taken from the first spoken word in that chunk.
  const starts = chunks.map((chunk) => {
    const idx = clamp(chunk.wordStartIndex, 0, lastWordIdx);
    return Math.min(Math.round(wordTimestamps[idx].start * 1000), audioDurationMs);
  });
  // The first card is visible from the very start of the audio.
  if (starts.length > 0) {starts[0] = 0;}
  // Keep starts non-decreasing so cards never run backwards or overlap.
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] < starts[i - 1]) {starts[i] = starts[i - 1];}
  }

  const items: StoryCardTimelineItem[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const startMs = starts[i];
    const endMs = i < chunks.length - 1 ? Math.max(starts[i + 1], startMs) : audioDurationMs;
    items.push(createTimelineItem(chunks[i], normalized, options, startMs, endMs, audioDurationMs));
  }
  return items;
}

/**
 * Pulls each card slightly ahead of its spoken word so text leads the voiceover.
 *
 * Every internal transition boundary moves earlier by up to `leadMs` (clamped so a
 * card never starts before the previous one). The first card still starts at t=0 and
 * the last still ends at the audio end, so coverage stays continuous and gap-free.
 * This mirrors how caption/karaoke systems display text a touch before the audio and
 * compensates for forced-alignment onset lag.
 */
function applySyncLead(items: StoryCardTimelineItem[], leadMs: number): StoryCardTimelineItem[] {
  if (leadMs <= 0 || items.length < 2) {return items;}
  for (let i = 1; i < items.length; i++) {
    const shifted = Math.max(items[i - 1].startMs, items[i].startMs - leadMs);
    items[i].startMs = shifted;
    items[i - 1].endMs = shifted;
  }
  for (const item of items) {item.durationMs = item.endMs - item.startMs;}
  return items;
}

/** Input for building a story card timeline. */
export interface BuildTimelineInput {
  chunks: StoryTextChunk[];
  normalized: NormalizedStoryScript;
  audioDurationMs: number;
  options: StoryCardOptions;
  wordTimestamps?: Array<{ start: number; end: number }>;
}

/**
 * Builds a complete story card timeline from chunks, audio duration, and options.
 */
export function buildCardTimeline(input: BuildTimelineInput): StoryCardTimeline {
  const { chunks, normalized, audioDurationMs, options, wordTimestamps } = input;
  const timingMode = options.timingMode ?? "estimated";
  log.info(`Building timeline: ${chunks.length} chunks, ${audioDurationMs}ms audio, mode: ${timingMode}`);

  let items: StoryCardTimelineItem[];
  switch (timingMode) {
    case "word-aligned": items = buildWordAlignedTimeline(chunks, audioDurationMs, normalized, options, wordTimestamps); break;
    case "sentence-aligned": items = buildEstimatedTimeline(chunks, audioDurationMs, normalized, options); break;
    default: items = buildEstimatedTimeline(chunks, audioDurationMs, normalized, options); break;
  }

  // Show each card a touch before its spoken word so text leads the voiceover.
  items = applySyncLead(items, options.syncLeadMs ?? DEFAULT_SYNC_LEAD_MS);

  const timeline: StoryCardTimeline = {
    version: 1, audioDurationMs, videoDurationMs: audioDurationMs, width: 1080, height: 1920, fps: 30, items,
    metadata: { title: normalized.title, subreddit: normalized.subreddit ?? "", username: normalized.username ?? "", totalWords: normalized.wordCount, chunkCount: items.length, timingMode },
  };

  log.info(`Timeline built: ${items.length} items, total duration: ${audioDurationMs}ms`);
  return timeline;
}
