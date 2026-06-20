import type { StoryCardOptions } from "./story-card/types";

export type TTSProvider = "kokoro";

export interface ReelSourceUrl {
  type: "url";
  url: string;
  platform?: "youtube";
}

export type ReelSource = ReelSourceUrl;

export interface ReelScriptInput {
  text: string;
  voiceId?: string;
  tone?: "dramatic" | "neutral" | "storytelling";
  source: ReelSource;
  quality?: "draft" | "standard" | "high";
  ttsProvider?: TTSProvider;
  ttsModel?: string;
  storyCard?: StoryCardOptions;
}

export interface ReelTTSOutput {
  audioPath: string;
  durationMs: number;
  format: string;
}

export interface ReelSubtitleSegment {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface ReelSubtitleOutput {
  segments: ReelSubtitleSegment[];
  srtPath: string;
  format: "srt";
}

export interface ReelPipelineOutput {
  videoPath: string;
  audioPath: string;
  subtitlePath: string | null;
  durationMs: number;
  segments: ReelSubtitleSegment[];
  metadata: ReelPipelineMetadata;
}

export interface ReelPipelineMetadata {
  totalDuration: string;
  assetUsed: string;
  voiceId: string;
  modelId: string;
  renderTimeMs: number;
  steps: ReelStepResult[];
  storyCard?: StoryCardOptions;
}

export interface ReelStepResult {
  step: string;
  status: "success" | "failed" | "in_progress";
  durationMs: number;
  error?: string;
}

export type ReelJobStatus = "queued" | "running" | "completed" | "failed";

export interface ReelJob {
  id: string;
  script: string;
  sourceUrl: string;
  voiceId: string;
  tone: string;
  quality: string;
  ttsProvider: TTSProvider;
  ttsModel: string;
  storyCard?: StoryCardOptions;
  status: ReelJobStatus;
  videoPath: string | null;
  audioPath: string | null;
  subtitlePath: string | null;
  durationMs: number | null;
  error: string | null;
  steps: ReelStepResult[];
  createdAt: string;
  updatedAt: string;
}
