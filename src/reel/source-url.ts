import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { createLogger } from "../utils/logger";
import { detectPlatform } from "../utils/url-parser";
import type { Config } from "../config";
import type { ReelSource } from "./types";

const log = createLogger("reel:source-url");

/** Metadata for a downloaded source clip from a URL. */
export interface DownloadedSourceClip {
  path: string;
  originalUrl: string;
  platform: string;
  durationSec: number;
  width: number;
  height: number;
}

export function detectPlatformFromUrl(url: string): "youtube" | undefined {
  const p = detectPlatform(url);
  if (p === "generic") {return undefined;}
  return p as "youtube" | undefined;
}

export async function downloadSourceVideo(
  source: ReelSource & { type: "url" },
  config: Config,
): Promise<DownloadedSourceClip | null> {
  if (source.type !== "url") {return null;}

  // If the URL is a local cached file path, use it directly
  const resolvedUrl = resolve(source.url);
  if (existsSync(resolvedUrl)) {
    const probe = spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", resolvedUrl],
      { encoding: "utf-8" },
    );
    const duration = probe.status === 0 ? parseFloat(probe.stdout.trim()) : 0;
    return {
      path: resolvedUrl,
      originalUrl: source.url,
      platform: "cached",
      durationSec: duration,
      width: 1080,
      height: 1920,
    };
  }

  const cacheDir = resolve(config.paths.data, "reels", "source-cache");
  await mkdir(cacheDir, { recursive: true });

  const urlHash = Buffer.from(source.url).toString("base64").slice(0, 32).replace(/[/+=]/g, "_");
  const cachedPath = resolve(cacheDir, `${urlHash}.mp4`);

  if (existsSync(cachedPath)) {
    log.info(`Using cached source: ${cachedPath}`);
    const probe = spawnSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", cachedPath],
      { encoding: "utf-8" },
    );
    const duration = probe.status === 0 ? parseFloat(probe.stdout.trim()) : 0;
    return { path: cachedPath, originalUrl: source.url, platform: source.platform ?? "unknown", durationSec: duration, width: 1080, height: 1920 };
  }

  log.info(`Downloading source video: ${source.url}`);
  const result = spawnSync(
    "yt-dlp",
    [
      "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
      "--merge-output-format", "mp4",
      "-o", cachedPath,
      source.url,
    ],
    { stdio: "ignore", timeout: 300000 },
  );

  if (result.status !== 0) {
    log.error(`yt-dlp failed to download ${source.url}`);
    return null;
  }

  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", cachedPath],
    { encoding: "utf-8" },
  );
  const duration = probe.status === 0 ? parseFloat(probe.stdout.trim()) : 0;

  return { path: cachedPath, originalUrl: source.url, platform: source.platform ?? "unknown", durationSec: duration, width: 1080, height: 1920 };
}

export async function listCachedSourceAssets(config: Config): Promise<Array<{
  id: string;
  url: string;
  platform: string;
  title: string;
  durationSec: number;
  width: number;
  height: number;
  lastUsedAt: string;
}>> {
  const cacheDir = resolve(config.paths.data, "reels", "source-cache");
  if (!existsSync(cacheDir)) {return [];}
  const files = await readdir(cacheDir);
  const mp4Files = files.filter(f => f.endsWith(".mp4"));
  const results = await Promise.all(
    mp4Files.map(async (f) => {
      const fullPath = resolve(cacheDir, f);
      const probe = spawnSync(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fullPath],
        { encoding: "utf-8" },
      );
      const duration = probe.status === 0 ? parseFloat(probe.stdout.trim()) : 0;
      return {
        id: f.replace(".mp4", ""),
        url: fullPath,
        platform: "cached",
        title: f,
        durationSec: duration,
        width: 1080,
        height: 1920,
        lastUsedAt: new Date().toISOString(),
      };
    }),
  );
  return results;
}
