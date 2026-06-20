import React from "react";
import { Composition } from "remotion";
import { CaptionOverlay } from "./CaptionOverlay";
import { StoryCardOverlay } from "./story-card/StoryCardOverlay";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CaptionOverlay"
        component={CaptionOverlay}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={1}
        defaultProps={{
          groups: [], width: 1080, height: 1920, fps: 30, durationInFrames: 1,
          animate: false, fontSize: 52, primaryColor: "#FFFFFF", highlightColor: "#FFD700",
          textPosition: "bottom", backgroundOpacity: 0.8, upperCase: true, showBackground: true,
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: (props as Record<string, unknown>).durationInFrames as number,
          fps: (props as Record<string, unknown>).fps as number,
          width: (props as Record<string, unknown>).width as number,
          height: (props as Record<string, unknown>).height as number,
        })}
      />
      <Composition
        id="StoryCardOverlay"
        component={StoryCardOverlay}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={1}
        defaultProps={{
          timeline: { version: 1, audioDurationMs: 0, videoDurationMs: 0, width: 1080, height: 1920, fps: 30, items: [], metadata: { title: "", subreddit: "", username: "", totalWords: 0, chunkCount: 0, timingMode: "estimated" } },
          width: 1080, height: 1920, fps: 30,
        }}
        calculateMetadata={async ({ props }) => {
          const p = props as Record<string, unknown>;
          const timeline = p.timeline as { videoDurationMs: number };
          return {
            durationInFrames: Math.ceil((timeline.videoDurationMs / 1000) * (p.fps as number)),
            fps: p.fps as number, width: p.width as number, height: p.height as number,
          };
        }}
      />
    </>
  );
};
