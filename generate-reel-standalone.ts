import { ReelOrchestrator } from "@/reel/orchestrator";
import { loadConfig } from "@/config";
import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SOURCE = "/Users/atmikshetty/personal/reddit/data/reels/source-cache/aHR0cHM6Ly95b3V0dS5iZS9GcjFkTmxj.mp4";
const STORY = `The leather of the driver's seat is cold, even through my jeans. I grip the steering wheel—suede, expensive, real—and stare out at the skyline of the city that once made me feel like an insect. Three years ago, I was eating instant noodles in a studio apartment that smelled like damp concrete. That was the night I found out about Sarah. I remember the way she looked at me when she dropped the news—not with pity, but with a kind of impatient indifference. She didn't even try to hide the name. She just said, "He has options, Mark. He has a future. You're just… waiting for something that isn't coming." She left with him in a car that cost more than my father had earned in a decade. I remember the sound of that engine fading away, leaving me standing on the sidewalk in the rain, my pockets empty and my pride shredded. Today, I pulled up to the valet stand at the gala downtown. I didn't drive the cheap sedan I bought when I finally landed that first contract. I pulled up in a machine that looks like it was carved out of shadows and money. I stepped out, tossed the keys to the attendant, and felt the weight of the suit I was wearing—bespoke, Italian, tailored to fit the man I'd rebuilt myself into. I walked through the lobby, my reflection catching in the floor-to-ceiling glass. I didn't recognize the guy looking back at me, not just because of the clothes, but because of the eyes. They were steady. The hunger hadn't gone away, but the desperation had been replaced by cold, hard intent. And then, I saw them. Sarah was standing near the bar. She hadn't changed much—still elegant, still draped in jewelry that felt like a cage. She was laughing at something the guy was saying. He looked exactly the same as he did three years ago: soft, entitled, fading. I didn't rush. I didn't need to. I walked toward the bar, ordering a drink without looking at them. I felt her eyes move across the room, catching on my suit, then my watch, then my face. She went quiet. The laugh died in her throat. I turned slowly, setting my glass down on the marble counter. I didn't offer a smile. I didn't offer an insult. I just looked at her—really looked at her—and saw exactly what I had lost. I hadn't lost a soulmate; I had lost an anchor that was trying to drown me. "Hello, Sarah," I said. My voice was calm, resonant, and entirely unimpressed. The look on her face wasn't regret. It was confusion. She couldn't reconcile the boy she stepped over with the man currently standing in her orbit, commanding the air in the room. I turned my back on them and walked toward the terrace. I didn't need their validation. I didn't need revenge. I had spent three years obsessed with proving them wrong, but standing here, looking out over the city I now helped build, I realized the truth: they were never the goal. I am.`;

const configJson = process.argv[2];
if (!configJson) {
  console.error("Usage: bun run generate-reel-standalone.ts <theme-config-json>");
  process.exit(1);
}

const themeConfig = JSON.parse(configJson);

async function main() {
  const config = loadConfig();
  const orchestrator = new ReelOrchestrator(config);

  const job = orchestrator.createJob({
    text: STORY,
    source: { type: "url", url: SOURCE },
    voiceId: themeConfig.voiceId,
    tone: themeConfig.tone,
    quality: themeConfig.quality,
    storyCard: {
      enabled: true,
      themeId: themeConfig.themeId,
      layoutMode: themeConfig.layoutMode,
      transition: themeConfig.transition,
      timingMode: themeConfig.timingMode,
      wordsPerCard: 22,
      showHeader: true,
      showMetadata: true,
      showUpvotes: true,
      showComments: true,
      ...(themeConfig.backgroundBlur ? { backgroundBlur: themeConfig.backgroundBlur } : {}),
      ...(themeConfig.cardPosition ? { cardPosition: themeConfig.cardPosition } : {}),
    },
  });

  console.error(`[${themeConfig.themeId}] Starting job: ${job.id}`);
  const startTime = Date.now();

  try {
    const result = await orchestrator.runJob(job.id);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const videoPath = result.videoPath;
    const fileExists = existsSync(videoPath);
    const fileSize = fileExists ? statSync(videoPath).size : 0;

    let videoInfo: Record<string, unknown> = {};
    if (fileExists && fileSize > 0) {
      const probe = spawnSync("ffprobe", [
        "-v", "error", "-show_entries",
        "format=duration:stream=codec_name,width,height",
        "-of", "json", videoPath,
      ], { encoding: "utf-8" });
      try {
        const probeData = JSON.parse(probe.stdout);
        const duration = parseFloat(probeData.format?.duration || "0");
        const vstream = (probeData.streams || []).find((s: Record<string, unknown>) => s.codec_name === "h264");
        videoInfo = {
          duration: duration.toFixed(1) + "s",
          width: vstream?.width || "?",
          height: vstream?.height || "?",
          codec: vstream?.codec_name || "?",
        };
      } catch {}
    }

    const output = {
      theme: themeConfig.themeId,
      status: "completed",
      jobId: job.id,
      videoPath,
      fileExists,
      fileSize,
      elapsedSec: elapsed,
      durationMs: result.durationMs,
      ...videoInfo,
    };
    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const output = {
      theme: themeConfig.themeId,
      status: "failed",
      jobId: job.id,
      error: err instanceof Error ? err.message : String(err),
      elapsedSec: elapsed,
      steps: job.steps,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = 1;
  }
}

main();
