import { NextResponse } from "next/server";
import type { ReelJob } from "@/reel/types";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";
import { getReelService } from "@/server/reel-service";
import { createSnapshotStream } from "@/server/snapshot-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}
  try {
    const { jobId } = await params;
    const job = getReelService().getJob(jobId);
    if (!job) {return NextResponse.json({ error: `Reel job not found: ${jobId}` }, { status: 404 });}
    return createSnapshotStream<{ job: ReelJob }>(request, {
      event: "reel-job",
      snapshot: () => {
        const currentJob = getReelService().getJob(jobId);
        if (!currentJob) {throw new Error(`Reel job not found: ${jobId}`);}
        return { job: currentJob };
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: err instanceof Error && err.message.includes("not found") ? 404 : 500 });
  }
}
