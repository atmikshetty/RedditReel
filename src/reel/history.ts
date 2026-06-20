import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ReelJob, ReelStepResult, TTSProvider } from "./types";
import type { StoryCardOptions } from "./story-card/types";

const HISTORY_DIR = "data";
const HISTORY_FILE = join(HISTORY_DIR, "reel-history.json");

/** A historical entry for a completed or failed reel job. */
export interface ReelHistoryEntry {
  id: string;
  timestamp: number;
  script: string;
  sourceUrl?: string;
  voiceId: string;
  tone: string;
  quality: string;
  status: "queued" | "running" | "completed" | "failed";
  durationMs: number | null;
  renderTimeMs: number | null;
  videoPath: string | null;
  audioPath: string | null;
  subtitlePath: string | null;
  assetUsed: string | null;
  error: string | null;
  steps: ReelStepResult[];
  ttsProvider: TTSProvider;
  ttsModel: string;
  storyCard?: StoryCardOptions;
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a ReelJob to a history entry for persistent storage.
 */
function jobToHistoryEntry(job: ReelJob): ReelHistoryEntry {
  return {
    id: job.id, timestamp: Date.now(), script: job.script.slice(0, 200),
    sourceUrl: job.sourceUrl,
    voiceId: job.voiceId, tone: job.tone, quality: job.quality, status: job.status, durationMs: job.durationMs,
    renderTimeMs: job.steps.reduce((sum, s) => sum + s.durationMs, 0),
    videoPath: job.videoPath, audioPath: job.audioPath, subtitlePath: job.subtitlePath,
    assetUsed: job.steps.find((s) => s.step === "Select Asset")?.status === "success" ? "used" : null,
    error: job.error, steps: job.steps,
    ttsProvider: job.ttsProvider, ttsModel: job.ttsModel,
    storyCard: job.storyCard, createdAt: job.createdAt, updatedAt: job.updatedAt,
  };
}

export function historyEntryToJob(entry: ReelHistoryEntry): ReelJob {
  return {
    id: entry.id, script: entry.script, sourceUrl: entry.sourceUrl ?? "",
    voiceId: entry.voiceId, tone: entry.tone, quality: entry.quality,
    ttsProvider: entry.ttsProvider, ttsModel: entry.ttsModel, storyCard: entry.storyCard,
    status: entry.status, videoPath: entry.videoPath, audioPath: entry.audioPath,
    subtitlePath: entry.subtitlePath, durationMs: entry.durationMs,
    error: entry.error, steps: entry.steps, createdAt: entry.createdAt, updatedAt: entry.updatedAt,
  };
}

export async function getHistoryEntryById(id: string): Promise<ReelHistoryEntry | null> {
  const entries = await loadReelHistory();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function saveReelToHistory(job: ReelJob): Promise<void> {
  const entries = await loadReelHistory();
  entries.unshift(jobToHistoryEntry(job));
  if (!existsSync(HISTORY_DIR)) {await mkdir(HISTORY_DIR, { recursive: true });}
  await writeFile(HISTORY_FILE, JSON.stringify(entries, null, 2));
}

export async function loadReelHistory(): Promise<ReelHistoryEntry[]> {
  try {
    const data = await readFile(HISTORY_FILE, "utf-8");
    const raw = JSON.parse(data) as Array<Partial<ReelHistoryEntry>>;
    return raw.map((entry) => ({
      id: entry.id ?? "", timestamp: entry.timestamp ?? 0, script: entry.script ?? "",
      sourceUrl: entry.sourceUrl,
      voiceId: entry.voiceId ?? "", tone: entry.tone ?? "storytelling",
      quality: entry.quality ?? "standard",
      status: (entry.status as ReelHistoryEntry["status"]) ?? "completed",
      durationMs: entry.durationMs ?? null, renderTimeMs: entry.renderTimeMs ?? null,
      videoPath: entry.videoPath ?? null, audioPath: entry.audioPath ?? null,
      subtitlePath: entry.subtitlePath ?? null, assetUsed: entry.assetUsed ?? null,
      error: entry.error ?? null, steps: entry.steps ?? [],
      ttsProvider: (entry.ttsProvider as TTSProvider) ?? "kokoro",
      ttsModel: entry.ttsModel ?? "",
      storyCard: entry.storyCard,
      createdAt: entry.createdAt ?? new Date().toISOString(), updatedAt: entry.updatedAt ?? new Date().toISOString(),
    }));
  } catch { return []; }
}

export async function clearReelHistory(): Promise<void> {
  await writeFile(HISTORY_FILE, "[]");
}

export async function removeFromHistory(jobId: string): Promise<boolean> {
  const entries = await loadReelHistory();
  const index = entries.findIndex((entry) => entry.id === jobId);
  if (index === -1) {return false;}
  entries.splice(index, 1);
  if (!existsSync(HISTORY_DIR)) {await mkdir(HISTORY_DIR, { recursive: true });}
  await writeFile(HISTORY_FILE, JSON.stringify(entries, null, 2));
  return true;
}
