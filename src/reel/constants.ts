/** Default Kokoro-82M ONNX model identifier on the Hugging Face Hub. */
export const KOKORO_DEFAULT_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

/** Default Kokoro voice used when none is specified. */
export const KOKORO_DEFAULT_VOICE = "af_heart";

/**
 * Curated Kokoro-82M voices exposed in the UI, grouped by accent/gender.
 * Voice ids follow Kokoro's `<accent><gender>_<name>` convention
 * (a = American, b = British; f = female, m = male).
 */
export const KOKORO_TTS_VOICES: Array<{ value: string; label: string }> = [
  { value: "af_heart", label: "Heart (US Female · warm)" },
  { value: "af_bella", label: "Bella (US Female · expressive)" },
  { value: "af_nicole", label: "Nicole (US Female · soft)" },
  { value: "af_sky", label: "Sky (US Female · bright)" },
  { value: "am_michael", label: "Michael (US Male · steady)" },
  { value: "am_onyx", label: "Onyx (US Male · deep)" },
  { value: "am_adam", label: "Adam (US Male · bold)" },
  { value: "bf_emma", label: "Emma (UK Female · calm)" },
  { value: "bf_isabella", label: "Isabella (UK Female · refined)" },
  { value: "bm_george", label: "George (UK Male · narrator)" },
  { value: "bm_lewis", label: "Lewis (UK Male · gravelly)" },
];

/** Fast lookup set of valid Kokoro voice ids for validation. */
export const KOKORO_VOICE_IDS = new Set(KOKORO_TTS_VOICES.map((v) => v.value));

/** Ordered steps in the reel pipeline. */
export const REEL_PIPELINE_STEPS = [
  "Select Asset",
  "Text-to-Speech",
  "Generate Subtitles",
  "Render Video",
] as const;

/** API constraints for script input validation. */
export const REEL_API = {
  MAX_SCRIPT_LENGTH: 5000,
  MAX_SCRIPT_WORDS: 1000,
  MIN_SCRIPT_WORDS: 5,
} as const;

/** Default video output dimensions and settings. */
export const REEL_VIDEO_DEFAULTS = {
  width: 1080,
  height: 1920,
  fps: 30,
  subtitleFontSize: 48,
} as const;
