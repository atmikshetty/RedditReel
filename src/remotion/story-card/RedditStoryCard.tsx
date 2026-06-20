import React from "react";
import type { RemotionStoryCardProps } from "./types";

const CARD_BORDER_RADIUS = 22;
const CARD_PADDING = 28;
const HEADER_AVATAR_SIZE = 44;
const HEADER_GAP = 12;

const THEME_MAP: Record<string, Record<string, string>> = {
  "reddit-light": { cardBg: "#FFFFFF", cardText: "#1C1C1C", mutedText: "#787C7E", accent: "#FF4500", border: "rgba(0,0,0,0.08)", shadow: "rgba(0,0,0,0.26)" },
  "reddit-dark": { cardBg: "#1A1A1B", cardText: "#F2F2F2", mutedText: "#A8A8A8", accent: "#FF4500", border: "rgba(255,255,255,0.08)", shadow: "rgba(0,0,0,0.35)" },
  "reddit-orange": { cardBg: "#FF4500", cardText: "#FFFFFF", mutedText: "#FFD8CC", accent: "#FFFFFF", border: "rgba(255,255,255,0.20)", shadow: "rgba(0,0,0,0.30)" },
  "minimal-white": { cardBg: "#FFFFFF", cardText: "#111111", mutedText: "#888888", accent: "#111111", border: "rgba(0,0,0,0.06)", shadow: "rgba(0,0,0,0.15)" },
  "glass-dark": { cardBg: "rgba(18,18,18,0.72)", cardText: "#FFFFFF", mutedText: "#BDBDBD", accent: "#FF4500", border: "rgba(255,255,255,0.16)", shadow: "rgba(0,0,0,0.40)" },
};

function getThemeColors(themeId: string): Record<string, string> {
  return THEME_MAP[themeId] ?? THEME_MAP["reddit-light"];
}

const VerifiedBadge: React.FC<{ color: string }> = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: 6, flexShrink: 0 }}>
    <circle cx="9" cy="9" r="9" fill="#0079D3" />
    <path d="M5 9L7.5 11.5L13 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UpvoteIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6, flexShrink: 0 }}>
    <path d="M12 4L4 14H20L12 4Z" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const CommentIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6, flexShrink: 0 }}>
    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AwardIcons: React.FC = () => {
  const awards = ["🥇", "🥈", "🥉", "💎", "🔥", "👍", "🎉", "❤️"];
  return <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>{awards.slice(0, 6).map((award, i) => <span key={i} style={{ fontSize: 16, lineHeight: 1 }}>{award}</span>)}</div>;
};

const AvatarIcon: React.FC<{ color: string; subreddit: string }> = ({ color, subreddit }) => {
  return (
    <div style={{ width: HEADER_AVATAR_SIZE, height: HEADER_AVATAR_SIZE, borderRadius: HEADER_AVATAR_SIZE / 2, backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white", fontSize: 24, fontWeight: 700, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" fill="white" />
        <circle cx="11" cy="13" r="2" fill={color} />
        <circle cx="21" cy="13" r="2" fill={color} />
        <path d="M10 20C10 20 13 23 16 23C19 23 22 20 22 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="16" r="14" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="16" cy="6" r="3" fill={color} />
        <line x1="16" y1="9" x2="16" y2="16" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
};

export const RedditStoryCard: React.FC<RemotionStoryCardProps> = ({ text, title, subreddit, username, themeId, showHeader, showMetadata, showUpvotes, showComments, fakeUpvotes, fakeComments, cardWidthRatio, maxLinesPerCard, fontSize, titleFontSize, metadataFontSize, width, height, isTitleCard }) => {
  const colors = getThemeColors(themeId);
  const cardWidth = Math.round(width * cardWidthRatio);
  const maxCardWidth = Math.min(cardWidth, 960);
  const displayText = isTitleCard && title ? title : text;
  const displayFontSize = isTitleCard ? titleFontSize : fontSize;

  return (
    <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", top: 0, left: 0 }}>
      <div style={{ width: maxCardWidth, maxWidth: maxCardWidth, backgroundColor: colors.cardBg, borderRadius: CARD_BORDER_RADIUS, padding: CARD_PADDING, border: `1px solid ${colors.border}`, boxShadow: `0 8px 32px ${colors.shadow}`, fontFamily: "Arial, Helvetica, sans-serif", color: colors.cardText }}>
        {showHeader && (
          <div style={{ display: "flex", alignItems: "center", gap: HEADER_GAP, marginBottom: 16 }}>
            <AvatarIcon color={colors.accent} subreddit={subreddit ?? "AskReddit"} />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: colors.cardText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subreddit?.replace(/^r\//, "") ?? "AskReddit"}</span>
                <VerifiedBadge color={colors.accent} />
              </div>
              <span style={{ fontSize: 16, color: colors.mutedText, marginTop: 2 }}>{username ?? "u/storyteller"} · 2h ago</span>
            </div>
          </div>
        )}
        <AwardIcons />
        <div style={{ marginTop: 20, marginBottom: showMetadata ? 16 : 0, fontSize: displayFontSize, fontWeight: isTitleCard ? 800 : 700, lineHeight: 1.22, color: colors.cardText, wordWrap: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: maxLinesPerCard, WebkitBoxOrient: "vertical" }}>{displayText}</div>
        {showMetadata && (
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
            {showUpvotes && <div style={{ display: "flex", alignItems: "center" }}><UpvoteIcon color={colors.mutedText} /><span style={{ fontSize: metadataFontSize, color: colors.mutedText, fontWeight: 600 }}>{fakeUpvotes}</span></div>}
            {showComments && <div style={{ display: "flex", alignItems: "center" }}><CommentIcon color={colors.mutedText} /><span style={{ fontSize: metadataFontSize, color: colors.mutedText, fontWeight: 600 }}>{fakeComments}</span></div>}
          </div>
        )}
      </div>
    </div>
  );
};
