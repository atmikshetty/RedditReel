/** Aggregated metrics for a completed reel pipeline run. */
export interface ReelMetrics {
  totalDurationMs: number;
  steps: number;
  completedSteps: number;
  failedSteps: number;
  assetType: string;
  voiceId: string;
  modelId: string;
}

/**
 * Computes reel metrics from pipeline execution data.
 */
export function calculateReelMetrics(
  renderTimeMs: number,
  steps: Array<{ status: string; durationMs: number }>,
  assetType: string,
  voiceId: string,
  modelId: string,
): ReelMetrics {
  return {
    totalDurationMs: renderTimeMs,
    steps: steps.length,
    completedSteps: steps.filter((s) => s.status === "success").length,
    failedSteps: steps.filter((s) => s.status === "failed").length,
    assetType,
    voiceId,
    modelId,
  };
}

/**
 * Formats metrics into a human-readable summary string.
 */
export function formatMetricsSummary(metrics: ReelMetrics): string {
  return [
    `Total: ${(metrics.totalDurationMs / 1000).toFixed(1)}s`,
    `Steps: ${metrics.completedSteps}/${metrics.steps}`,
    `Asset: ${metrics.assetType}`,
    `Voice: ${metrics.voiceId}`,
  ].join(" | ");
}
