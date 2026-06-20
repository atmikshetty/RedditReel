/** Video information extracted from a Reddit post. */
export interface RedditVideoInfo {
  title: string;
  subreddit: string;
  author: string;
  videoUrl: string;
  audioUrl: string | null;
  hasAudio: boolean;
  duration: number;
  width: number;
  height: number;
  thumbnail: string;
  permalink: string;
  externalUrl: string | null;
  isExternal: boolean;
}

async function resolveRedditUrl(url: string): Promise<string> {
  if (url.match(/^https?:\/\/(v\.)?redd\.it\//i) || url.includes("/s/")) {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": "RedditVideoDownloader/1.0" } });
    return response.url;
  }
  return url;
}

async function sanitizeRedditUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim();
  const resolved = await resolveRedditUrl(trimmed);
  const redditRegex = /^https?:\/\/(www\.|old\.|new\.|m\.)?reddit\.com\/r\/\w+\/comments\/\w+/i;
  if (!redditRegex.test(resolved)) {throw new Error("Invalid Reddit URL. Please provide a valid Reddit post URL.");}
  const parsed = new URL(resolved);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

/**
 * Fetches and extracts video information from a Reddit post URL.
 */
export async function getRedditVideoInfo(rawUrl: string, signal?: AbortSignal): Promise<RedditVideoInfo> {
  const url = await sanitizeRedditUrl(rawUrl);
  const jsonUrl = url.endsWith("/") ? `${url}.json` : `${url}/.json`;
  const response = await fetch(jsonUrl, { signal, headers: { "User-Agent": "RedditVideoDownloader/1.0" } });
  if (!response.ok) {throw new Error(`Failed to fetch Reddit post: ${response.statusText}`);}
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {throw new Error("Unexpected Reddit API response format");}
  const post = data[0]?.data?.children?.[0]?.data;
  if (!post) {throw new Error("Could not find post data in Reddit response");}

  const media = post.media?.reddit_video || post.secure_media?.reddit_video;
  if (!media) {
    const crosspostMedia = post.crosspost_parent_list?.[0]?.media?.reddit_video || post.crosspost_parent_list?.[0]?.secure_media?.reddit_video;
    if (crosspostMedia) {return extractVideoInfo(post, crosspostMedia);}
    const externalUrl = post.url_overridden_by_dest as string;
    const domain = post.domain as string;
    const postHint = post.post_hint as string;
    if (externalUrl && (postHint === "rich:video" || postHint === "link" || domain === "redgifs.com" || domain === "gfycat.com")) {
      return { title: (post.title as string) || "Reddit Video", subreddit: (post.subreddit as string) || "unknown", author: (post.author as string) || "unknown", videoUrl: "", audioUrl: null, hasAudio: true, duration: 0, width: (post.secure_media?.oembed?.thumbnail_width as number) || 0, height: (post.secure_media?.oembed?.thumbnail_height as number) || 0, thumbnail: (post.thumbnail as string) || "", permalink: `https://reddit.com${post.permalink as string}`, externalUrl, isExternal: true };
    }
    throw new Error("This post does not contain a downloadable video.");
  }
  return extractVideoInfo(post, media);
}

function extractVideoInfo(post: Record<string, unknown>, media: Record<string, unknown>): RedditVideoInfo {
  const fallbackUrl = media.fallback_url as string;
  if (!fallbackUrl) {throw new Error("Could not extract video URL from Reddit post");}
  const videoUrl = fallbackUrl.split("?")[0];
  const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf("/"));
  const audioUrl = videoUrl.includes("/CMAF_") ? null : `${baseUrl}/DASH_AUDIO_128.mp4`;
  return { title: (post.title as string) || "Reddit Video", subreddit: (post.subreddit as string) || "unknown", author: (post.author as string) || "unknown", videoUrl, audioUrl, hasAudio: !(media.is_gif as boolean), duration: (media.duration as number) || 0, width: (media.width as number) || 0, height: (media.height as number) || 0, thumbnail: (post.thumbnail as string) || "", permalink: `https://reddit.com${post.permalink as string}`, externalUrl: null, isExternal: false };
}
