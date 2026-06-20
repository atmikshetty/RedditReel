import React from "react";
import { useCurrentFrame, interpolate, Easing, OffthreadVideo } from "remotion";
import type { StoryCardTimelineItem } from "../../reel/story-card/types";
import { RedditStoryCard } from "./RedditStoryCard";
import type { RemotionStoryCardOverlayProps } from "./types";

const DEFAULT_TRANSITION_MS = 220;
const FADE_IN_MS = 180;
const FADE_OUT_MS = 150;

function getActiveItem(items: StoryCardTimelineItem[], currentMs: number): StoryCardTimelineItem | undefined {
  return items.find((item) => item.startMs <= currentMs && currentMs < item.endMs);
}

function getTransitionState(item: StoryCardTimelineItem, currentMs: number, transitionDurationMs: number): { opacity: number; scale: number; translateY: number } {
  const startMs = item.startMs;
  const endMs = item.endMs;
  const fadeInEnd = startMs + Math.min(transitionDurationMs, FADE_IN_MS);
  const fadeOutStart = endMs - Math.min(transitionDurationMs, FADE_OUT_MS);
  let opacity = 1, scale = 1, translateY = 0;

  if (currentMs < startMs) { opacity = 0; scale = 0.96; translateY = 12; }
  else if (currentMs < fadeInEnd) {
    const progress = (currentMs - startMs) / (fadeInEnd - startMs);
    opacity = interpolate(progress, [0, 1], [0, 1], { easing: Easing.out(Easing.ease) });
    scale = interpolate(progress, [0, 1], [0.96, 1], { easing: Easing.out(Easing.ease) });
    translateY = interpolate(progress, [0, 1], [12, 0], { easing: Easing.out(Easing.ease) });
  } else if (currentMs >= fadeOutStart) {
    const progress = (currentMs - fadeOutStart) / (endMs - fadeOutStart);
    opacity = interpolate(progress, [0, 1], [1, 0], { easing: Easing.in(Easing.ease) });
    scale = interpolate(progress, [0, 1], [1, 0.985], { easing: Easing.in(Easing.ease) });
    translateY = interpolate(progress, [0, 1], [0, -6], { easing: Easing.in(Easing.ease) });
  }
  return { opacity, scale, translateY };
}

export const StoryCardOverlay: React.FC<RemotionStoryCardOverlayProps> = ({ timeline, width, height, fps, backgroundVideoUrl }) => {
  const frame = useCurrentFrame();
  const currentMs = (frame / fps) * 1000;
  const activeItem = getActiveItem(timeline.items, currentMs);
  const transitionState = activeItem ? getTransitionState(activeItem, currentMs, DEFAULT_TRANSITION_MS) : { opacity: 0, scale: 0.96, translateY: 12 };

  return (
    <div style={{ width, height, position: "absolute", top: 0, left: 0, backgroundColor: "transparent" }}>
      {backgroundVideoUrl && (
        <div style={{ position: "absolute", top: 0, left: 0, width, height, zIndex: 0 }}>
          <OffthreadVideo src={backgroundVideoUrl} style={{ width, height }} muted volume={0} />
        </div>
      )}
      {activeItem && (
        <div style={{ width, height, position: "absolute", top: 0, left: 0, zIndex: 1, opacity: transitionState.opacity, transform: `scale(${transitionState.scale}) translateY(${transitionState.translateY}px)`, willChange: "transform, opacity" }}>
          <RedditStoryCard
            text={activeItem.text} title={activeItem.title} subreddit={activeItem.subreddit} username={activeItem.username}
            themeId={activeItem.visual.themeId} showHeader={true} showMetadata={true} showUpvotes={true} showComments={true}
            fakeUpvotes={timeline.metadata.title ? "12.8k" : "99+"} fakeComments={timeline.metadata.title ? "1.1k" : "99+"}
            cardWidthRatio={0.9} maxLinesPerCard={5} fontSize={activeItem.isTitleCard ? 40 : 32}
            titleFontSize={40} metadataFontSize={22} width={width} height={height} isTitleCard={activeItem.isTitleCard ?? false}
          />
        </div>
      )}
    </div>
  );
};
