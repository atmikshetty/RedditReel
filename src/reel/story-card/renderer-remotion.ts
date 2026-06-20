import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createLogger } from "../../utils/logger";
import { Semaphore } from "../../utils/semaphore";
import type { RenderStoryCardOverlayInput, RenderStoryCardOverlayOutput } from "./types";

const log = createLogger("story-card:renderer-remotion");

let bundlePromise: Promise<string> | null = null;
const renderSemaphore = new Semaphore(1);

function resolveRemotionEntryPoint(): string {
  for (const root of [process.env.PWD, process.env.INIT_CWD, process.cwd()].filter(Boolean) as string[]) {
    const entryPoint = resolve(root, "src/remotion/index.tsx");
    if (existsSync(entryPoint)) {return entryPoint;}
  }
  throw new Error("Could not locate Remotion entrypoint at src/remotion/index.tsx");
}

async function ensureBundle(): Promise<string> {
  if (!bundlePromise) {
    const entryPoint = resolveRemotionEntryPoint();
    log.info(`Bundling Remotion project: ${entryPoint}`);
    // Persist webpack's filesystem cache so server restarts reuse the bundle
    // instead of recompiling cold. Webpack content-hashes its inputs, so the
    // cache self-invalidates when the Remotion components or deps change.
    bundlePromise = bundle({ entryPoint, webpackOverride: (config) => ({ ...config, cache: { type: "filesystem" } }) });
    const location = await bundlePromise;
    log.info(`Remotion bundle ready: ${location}`);
  }
  return bundlePromise;
}

/**
 * Renders the story card overlay video using Remotion.
 * Falls back to a singleton render semaphore to prevent concurrent renders.
 */
export async function renderStoryCardOverlay(input: RenderStoryCardOverlayInput): Promise<RenderStoryCardOverlayOutput> {
  const { jobId, timeline, outputDir, width, height, fps, quality, concurrency } = input;
  const serveUrl = await ensureBundle();
  const overlayPath = join(outputDir, `story-card-overlay-${jobId}.mov`);
  const durationInFrames = Math.ceil((timeline.videoDurationMs / 1000) * fps);
  const inputProps = { timeline, width, height, fps, backgroundVideoUrl: null };

  // Per-frame rasterization cost scales with pixel count. Draft previews render
  // at reduced resolution (the compositor re-scales the overlay back to full
  // size); standard/high render at full resolution for crisp cards.
  const renderScale = quality === "draft" ? 0.6 : 1;

  log.info(`Rendering story card overlay: ${timeline.items.length} items, ${durationInFrames} frames (quality=${quality}, scale=${renderScale}, concurrency=${concurrency ?? "auto"})...`);
  await renderSemaphore.acquire();
  const startTime = Date.now();

  try {
    const composition = await selectComposition({ serveUrl, id: "StoryCardOverlay", inputProps });
    let lastLoggedPct = -1;
    await renderMedia({
      composition, serveUrl, codec: "prores", proResProfile: "4444",
      imageFormat: "png", pixelFormat: "yuva444p10le", outputLocation: overlayPath,
      inputProps, concurrency: concurrency ?? null, scale: renderScale,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 100);
        if (pct >= lastLoggedPct + 10) { lastLoggedPct = pct; log.info(`Story card overlay render: ${pct}%`); }
      },
    });
  } finally { renderSemaphore.release(); }

  const renderMs = Date.now() - startTime;
  log.info(`Story card overlay rendered: ${overlayPath} (${renderMs}ms, ${durationInFrames} frames)`);
  return { overlayPath, durationMs: timeline.videoDurationMs, frameCount: durationInFrames };
}

/** Pre-warms the Remotion bundle for faster subsequent renders. */
export async function warmupStoryCardRenderer(): Promise<void> {
  await ensureBundle();
}
