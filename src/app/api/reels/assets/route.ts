export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadConfig } from "@/config";
import { getLocalAccessError, localAccessDeniedResponse } from "@/server/local-access";
import { listCachedSourceAssets } from "@/reel/source-url";

export async function GET(request: Request): Promise<Response> {
  const localAccessError = getLocalAccessError(request);
  if (localAccessError) {return localAccessDeniedResponse(localAccessError);}
  const config = loadConfig();
  const assets = await listCachedSourceAssets(config);
  return NextResponse.json({ assets });
}
