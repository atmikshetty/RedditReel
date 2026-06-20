import type { StoryCardOptions, StoryCardTheme, StoryCardThemeId, StoryCardLayoutMode, StoryCardTimingMode, StoryCardTransition, StoryCardPosition } from "./types";

/** Default options applied when no story card options are provided. */
export const DEFAULT_STORY_CARD_OPTIONS: Required<StoryCardOptions> = {
  enabled: false, sourceType: "manual", title: "", subreddit: "r/AskReddit", username: "u/storyteller",
  themeId: "reddit-light", layoutMode: "center-card", timingMode: "estimated",
  wordsPerCard: 20, maxLinesPerCard: 5, maxCharsPerLine: 40,
  cardPosition: "center", cardWidthRatio: 0.86,
  showHeader: true, showMetadata: true, showProgress: true, showUpvotes: true, showComments: true,
  fakeUpvotes: "12.8k", fakeComments: "1.1k",
  transition: "scale-fade", transitionDurationMs: 220,
  introCardMs: 600, outroCardMs: 500, syncLeadMs: 150,
  backgroundDim: 0.16, backgroundBlur: 0,
  useActualRedditAsset: false, customCardAssetPath: "",
};

/** Built-in visual themes for story cards. */
export const STORY_CARD_THEMES: Record<StoryCardThemeId, StoryCardTheme> = {
  "reddit-light": { id: "reddit-light", cardBg: "#FFFFFF", cardText: "#1C1C1C", mutedText: "#787C7E", accent: "#FF4500", border: "rgba(0,0,0,0.08)", shadow: "rgba(0,0,0,0.26)" },
  "reddit-dark": { id: "reddit-dark", cardBg: "#1A1A1B", cardText: "#F2F2F2", mutedText: "#A8A8A8", accent: "#FF4500", border: "rgba(255,255,255,0.08)", shadow: "rgba(0,0,0,0.35)" },
  "reddit-orange": { id: "reddit-orange", cardBg: "#FF4500", cardText: "#FFFFFF", mutedText: "#FFD8CC", accent: "#FFFFFF", border: "rgba(255,255,255,0.20)", shadow: "rgba(0,0,0,0.30)" },
  "minimal-white": { id: "minimal-white", cardBg: "#FFFFFF", cardText: "#111111", mutedText: "#888888", accent: "#111111", border: "rgba(0,0,0,0.06)", shadow: "rgba(0,0,0,0.15)" },
  "glass-dark": { id: "glass-dark", cardBg: "rgba(18,18,18,0.72)", cardText: "#FFFFFF", mutedText: "#BDBDBD", accent: "#FF4500", border: "rgba(255,255,255,0.16)", shadow: "rgba(0,0,0,0.40)", backdropBlur: 18 },
  custom: { id: "custom", cardBg: "#FFFFFF", cardText: "#1C1C1C", mutedText: "#787C7E", accent: "#FF4500", border: "rgba(0,0,0,0.08)", shadow: "rgba(0,0,0,0.26)" },
};

/** Quality presets for story card video encoding. */
export const STORY_CARD_QUALITY_PRESETS = {
  draft: { preset: "veryfast", crf: 24, audioBitrate: "160k" },
  standard: { preset: "medium", crf: 19, audioBitrate: "192k" },
  high: { preset: "slow", crf: 17, audioBitrate: "256k" },
} as const;

/** Minimum words allowed per story card. */
export const MIN_WORDS_PER_CARD = 8;
/** Maximum words allowed per story card. */
export const MAX_WORDS_PER_CARD = 50;
/** Minimum lines per card. */
export const MIN_LINES_PER_CARD = 1;
/** Maximum lines per card. */
export const MAX_LINES_PER_CARD = 6;
/** Minimum card width as a ratio of screen width. */
export const MIN_CARD_WIDTH_RATIO = 0.6;
/** Maximum card width as a ratio of screen width. */
export const MAX_CARD_WIDTH_RATIO = 0.96;
/** Minimum background dim value. */
export const MIN_BACKGROUND_DIM = 0;
/** Maximum background dim value. */
export const MAX_BACKGROUND_DIM = 0.6;
/** Minimum background blur value. */
export const MIN_BACKGROUND_BLUR = 0;
/** Maximum background blur value. */
export const MAX_BACKGROUND_BLUR = 30;
/** Minimum transition duration in milliseconds. */
export const MIN_TRANSITION_DURATION_MS = 0;
/** Maximum transition duration in milliseconds. */
export const MAX_TRANSITION_DURATION_MS = 1000;
/** Minimum card display duration in milliseconds. */
export const MIN_CARD_DURATION_MS = 1200;
/** Maximum card display duration in milliseconds. */
export const MAX_CARD_DURATION_MS = 5500;
/** Minimum words required in a script. */
export const MIN_SCRIPT_WORDS = 20;
/** Maximum words allowed in a script. */
export const MAX_SCRIPT_WORDS = 1000;
/** Maximum characters allowed in a script. */
export const MAX_SCRIPT_CHARS = 5000;

/** All available layout modes. */
export const STORY_CARD_LAYOUT_MODES: StoryCardLayoutMode[] = ["center-card", "top-card", "comment-stack", "post-and-comments"];
/** All available timing modes. */
export const STORY_CARD_TIMING_MODES: StoryCardTimingMode[] = ["estimated", "word-aligned", "sentence-aligned"];
/** All available transitions. */
export const STORY_CARD_TRANSITIONS: StoryCardTransition[] = ["none", "fade", "slide-up", "scale-fade"];
/** All available card positions. */
export const STORY_CARD_POSITIONS: StoryCardPosition[] = ["top", "center", "lower"];
/** All available theme IDs. */
export const STORY_CARD_THEME_IDS: StoryCardThemeId[] = ["reddit-light", "reddit-dark", "reddit-orange", "minimal-white", "glass-dark", "custom"];
