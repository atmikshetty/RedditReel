import { createLogger } from "../../utils/logger";
import type { StoryCardOptions, StoryCardThemeId, StoryCardLayoutMode } from "./types";
import { STORY_CARD_THEME_IDS, STORY_CARD_LAYOUT_MODES, MIN_WORDS_PER_CARD, MAX_WORDS_PER_CARD, MIN_LINES_PER_CARD, MAX_LINES_PER_CARD, MIN_CARD_WIDTH_RATIO, MAX_CARD_WIDTH_RATIO, MIN_BACKGROUND_DIM, MAX_BACKGROUND_DIM, MIN_BACKGROUND_BLUR, MAX_BACKGROUND_BLUR, MIN_TRANSITION_DURATION_MS, MAX_TRANSITION_DURATION_MS, MIN_SCRIPT_WORDS, MAX_SCRIPT_WORDS, MAX_SCRIPT_CHARS } from "./constants";

const log = createLogger("story-card:validation");

/** Result of story card option validation. */
export interface StoryCardValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a script and story card options, returning errors and warnings.
 */
export function validateStoryCardOptions(text: string, options: StoryCardOptions): StoryCardValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text || text.trim().length === 0) {
    errors.push("Script text is required");
    return { valid: false, errors, warnings };
  }

  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount < MIN_SCRIPT_WORDS) {errors.push(`Script must be at least ${MIN_SCRIPT_WORDS} words. Current: ${wordCount} words.`);}
  if (wordCount > MAX_SCRIPT_WORDS) {errors.push(`Script must be at most ${MAX_SCRIPT_WORDS} words. Current: ${wordCount} words.`);}
  if (trimmed.length > MAX_SCRIPT_CHARS) {errors.push(`Script must be at most ${MAX_SCRIPT_CHARS} characters. Current: ${trimmed.length} chars.`);}

  if (options.themeId && !STORY_CARD_THEME_IDS.includes(options.themeId)) {errors.push(`Invalid theme: ${options.themeId}`);}
  if (options.layoutMode && !STORY_CARD_LAYOUT_MODES.includes(options.layoutMode)) {errors.push(`Invalid layout mode: ${options.layoutMode}`);}

  if (options.wordsPerCard !== undefined && (options.wordsPerCard < MIN_WORDS_PER_CARD || options.wordsPerCard > MAX_WORDS_PER_CARD)) {errors.push(`wordsPerCard must be between ${MIN_WORDS_PER_CARD} and ${MAX_WORDS_PER_CARD}`);}
  if (options.maxLinesPerCard !== undefined && (options.maxLinesPerCard < MIN_LINES_PER_CARD || options.maxLinesPerCard > MAX_LINES_PER_CARD)) {errors.push(`maxLinesPerCard must be between ${MIN_LINES_PER_CARD} and ${MAX_LINES_PER_CARD}`);}
  if (options.cardWidthRatio !== undefined && (options.cardWidthRatio < MIN_CARD_WIDTH_RATIO || options.cardWidthRatio > MAX_CARD_WIDTH_RATIO)) {errors.push(`cardWidthRatio must be between ${MIN_CARD_WIDTH_RATIO} and ${MAX_CARD_WIDTH_RATIO}`);}
  if (options.backgroundDim !== undefined && (options.backgroundDim < MIN_BACKGROUND_DIM || options.backgroundDim > MAX_BACKGROUND_DIM)) {errors.push(`backgroundDim must be between ${MIN_BACKGROUND_DIM} and ${MAX_BACKGROUND_DIM}`);}
  if (options.backgroundBlur !== undefined && (options.backgroundBlur < MIN_BACKGROUND_BLUR || options.backgroundBlur > MAX_BACKGROUND_BLUR)) {errors.push(`backgroundBlur must be between ${MIN_BACKGROUND_BLUR} and ${MAX_BACKGROUND_BLUR}`);}
  if (options.transitionDurationMs !== undefined && (options.transitionDurationMs < MIN_TRANSITION_DURATION_MS || options.transitionDurationMs > MAX_TRANSITION_DURATION_MS)) {errors.push(`transitionDurationMs must be between ${MIN_TRANSITION_DURATION_MS} and ${MAX_TRANSITION_DURATION_MS}`);}

  if (options.customCardAssetPath) {
    if (options.customCardAssetPath.startsWith("/") || options.customCardAssetPath.startsWith("\\\\") || /^[A-Za-z]:/.test(options.customCardAssetPath)) {errors.push("Custom asset path must be a relative path");}
    if (options.customCardAssetPath.includes("..")) {errors.push("Custom asset path cannot contain parent directory references (..)");}
    if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(options.customCardAssetPath)) {errors.push("Custom asset must be an image file (png, jpg, jpeg, webp, gif)");}
  }

  if (wordCount > 500) {warnings.push("Long scripts may result in higher API costs and longer render times");}

  return { valid: errors.length === 0, errors, warnings };
}

/** Checks whether a string is a valid story card theme ID. */
export function isValidStoryCardThemeId(themeId: string): themeId is StoryCardThemeId {
  return STORY_CARD_THEME_IDS.includes(themeId as StoryCardThemeId);
}

/** Checks whether a string is a valid story card layout mode. */
export function isValidStoryCardLayoutMode(layoutMode: string): layoutMode is StoryCardLayoutMode {
  return STORY_CARD_LAYOUT_MODES.includes(layoutMode as StoryCardLayoutMode);
}
