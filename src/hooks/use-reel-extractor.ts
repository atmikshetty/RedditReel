"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReelJob, ReelSource } from "@/reel/types";

/** Status information for a single reel pipeline step. */
export interface ReelStepInfo {
  step: string;
  status: "completed" | "failed" | "in_progress" | "pending";
  label: string;
}

const STEP_LABELS: Record<string, string> = {
  "Select Asset": "Selecting source",
  "Validate Story Input": "Validating story",
  "Normalize Script": "Normalizing script",
  "Text-to-Speech": "Generating speech",
  "Generate Subtitles": "Creating subtitles",
  "Chunk Story": "Chunking story",
  "Build Timeline": "Building timeline",
  "Render Card Overlay": "Rendering cards",
  "Composite Video": "Composing video",
  "Render Video": "Rendering reel",
};

function getStepLabel(step: string): string {
  return STEP_LABELS[step] ?? step;
}

function mapJobToSteps(job: ReelJob | null): ReelStepInfo[] {
  if (!job) {
    return [
      { step: "Select Asset", label: "Selecting source", status: "pending" },
      { step: "Text-to-Speech", label: "Generating speech", status: "pending" },
      { step: "Generate Subtitles", label: "Creating subtitles", status: "pending" },
      { step: "Render Video", label: "Rendering reel", status: "pending" },
    ];
  }

  const stepDefs = job.steps.map((stepResult) => ({
    step: stepResult.step, label: getStepLabel(stepResult.step),
  }));

  const seenSteps = new Set(job.steps.map((s) => s.step));
  const allPossibleSteps = ["Select Asset", "Validate Story Input", "Normalize Script", "Text-to-Speech", "Generate Subtitles", "Chunk Story", "Build Timeline", "Render Card Overlay", "Composite Video"];

  for (const stepName of allPossibleSteps) {
    if (!seenSteps.has(stepName)) {
      stepDefs.push({ step: stepName, label: getStepLabel(stepName) });
    }
  }

  return stepDefs.map((stepDef) => {
    const stepResult = job.steps.find((s) => s.step === stepDef.step);
    // The backend reports each step's status live (in_progress → success/failed), so honor it directly.
    if (stepResult?.status === "success") {return { ...stepDef, status: "completed" as const };}
    if (stepResult?.status === "failed") {return { ...stepDef, status: "failed" as const };}
    if (stepResult?.status === "in_progress") {return { ...stepDef, status: "in_progress" as const };}
    // Steps that never ran (e.g. subtitles in estimated mode) are shown complete once the job finishes.
    if (job.status === "completed") {return { ...stepDef, status: "completed" as const };}
    return { ...stepDef, status: "pending" as const };
  });
}

/** Full state returned by the useReelExtractor hook. */
export interface ReelExtractorState {
  error: string | null;
  isDone: boolean;
  isProcessing: boolean;
  isStarting: boolean;
  jobId: string | null;
  job: ReelJob | null;
  steps: ReelStepInfo[];
  videoUrl: string | null;
  reset: () => void;
  submitScript: (text: string, options: ReelSubmitOptions) => Promise<void>;
}

/** Options for submitting a reel generation request. */
export interface ReelSubmitOptions {
  voiceId?: string;
  tone?: "dramatic" | "neutral" | "storytelling";
  source: ReelSource;
  quality?: "draft" | "standard" | "high";
  ttsProvider?: "kokoro";
  ttsModel?: string;
  storyCard?: Record<string, unknown>;
}

function getApiErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "error" in payload && typeof (payload as Record<string, unknown>).error === "string") {
    return (payload as Record<string, string>).error;
  }
  return null;
}

/**
 * React hook for managing reel generation lifecycle with SSE progress streaming.
 */
export function useReelExtractor(): ReelExtractorState {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ReelJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isProcessing = jobId !== null && job?.status !== "completed" && job?.status !== "failed";
  const isDone = jobId !== null && (job?.status === "completed" || job?.status === "failed");

  useEffect(() => {
    if (!jobId) { return; }
    const source = new EventSource(`/api/reels/${jobId}/stream`);
    eventSourceRef.current = source;

    const onJob = (event: Event): void => {
      const messageEvent = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(messageEvent.data) as { job: ReelJob };
        setJob(payload.job);
      } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    };

    source.addEventListener("reel-job", onJob);
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED && eventSourceRef.current === source) {eventSourceRef.current = null;}
    };

    return () => {
      source.removeEventListener("reel-job", onJob);
      source.close();
      if (eventSourceRef.current === source) {eventSourceRef.current = null;}
    };
  }, [jobId]);

  const steps = mapJobToSteps(job);
  const videoUrl = job?.videoPath ? `/api/reels/${job.id}/video` : null;

  const submitScript = useCallback(async (text: string, options: ReelSubmitOptions): Promise<void> => {
    try {
      setIsStarting(true);
      setError(null);
      setJob(null);

      const requestBody: Record<string, unknown> = {
        text, voiceId: options.voiceId, tone: options.tone,
        quality: options.quality, ttsProvider: options.ttsProvider,
        ttsModel: options.ttsModel,
        storyCard: options.storyCard,
        sourceUrl: options.source.url,
      };

      const response = await fetch("/api/reels", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json()) as unknown;
      if (!response.ok) {throw new Error(getApiErrorMessage(payload) ?? "Failed to start reel generation");}

      const runPayload = payload as { job: ReelJob };
      setJobId(runPayload.job.id);
      setJob(runPayload.job);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setIsStarting(false); }
  }, []);

  const reset = useCallback(() => { setJobId(null); setJob(null); setError(null); }, []);

  return { error, isDone, isProcessing, isStarting, jobId, job, steps, videoUrl, reset, submitScript };
}
