import { NextResponse } from "next/server";
import type { ReelJob } from "@/reel/types";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";
import { getReelService } from "@/server/reel-service";
import { getHistoryEntryById, historyEntryToJob } from "@/reel/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }): Promise<NextResponse<{ job: ReelJob } | { error: string }>> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}
  try {
    const { jobId } = await params;
    const job = getReelService().getJob(jobId);
    if (job) {return NextResponse.json({ job });}
    const historyEntry = await getHistoryEntryById(jobId);
    if (historyEntry) {return NextResponse.json({ job: historyEntryToJob(historyEntry) });}
    return NextResponse.json({ error: `Reel job not found: ${jobId}` }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
