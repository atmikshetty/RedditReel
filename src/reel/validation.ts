import { REEL_API } from "./constants";

/**
 * Result of a reel script validation.
 */
export interface ReelValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a reel script against length and word-count constraints.
 */
export function validateReelScript(text: string): ReelValidationResult {
  const errors: string[] = [];

  if (!text || text.trim().length === 0) {
    errors.push("Script text is required");
    return { valid: false, errors };
  }

  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length < REEL_API.MIN_SCRIPT_WORDS) {
    errors.push(`Script must be at least ${REEL_API.MIN_SCRIPT_WORDS} words`);
  }

  if (words.length > REEL_API.MAX_SCRIPT_WORDS) {
    errors.push(`Script must be at most ${REEL_API.MAX_SCRIPT_WORDS} words`);
  }

  if (text.length > REEL_API.MAX_SCRIPT_LENGTH) {
    errors.push(`Script must be at most ${REEL_API.MAX_SCRIPT_LENGTH} characters`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Estimates reel duration in seconds based on word count (150 wpm).
 */
export function estimateReelDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil((words / 150) * 60);
}
