import { spawn } from "child_process";
import { existsSync } from "fs";
import { createLogger } from "./logger";

const log = createLogger("ffmpeg");

/** Metadata result from ffprobe for a video file. */
export interface FfprobeResult {
  duration: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
  fps: number;
}

/** A detected silence range in an audio file. */
export interface SilenceRange {
  start: number;
  end: number;
}

/** Resolves the ffmpeg binary path, preferring a full local install. */
export function getFfmpegBin(): string {
  const macosPath = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg";
  if (existsSync(macosPath)) {return macosPath;}
  return "ffmpeg";
}

function getFfprobeBin(): string {
  const macosPath = "/opt/homebrew/opt/ffmpeg-full/bin/ffprobe";
  if (existsSync(macosPath)) {return macosPath;}
  return "ffprobe";
}

type ProcessResult = { stdout: string; stderr: string; exitCode: number };

function runProcess(command: string, args: string[]): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: code ?? 1,
      });
    });
  });
}

/** Runs ffmpeg with the given arguments and returns the result. */
export async function runFfmpeg(args: string[]): Promise<ProcessResult> {
  const bin = getFfmpegBin();
  log.debug(`${bin} ${args.join(" ")}`);
  const result = await runProcess(bin, args);
  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${result.exitCode}: ${result.stderr.slice(-500)}`);
  }
  return result;
}

/** Probes a video file and returns its metadata. */
export async function runFfprobe(filePath: string): Promise<FfprobeResult> {
  const { stdout } = await runProcess(getFfprobeBin(), [
    "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath,
  ]);
  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find((s: Record<string, unknown>) => s.codec_type === "video");
  const audioStream = data.streams?.find((s: Record<string, unknown>) => s.codec_type === "audio");
  const fpsStr: string = videoStream?.r_frame_rate || "30/1";
  const [num, den] = fpsStr.split("/").map(Number);
  return {
    duration: parseFloat(data.format?.duration || "0"),
    width: videoStream?.width || 0,
    height: videoStream?.height || 0,
    videoCodec: videoStream?.codec_name || "",
    audioCodec: audioStream?.codec_name || "",
    fps: den ? num / den : 30,
  };
}

/** Gets the duration of a video file in seconds. */
export async function getVideoDuration(filePath: string): Promise<number> {
  const info = await runFfprobe(filePath);
  return info.duration;
}

/** Converts seconds to SRT timestamp format (HH:MM:SS,mmm). */
export function secondsToSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
