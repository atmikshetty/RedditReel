import type { ReelScriptInput } from "./types";

/** A named preset configuration for reel generation. */
export interface ReelPreset {
  id: string;
  label: string;
  description: string;
  settings: Partial<ReelScriptInput>;
}

/** Built-in reel presets for common content styles. */
export const REEL_PRESETS: ReelPreset[] = [
  { id: "story-short", label: "Short Story", description: "30-60 second storytelling reel", settings: {} },
  { id: "motivational", label: "Motivational", description: "Dramatic motivational speech", settings: {} },
  { id: "educational", label: "Educational", description: "Neutral educational content", settings: {} },
  { id: "action-packed", label: "Action Packed", description: "Fast-paced dramatic delivery at high quality", settings: { quality: "high" } },
  { id: "reddit-story-short", label: "Reddit Story Short", description: "Narrated story with Reddit-style text cards", settings: { storyCard: { enabled: true, themeId: "reddit-light", layoutMode: "center-card", timingMode: "estimated", wordsPerCard: 24, maxLinesPerCard: 3, transition: "scale-fade", backgroundDim: 0.16, showHeader: true, showMetadata: true, showUpvotes: true, showComments: true } } },
  { id: "reddit-story-dark", label: "Dark Story Cards", description: "Dark-themed Reddit story cards", settings: { storyCard: { enabled: true, themeId: "reddit-dark", layoutMode: "center-card", timingMode: "estimated", wordsPerCard: 22, transition: "scale-fade", backgroundDim: 0.2, showHeader: true, showMetadata: true, showUpvotes: true, showComments: true } } },
];

/**
 * Applies a named preset to a base script input, merging settings.
 * Returns the base input unchanged if the preset ID is not found.
 */
export function applyReelPreset(presetId: string, base: ReelScriptInput): ReelScriptInput {
  const preset = REEL_PRESETS.find((p) => p.id === presetId);
  if (!preset) {return base;}
  return { ...base, ...preset.settings };
}
