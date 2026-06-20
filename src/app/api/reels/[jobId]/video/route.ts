import { createReadStream, existsSync, statSync } from "node:fs";
import { NextResponse } from "next/server";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";
import { getReelService } from "@/server/reel-service";
import { getHistoryEntryById } from "@/reel/history";
import { closeController, enqueueChunk, errorController } from "@/server/stream-controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createVideoStream(filePath: string, start?: number, end?: number): ReadableStream<Uint8Array> {
  const stream = createReadStream(filePath, { end, start });
  return new ReadableStream<Uint8Array>({
    cancel() { stream.destroy(); },
    start(controller) {
      const cleanup = () => { stream.off("close", onClose); stream.off("data", onData); stream.off("end", onEnd); stream.off("error", onError); };
      const onClose = () => { cleanup(); };
      const onData = (chunk: string | Buffer) => { const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk; if (!enqueueChunk(controller, new Uint8Array(buf))) { cleanup(); stream.destroy(); } };
      const onEnd = () => { cleanup(); closeController(controller); };
      const onError = (err: Error) => { cleanup(); errorController(controller, err); };
      stream.on("close", onClose);
      stream.on("data", onData);
      stream.once("end", onEnd);
      stream.once("error", onError);
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }): Promise<NextResponse | Response> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}
  try {
    const { jobId } = await params;
    let videoPath: string | null = null;
    const job = getReelService().getJob(jobId);
    if (job) {videoPath = job.videoPath;}
    else { const h = await getHistoryEntryById(jobId); if (h) {videoPath = h.videoPath;} }
    if (!videoPath) {return NextResponse.json({ error: "Video not yet available" }, { status: 404 });}
    if (!existsSync(videoPath)) {return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });}

    const { size } = statSync(videoPath);
    const range = request.headers.get("range");

    if (!range) {
      return new Response(createVideoStream(videoPath), {
        status: 200,
        headers: { "Accept-Ranges": "bytes", "Content-Disposition": `inline; filename="${jobId}.mp4"`, "Content-Length": String(size), "Content-Type": "video/mp4" },
      });
    }

    const [rawStart, rawEnd] = range.replace("bytes=", "").split("-");
    const start = Number.parseInt(rawStart, 10);
    const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;
    const safeEnd = Math.min(Number.isNaN(end) ? size - 1 : end, size - 1);
    const safeStart = Number.isNaN(start) ? 0 : Math.max(0, start);
    if (safeStart > safeEnd || safeStart >= size) {return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });}

    const chunkSize = safeEnd - safeStart + 1;
    return new Response(createVideoStream(videoPath, safeStart, safeEnd), {
      status: 206,
      headers: { "Accept-Ranges": "bytes", "Content-Disposition": `inline; filename="${jobId}.mp4"`, "Content-Length": String(chunkSize), "Content-Range": `bytes ${safeStart}-${safeEnd}/${size}`, "Content-Type": "video/mp4" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
