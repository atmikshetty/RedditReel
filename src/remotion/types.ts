export interface CaptionWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface CaptionGroup {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
}

export interface CaptionOverlayProps {
  groups: CaptionGroup[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  animate: boolean;
  fontFamily?: string;
  fontSize?: number;
  primaryColor?: string;
  highlightColor?: string;
  textPosition?: "bottom" | "top" | "middle";
  backgroundOpacity?: number;
  upperCase?: boolean;
  showBackground?: boolean;
  [key: string]: unknown;
}
