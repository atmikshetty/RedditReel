/** Source type for a story card script. */
export type StoryCardSourceType = "manual" | "reddit-post" | "ai-generated";
/** Identifier for the visual theme of story cards. */
export type StoryCardThemeId = "reddit-light" | "reddit-dark" | "reddit-orange" | "minimal-white" | "glass-dark" | "custom";
/** Timing mode for card transitions. */
export type StoryCardTimingMode = "estimated" | "word-aligned" | "sentence-aligned";
/** Card layout modes for positioning story text. */
export type StoryCardLayoutMode = "center-card" | "top-card" | "comment-stack" | "post-and-comments";
/** Transition effect between story cards. */
export type StoryCardTransition = "none" | "fade" | "slide-up" | "scale-fade";
/** Vertical position of the story card on screen. */
export type StoryCardPosition = "top" | "center" | "lower";

/** Configuration options for story card reel generation. */
export interface StoryCardOptions {
  enabled?: boolean;
  sourceType?: StoryCardSourceType;
  title?: string;
  subreddit?: string;
  username?: string;
  themeId?: StoryCardThemeId;
  layoutMode?: StoryCardLayoutMode;
  timingMode?: StoryCardTimingMode;
  wordsPerCard?: number;
  maxLinesPerCard?: number;
  maxCharsPerLine?: number;
  cardPosition?: StoryCardPosition;
  cardWidthRatio?: number;
  showHeader?: boolean;
  showMetadata?: boolean;
  showProgress?: boolean;
  showUpvotes?: boolean;
  showComments?: boolean;
  fakeUpvotes?: string;
  fakeComments?: string;
  transition?: StoryCardTransition;
  transitionDurationMs?: number;
  introCardMs?: number;
  outroCardMs?: number;
  /**
   * How far ahead of its spoken word each card appears, in milliseconds. Caption
   * and karaoke systems show text slightly before the audio so it reads as synced
   * (text trailing the voice feels broken); this also absorbs forced-alignment
   * onset lag. Defaults to ~150ms.
   */
  syncLeadMs?: number;
  backgroundDim?: number;
  backgroundBlur?: number;
  useActualRedditAsset?: boolean;
  customCardAssetPath?: string;
}

/** Normalized story script with parsed metadata. */
export interface NormalizedStoryScript {
  title: string;
  body: string;
  subreddit?: string;
  username?: string;
  sourceUrl?: string;
  paragraphs: string[];
  wordCount: number;
  estimatedReadSeconds: number;
}

/** A single chunk of story text for display on one card. */
export interface StoryTextChunk {
  id: string;
  index: number;
  text: string;
  words: string[];
  wordStartIndex: number;
  wordEndIndex: number;
  charCount: number;
  lineEstimate: number;
  isTitleCard?: boolean;
  isOutroCard?: boolean;
}

/** A timed item in the story card timeline. */
export interface StoryCardTimelineItem {
  id: string;
  index: number;
  text: string;
  title?: string;
  subreddit?: string;
  username?: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  progress: number;
  isTitleCard?: boolean;
  isOutroCard?: boolean;
  visual: {
    themeId: StoryCardThemeId;
    layoutMode: StoryCardLayoutMode;
    transition: StoryCardTransition;
    position: StoryCardPosition;
  };
}

/** Complete timeline for a story card reel. */
export interface StoryCardTimeline {
  version: 1;
  audioDurationMs: number;
  videoDurationMs: number;
  width: number;
  height: number;
  fps: number;
  items: StoryCardTimelineItem[];
  metadata: {
    title: string;
    subreddit: string;
    username: string;
    totalWords: number;
    chunkCount: number;
    timingMode: StoryCardTimingMode;
  };
}

/** Visual theme definition for story cards. */
export interface StoryCardTheme {
  id: StoryCardThemeId;
  cardBg: string;
  cardText: string;
  mutedText: string;
  accent: string;
  border: string;
  shadow: string;
  backdropBlur?: number;
}

/** Props passed to the Remotion story card overlay component. */
export interface StoryCardOverlayProps {
  timeline: StoryCardTimeline;
  width: number;
  height: number;
  fps: number;
  backgroundVideoUrl?: string;
}

/** Input for rendering the story card overlay video. */
export interface RenderStoryCardOverlayInput {
  jobId: string;
  timeline: StoryCardTimeline;
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  quality: "draft" | "standard" | "high";
  backgroundVideoPath?: string;
  /** Number of parallel Remotion render workers. Defaults to a cores-based value. */
  concurrency?: number;
}

/** Output from rendering the story card overlay. */
export interface RenderStoryCardOverlayOutput {
  overlayPath: string;
  durationMs: number;
  frameCount: number;
}

/** Input for composing the final story card reel video. */
export interface ComposeStoryCardReelInput {
  backgroundVideoPath: string;
  ttsAudioPath: string;
  overlayVideoPath: string;
  outputPath: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  quality: "draft" | "standard" | "high";
  backgroundDim?: number;
  backgroundBlur?: number;
}
