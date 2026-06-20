import React, { type CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import type { CaptionGroup, CaptionOverlayProps } from "./types";

const FONT_SIZE = 52;
const TEXT_STROKE = "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 -3px 0 #000, 0 3px 0 #000, -3px 0 0 #000, 3px 0 0 #000";

const CaptionBox: React.FC<{
  group: CaptionGroup; frame: number; animate: boolean; fontSize: number;
  primaryColor: string; highlightColor: string; backgroundOpacity: number; upperCase: boolean; showBackground: boolean;
}> = ({ group, frame, animate, fontSize, primaryColor, highlightColor, backgroundOpacity, upperCase, showBackground }) => {
  const words = group.words;
  const midpoint = Math.ceil(words.length / 2);
  const line1 = words.slice(0, midpoint);
  const line2 = words.slice(midpoint);

  const renderWord = (word: (typeof words)[0], idx: number) => {
    const isActive = frame >= word.startFrame && frame < word.endFrame;
    const elapsed = frame - word.startFrame;
    const fadeInFrames = 3;
    const activeOpacity = !animate ? 1 : isActive ? 0.3 + (Math.min(elapsed, fadeInFrames) / fadeInFrames) * 0.7 : frame - word.endFrame >= 0 && frame - word.endFrame < fadeInFrames ? 1 - (frame - word.endFrame) / fadeInFrames * 0.4 : isActive ? 1 : 0.6;
    const activeScale = animate && isActive ? 1.08 : 1;
    return (
      <span key={idx} style={{ color: isActive ? highlightColor : primaryColor, marginRight: 12, textShadow: TEXT_STROKE, opacity: activeOpacity, transform: `scale(${activeScale})`, display: "inline-block", transition: "opacity 0.05s, transform 0.05s" }}>
        {upperCase ? word.text.toUpperCase() : word.text}
      </span>
    );
  };

  return (
    <div style={{ background: showBackground ? `rgba(0, 0, 0, ${backgroundOpacity})` : "transparent", padding: showBackground ? "12px 20px" : "0", borderRadius: showBackground ? 8 : 0, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize }}>
      <div style={{ display: "flex", justifyContent: "center" }}>{line1.map(renderWord)}</div>
      {line2.length > 0 && <div style={{ display: "flex", justifyContent: "center" }}>{line2.map(renderWord)}</div>}
    </div>
  );
};

export function resolveCaptionPositionStyle(position: string | undefined): CSSProperties {
  switch (position) {
    case "top": return { alignItems: "flex-start", justifyContent: "center", paddingTop: 80 };
    case "middle": return { alignItems: "center", justifyContent: "center" };
    default: return { alignItems: "flex-end", justifyContent: "center", paddingBottom: 80 };
  }
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({ groups, width, height, animate, fontSize, primaryColor, highlightColor, textPosition, backgroundOpacity, upperCase, fontFamily, showBackground }) => {
  const frame = useCurrentFrame();
  const activeGroup = groups.find((g) => frame >= g.startFrame && frame < g.endFrame);
  return (
    <div style={{ width, height, display: "flex", ...resolveCaptionPositionStyle(textPosition), fontFamily: fontFamily ?? "Arial, Helvetica, sans-serif", fontWeight: 800, fontSize: fontSize ?? FONT_SIZE, position: "absolute", top: 0, left: 0, backgroundColor: "#00FF00" }}>
      {activeGroup && <CaptionBox group={activeGroup} frame={frame} animate={animate} fontSize={fontSize ?? FONT_SIZE} primaryColor={primaryColor ?? "#FFFFFF"} highlightColor={highlightColor ?? "#FFD700"} backgroundOpacity={backgroundOpacity ?? 0.8} upperCase={upperCase ?? true} showBackground={showBackground ?? true} />}
    </div>
  );
};
