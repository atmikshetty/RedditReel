import { unlinkSync, existsSync, rmSync } from "fs";
import { join } from "path";

/**
 * Removes all temporary reel files from the data directory.
 * Silently continues if the directory does not exist.
 */
export function cleanupReelTempFiles(dataDir: string): void {
  if (!dataDir) {
    return;
  }
  const tempDir = join(dataDir, "reels", "temp");
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Removes the output video file for a specific job.
 * Silently continues if the file does not exist.
 */
export function cleanupReelOutputFiles(outputDir: string, jobId: string): void {
  if (!outputDir || !jobId) {
    return;
  }
  const filePath = join(outputDir, "reels", `${jobId}.mp4`);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}
