import { ReelOrchestrator } from "@/reel/orchestrator";
import { loadConfig } from "@/config";

const SOURCE = "https://youtu.be/pyV68KvUwlw";
const SCRIPT = `Title: The Biggest World Cup Ever
r/sports

The 2026 World Cup is going to be absolutely massive. For the first time ever, forty-eight teams will compete across three countries. The United States, Canada, and Mexico are hosting together, bringing the tournament to sixteen cities.

This isn't just another World Cup. It's a tournament that will span an entire continent. Imagine fans traveling from Toronto to Guadalajara, from Los Angeles to New York, following their teams across borders.

The opening match kicks off in Mexico City at the iconic Estadio Azteca. The final will be held at MetLife Stadium in New Jersey. With forty-eight teams, there will be more underdog stories, more drama, and more moments that define a generation of football fans.

The world has never seen anything quite like this.`;

async function main() {
  const config = loadConfig();
  const orchestrator = new ReelOrchestrator(config);

  const job = orchestrator.createJob({
    text: SCRIPT,
    source: { type: "url", url: SOURCE },
    voiceId: "af_heart",
    tone: "storytelling",
    quality: "standard",
    storyCard: {
      enabled: true,
      themeId: "reddit-light",
      layoutMode: "center-card",
      timingMode: "estimated",
      wordsPerCard: 22,
      maxLinesPerCard: 4,
      transition: "scale-fade",
      backgroundDim: 0.16,
      backgroundBlur: 0,
      showHeader: true,
      showMetadata: true,
      showUpvotes: true,
      showComments: true,
    },
  });

  console.log(`Starting demo reel job: ${job.id}`);
  const startTime = Date.now();

  try {
    const result = await orchestrator.runJob(job.id);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nDemo reel completed in ${elapsed}s`);
    console.log(`Video path: ${result.videoPath}`);
    console.log(`Duration: ${Math.round(result.durationMs / 1000)}s`);
  } catch (err) {
    console.error(`Demo reel failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

main();
