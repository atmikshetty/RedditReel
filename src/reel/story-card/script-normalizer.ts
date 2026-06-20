import { createLogger } from "../../utils/logger";
import type { NormalizedStoryScript } from "./types";

const log = createLogger("story-card:normalizer");

const SMART_QUOTE_MAP: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',
  "\u2032": "'", "\u2033": '"', "\u2035": "'", "\u2036": '"',
  "\u2013": "-", "\u2014": "-", "\u2026": "...",
};

function normalizeSmartQuotes(text: string): string {
  return text.replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2032\u2033\u2035\u2036\u2013\u2014\u2026]/g, (char) => SMART_QUOTE_MAP[char] ?? char);
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function removeMarkdownHeading(text: string): string {
  return text.replace(/^#{1,6}\s+/gm, "");
}

function detectTitle(text: string): { title: string; remaining: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {return { title: "", remaining: text };}
  const firstLine = lines[0];
  if (/^Title:/i.test(firstLine)) {
    const title = firstLine.replace(/^Title:\s*/i, "").trim();
    return { title, remaining: lines.slice(1).join("\n") };
  }
  if (/^#{1,6}\s+/.test(firstLine)) {
    const title = firstLine.replace(/^#{1,6}\s+/, "").trim();
    return { title, remaining: lines.slice(1).join("\n") };
  }
  return { title: "", remaining: text };
}

function detectSubreddit(text: string): { subreddit: string | undefined; remaining: string } {
  const match = text.match(/^\s*(r\/\w+)\s*\n?/i);
  if (match) {return { subreddit: match[1], remaining: text.replace(match[0], "").trim() };}
  return { subreddit: undefined, remaining: text };
}

function detectUsername(text: string): { username: string | undefined; remaining: string } {
  const match = text.match(/^\s*(u\/\w+)\s*\n?/i);
  if (match) {return { username: match[1], remaining: text.replace(match[0], "").trim() };}
  return { username: undefined, remaining: text };
}

function removeNumberedPrefix(text: string): string {
  let result = text.replace(/^\d+\.\s+/gm, "");
  result = result.replace(/(?<=[.!?])\s+\d+\.\s+/g, " ");
  return result;
}

function removeDuplicateTitleFromBody(title: string, body: string): string {
  if (!title) {return body;}
  const normalizedTitle = title.toLowerCase().replace(/[^\w]/g, "");
  const lines = body.split("\n");
  const firstLine = lines[0]?.trim().toLowerCase().replace(/[^\w]/g, "");
  if (firstLine && firstLine === normalizedTitle) {return lines.slice(1).join("\n").trim();}
  return body;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateReadSeconds(wordCount: number): number {
  return Math.ceil((wordCount / 150) * 60);
}

/** Options for script normalization behavior. */
export interface NormalizeOptions {
  allowShortScript?: boolean;
  minWords?: number;
  maxChars?: number;
}

/**
 * Normalizes raw script text into a structured story script with parsed metadata.
 * Handles title detection, subreddit/username extraction, and text cleanup.
 */
export function normalizeStoryScript(rawText: string, options: NormalizeOptions = {}): NormalizedStoryScript {
  const minWords = options.minWords ?? 20;
  const maxChars = options.maxChars ?? 5000;
  let text = rawText.trim();
  if (!text) {throw new Error("Script text is empty");}

  const { subreddit: detectedSubreddit, remaining: afterSubreddit } = detectSubreddit(text);
  const { username: detectedUsername, remaining: afterUsername } = detectUsername(afterSubreddit);
  text = afterUsername;

  const { title, remaining } = detectTitle(text);
  text = remaining;

  text = removeMarkdownHeading(text);
  text = normalizeSmartQuotes(text);
  text = collapseBlankLines(text);
  text = removeNumberedPrefix(text);
  text = removeDuplicateTitleFromBody(title, text);

  const paragraphs = text.split("\n").map((p) => p.trim()).filter((p) => p.length > 0);
  const body = paragraphs.join("\n\n");
  if (!body) {throw new Error("Script body is empty after normalization");}

  const wordCount = countWords(body);
  if (wordCount < minWords && !options.allowShortScript) {throw new Error(`Script body is too short (${wordCount} words). Minimum is ${minWords} words.`);}
  if (body.length > maxChars) {throw new Error(`Script body is too long (${body.length} chars). Maximum is ${maxChars} chars.`);}

  log.info(`Normalized script: ${wordCount} words, ${paragraphs.length} paragraphs, title: ${title || "none"}`);
  return { title: title || "", body, subreddit: detectedSubreddit, username: detectedUsername, paragraphs, wordCount, estimatedReadSeconds: estimateReadSeconds(wordCount) };
}
