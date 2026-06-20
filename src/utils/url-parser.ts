/** Supported platforms for URL source detection. */
export type SourcePlatform = "youtube" | "generic";

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/i,
  /^https?:\/\/youtu\.be\/[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/i,
  /^https?:\/\/m\.youtube\.com\/watch\?v=[\w-]+/i,
  /^https?:\/\/(www\.)?youtube\.com\/live\/[\w-]+/i,
];

function matchAny(url: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(url));
}

/** Detects the platform from a URL string. Only YouTube is supported. */
export function detectPlatform(url: string): SourcePlatform {
  const trimmed = url.trim();
  if (matchAny(trimmed, YOUTUBE_PATTERNS)) {return "youtube";}
  return "generic";
}

/** Checks whether a URL points to a supported video platform (YouTube only). */
export function isValidVideoUrl(url: string): boolean {
  return detectPlatform(url.trim()) !== "generic";
}
