import type { StoryCardTimeline } from "../../reel/story-card/types";

export interface RemotionStoryCardOverlayProps {
  timeline: StoryCardTimeline;
  width: number;
  height: number;
  fps: number;
  backgroundVideoUrl?: string | null;
  [key: string]: unknown;
}

export interface RemotionStoryCardProps {
  text: string;
  title?: string;
  subreddit?: string;
  username?: string;
  themeId: string;
  showHeader: boolean;
  showMetadata: boolean;
  showUpvotes: boolean;
  showComments: boolean;
  fakeUpvotes: string;
  fakeComments: string;
  cardWidthRatio: number;
  maxLinesPerCard: number;
  fontSize: number;
  titleFontSize: number;
  metadataFontSize: number;
  width: number;
  height: number;
  isTitleCard: boolean;
}
