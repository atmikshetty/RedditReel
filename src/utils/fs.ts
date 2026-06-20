import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";

/** Ensures a directory exists, creating it recursively if needed. */
export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

/** Checks whether a file exists at the given path. */
export async function fileExists(filePath: string): Promise<boolean> {
  return existsSync(filePath);
}

/** Lists files in a directory, optionally filtered by extension. */
export function listFiles(dirPath: string, extension?: string): string[] {
  if (!existsSync(dirPath)) {return [];}
  const files = readdirSync(dirPath);
  if (extension) {return files.filter((f) => f.endsWith(extension)).map((f) => join(dirPath, f));}
  return files.map((f) => join(dirPath, f));
}
