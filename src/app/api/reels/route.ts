import type { ReelJob } from "@/reel/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { existsSync } from "node:fs";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";
import { getReelService } from "@/server/reel-service";
import { detectPlatformFromUrl } from "@/reel/source-url";
import { isValidVideoUrl } from "@/utils/url-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRIPT_MIN_WORDS = 5;
const SCRIPT_MAX_WORDS = 1000;

const storyCardSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().optional(),
  subreddit: z.string().optional(),
  username: z.string().optional(),
  themeId: z.enum(["reddit-light", "reddit-dark", "reddit-orange", "minimal-white", "glass-dark", "custom"]).optional(),
  layoutMode: z.enum(["center-card", "top-card", "comment-stack", "post-and-comments"]).optional(),
  timingMode: z.enum(["estimated", "word-aligned", "sentence-aligned"]).optional(),
  wordsPerCard: z.number().min(8).max(50).optional(),
  maxLinesPerCard: z.number().min(1).max(6).optional(),
  transition: z.enum(["none", "fade", "slide-up", "scale-fade"]).optional(),
  backgroundDim: z.number().min(0).max(0.6).optional(),
  backgroundBlur: z.number().min(0).max(30).optional(),
  showHeader: z.boolean().optional(),
  showMetadata: z.boolean().optional(),
  showUpvotes: z.boolean().optional(),
  showComments: z.boolean().optional(),
  fakeUpvotes: z.string().optional(),
  fakeComments: z.string().optional(),
  cardPosition: z.enum(["top", "center", "lower"]).optional(),
  cardWidthRatio: z.number().min(0.6).max(0.96).optional(),
  introCardMs: z.number().optional(),
  outroCardMs: z.number().optional(),
  syncLeadMs: z.number().min(0).max(1000).optional(),
  transitionDurationMs: z.number().optional(),
  useActualRedditAsset: z.boolean().optional(),
  customCardAssetPath: z.string().optional(),
}).optional();

const scriptSchema = z.string().trim().min(1, "Script text is required")
  .refine((val) => val.split(/\s+/).length >= SCRIPT_MIN_WORDS, `Script must be at least ${SCRIPT_MIN_WORDS} words`)
  .refine((val) => val.split(/\s+/).length <= SCRIPT_MAX_WORDS, `Script must be at most ${SCRIPT_MAX_WORDS} words`);

const reelCreateSchema = z.object({
  text: scriptSchema,
  voiceId: z.string().optional(),
  tone: z.enum(["dramatic", "neutral", "storytelling"]).optional(),
  quality: z.enum(["draft", "standard", "high"]).optional(),
  ttsProvider: z.literal("kokoro").optional(),
  ttsModel: z.string().optional(),
  storyCard: storyCardSchema,
  sourceUrl: z.string().min(1, "A video source URL is required"),
});

export async function GET(request: Request): Promise<Response> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}
  const jobs = getReelService().listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request): Promise<NextResponse<{ job: ReelJob } | { error: string }>> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}

  try {
    const body = await request.json();
    const payload = reelCreateSchema.parse(body);

    const sourceUrl = payload.sourceUrl;
    if (!isValidVideoUrl(sourceUrl) && !existsSync(sourceUrl)) {
      return NextResponse.json({ error: "Unsupported source URL." }, { status: 400 });
    }

    const source = { type: "url" as const, url: sourceUrl, platform: detectPlatformFromUrl(sourceUrl) };

    const service = getReelService();
    const job = service.createJob({
      text: payload.text,
      voiceId: payload.voiceId,
      tone: payload.tone,
      source,
      quality: payload.quality,
      ttsProvider: payload.ttsProvider,
      ttsModel: payload.ttsModel,
      storyCard: payload.storyCard,
    });

    const jobId = job.id;
    void service.runJob(jobId).catch((err) => { console.error(`Reel job ${jobId} error:`, err); });
    return NextResponse.json({ job }, { status: 202 });
  } catch (err) {
    if (err instanceof z.ZodError) {return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });}
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
