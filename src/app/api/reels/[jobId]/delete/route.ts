import { unlinkSync, existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { getHistoryEntryById, removeFromHistory } from "@/reel/history";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";
import { getReelService } from "@/server/reel-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ jobId: string }> }): Promise<NextResponse<{ error: string } | Record<string, never>>> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) { return localAccessDeniedResponse(localAccessError); }
  try {
    const { jobId } = await params;
    const service = getReelService();
    const job = service.getJob(jobId);

    if (!job) {
      const historyEntry = await getHistoryEntryById(jobId);
      if (!historyEntry) {return NextResponse.json({ error: `Reel job not found: ${jobId}` }, { status: 404 });}
      if (historyEntry.videoPath && existsSync(historyEntry.videoPath)) { try { unlinkSync(historyEntry.videoPath); } catch {} }
      await removeFromHistory(jobId);
      return new NextResponse(null, { status: 204 });
    }

    if (job.status === "running") {return NextResponse.json({ error: "Cannot delete a running job" }, { status: 409 });}

    if (job.videoPath && existsSync(job.videoPath)) { try { unlinkSync(job.videoPath); } catch {} }
    if (job.audioPath && existsSync(job.audioPath)) { try { unlinkSync(job.audioPath); } catch {} }
    if (job.subtitlePath && existsSync(job.subtitlePath)) { try { unlinkSync(job.subtitlePath); } catch {} }
    service.deleteJob(jobId);
    await removeFromHistory(jobId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
