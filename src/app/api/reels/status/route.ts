export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadConfig } from "@/config";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";

export async function GET(request: Request): Promise<Response> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) { return localAccessDeniedResponse(localAccessError); }
  const config = loadConfig();
  // Kokoro runs locally with no API key, so TTS is always "configured"; we
  // surface the active model id for visibility in the dashboard.
  return NextResponse.json({ status: "ok", reel: true, ttsProvider: "kokoro", ttsConfigured: true, kokoroModelId: config.kokoroModelId });
}
