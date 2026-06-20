/** Error codes used throughout the reel pipeline. */
export const REEL_ERROR_CODES = {
  ASSET_NOT_FOUND: "ASSET_NOT_FOUND",
  URL_DOWNLOAD_FAILED: "URL_DOWNLOAD_FAILED",
  TTS_FAILED: "TTS_FAILED",
  SUBTITLE_FAILED: "SUBTITLE_FAILED",
  COMPOSITION_FAILED: "COMPOSITION_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;

/** Custom error for reel pipeline failures with structured metadata. */
export class ReelError extends Error {
  public code: string;
  public step?: string;
  public retryable: boolean;

  constructor(
    message: string,
    code: string,
    options?: { step?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = "ReelError";
    this.code = code;
    this.step = options?.step;
    this.retryable = options?.retryable ?? false;
  }
}
