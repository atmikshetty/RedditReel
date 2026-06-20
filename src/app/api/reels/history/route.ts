import { NextResponse } from "next/server";
import { loadReelHistory } from "@/reel/history";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse<{ history: import("@/reel/history").ReelHistoryEntry[] } | { error: string }>> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}
  try {
    const history = await loadReelHistory();
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
