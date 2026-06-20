import { join, resolve } from "path";
import type { Config } from "../config";

const WHISPER_CLI = "whisper-cli";
const modelsDir = resolve(process.cwd(), "models");

/** Whisper CLI transcription output structure. */
export interface WhisperCliTranscript {
  result?: { language?: string };
  transcription: Array<{
    text: string;
    offsets: { from: number; to: number };
  }>;
}

/** Resolves the full path to a Whisper model file by model name. */
export function resolveWhisperModelPath(model: Config["whisperModel"]): string {
  return join(modelsDir, `ggml-${model}.bin`);
}

/** Builds the argument list for the whisper-cli invocation. */
export function buildWhisperCliArgs(
  modelPath: string,
  wavPath: string,
  jsonBase: string,
): string[] {
  const args = [WHISPER_CLI, "-m", modelPath];
  if (process.platform === "darwin") {
    args.push("-ng");
  } else if (process.platform === "win32") {
    args.push("-ng");
  }
  args.push("-f", wavPath, "-l", "en", "-oj", "--output-json-full", "-of", jsonBase, "-np");
  return args;
}
