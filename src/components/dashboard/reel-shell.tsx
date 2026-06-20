"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Circle, Globe, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import { useReelExtractor } from "@/hooks/use-reel-extractor";
import type { ReelHistoryEntry } from "@/reel/history";
import type { ReelStepInfo } from "@/hooks/use-reel-extractor";
import type { ReelSubmitOptions } from "@/hooks/use-reel-extractor";
import { REEL_PRESETS } from "@/reel/presets";
import { KOKORO_TTS_VOICES, KOKORO_DEFAULT_VOICE } from "@/reel/constants";

interface CachedSourceAsset {
  id: string;
  url: string;
  platform: string;
  title: string;
  durationSec: number;
  width: number;
  height: number;
  lastUsedAt: string;
}

function ReelStepIndicator({ step }: { step: ReelStepInfo }): JSX.Element {
  const icon = step.status === "completed" ? <Check className="h-3.5 w-3.5 text-emerald-400" />
    : step.status === "in_progress" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-400" />
    : step.status === "failed" ? <X className="h-3.5 w-3.5 text-rose-400" />
    : <Circle className="h-3.5 w-3.5 text-[#444444]" />;

  const labelColor = step.status === "completed" ? "text-emerald-300"
    : step.status === "in_progress" ? "text-amber-300"
    : step.status === "failed" ? "text-rose-300"
    : "text-[#444444]";

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">{icon}</div>
      <span className={`font-mono text-[0.85rem] ${labelColor}`}>{step.label}</span>
    </div>
  );
}

function ReelProgressBar({ steps }: { steps: ReelStepInfo[] }): JSX.Element {
  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : "#fbbf24" }} />
    </div>
  );
}

const VOICE_OPTIONS = KOKORO_TTS_VOICES;

const STORY_THEME_OPTIONS = [
  { value: "reddit-light", label: "Reddit Light" },
  { value: "reddit-dark", label: "Reddit Dark" },
  { value: "reddit-orange", label: "Reddit Orange" },
  { value: "minimal-white", label: "Minimal White" },
  { value: "glass-dark", label: "Glass Dark" },
] as const;

const STORY_TRANSITION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide-up", label: "Slide Up" },
  { value: "scale-fade", label: "Scale Fade" },
] as const;

const SOURCE_OPTIONS = [
  { value: "url", label: "Video URL", icon: Globe },
  { value: "previous-assets", label: "Previous Assets", icon: RotateCcw },
] as const;

function getSourceLabel(entry: ReelHistoryEntry): string {
  return entry.sourceUrl ? "URL source" : "Unknown";
}

function getRenderStyleLabel(): string {
  return "Story Cards";
}

function isValidVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("youtube.com") || lower.includes("youtu.be");
}

export function ReelShell(): JSX.Element {
  const glowRef = useRef<HTMLDivElement>(null);
  const { error, isDone, isProcessing, isStarting, job, steps, videoUrl, reset, submitScript } = useReelExtractor();

  const [script, setScript] = useState("");
  const [sourceType, setSourceType] = useState<"url" | "previous-assets">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string>(KOKORO_DEFAULT_VOICE);
  const [storyTitle, setStoryTitle] = useState("");
  const [storySubreddit, setStorySubreddit] = useState("r/AskReddit");
  const [storyUsername, setStoryUsername] = useState("u/storyteller");
  const [storyTheme, setStoryTheme] = useState<string>("reddit-light");
  const [storyWordsPerCard, setStoryWordsPerCard] = useState<number>(20);
  const [storyBackgroundDim, setStoryBackgroundDim] = useState<number>(0.16);
  const [storyTransition, setStoryTransition] = useState<string>("scale-fade");
  const [reelHistory, setReelHistory] = useState<ReelHistoryEntry[]>([]);
  const [cachedAssets, setCachedAssets] = useState<CachedSourceAsset[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/reels/history");
        if (response.ok) { const data = (await response.json()) as { history: ReelHistoryEntry[] }; setReelHistory(data.history.slice(0, 12)); }
      } catch {}
    })();
  }, [isDone]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/reels/assets");
        if (response.ok) { const data = (await response.json()) as { assets: CachedSourceAsset[] }; setCachedAssets(data.assets); setSelectedAssetId((current) => current || data.assets[0]?.id || ""); }
      } catch {}
    })();
  }, [isDone]);

  const handleDeleteReel = useCallback(async (e: React.MouseEvent, reelId: string): Promise<void> => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this reel permanently?")) {return;}
    setDeletingId(reelId);
    try { const response = await fetch(`/api/reels/${reelId}/delete`, { method: "DELETE" }); if (response.ok) {setReelHistory((prev) => prev.filter((entry) => entry.id !== reelId));} }
    finally { setDeletingId(null); }
  }, []);

  const completedStepCount = steps.filter((s) => s.status === "completed").length;
  const showProgress = isProcessing || isDone;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (glowRef.current) {glowRef.current.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;}
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setUrlError(null);
    if (!script.trim() || isStarting || isProcessing) {return;}

    let source: ReelSubmitOptions["source"];
    if (sourceType === "url") {
      if (!sourceUrl.trim()) {return;}
      if (!isValidVideoUrl(sourceUrl.trim())) { setUrlError("Invalid URL."); return; }
      source = { type: "url", url: sourceUrl.trim() };
    } else {
      const asset = cachedAssets.find((item) => item.id === selectedAssetId);
      if (!asset) { setUrlError("Choose a previous asset first."); return; }
      source = { type: "url", url: asset.url };
    }

    submitScript(script, {
      voiceId, source,
      quality: "standard", ttsProvider: "kokoro",
      storyCard: {
        enabled: true, title: storyTitle, subreddit: storySubreddit, username: storyUsername,
        themeId: storyTheme, wordsPerCard: storyWordsPerCard, transition: storyTransition,
        backgroundDim: storyBackgroundDim, showHeader: true, showMetadata: true, showUpvotes: true, showComments: true,
      },
    });
  }, [script, sourceType, sourceUrl, selectedAssetId, cachedAssets, voiceId, storyTitle, storySubreddit, storyUsername, storyTheme, storyWordsPerCard, storyTransition, storyBackgroundDim, isStarting, isProcessing, submitScript]);

  return (
    <>
      <div className="bg-grid" />
      <div className="ambient-aura" />
      <div ref={glowRef} className="cursor-glow" />

      <main className="container mx-auto max-w-[1040px] px-6 pt-8 pb-16 text-white">
        <div className="mb-10 flex items-center gap-2.5">
          <img alt="RedditReel" className="h-8 w-8 rounded-md" height={32} src="/icon.png" width={32} />
          <span className="font-mono text-sm font-semibold tracking-tight text-white">RedditReel</span>
        </div>
        <header className="mb-16">
          <h1 className="mb-3 text-4xl font-light tracking-tight text-white sm:text-5xl">
            Write a script.
            <br />
            Get a reel.
          </h1>
          <p className="max-w-[600px] text-[0.9rem] leading-relaxed text-[#888888]">
            Turn any script into a short-form video. Use game footage as background, or paste any YouTube video URL.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {REEL_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => {
                if (preset.settings.storyCard) {
                  setStoryTitle(preset.settings.storyCard.title ?? "");
                  setStorySubreddit(preset.settings.storyCard.subreddit ?? "r/AskReddit");
                  setStoryUsername(preset.settings.storyCard.username ?? "u/storyteller");
                  setStoryTheme(preset.settings.storyCard.themeId ?? "reddit-light");
                  setStoryWordsPerCard(preset.settings.storyCard.wordsPerCard ?? 20);
                  setStoryTransition(preset.settings.storyCard.transition ?? "scale-fade");
                  setStoryBackgroundDim(preset.settings.storyCard.backgroundDim ?? 0.16);
                }
              }} className="inline-flex items-center gap-1.5 rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2.5 py-1.5 font-mono text-[0.7rem] text-[#888888] transition-colors hover:border-[#333333] hover:text-white">
                {preset.label}
              </button>
            ))}
          </div>


          {error ? (
            <div className="mt-8 max-w-[600px] rounded border border-[#FF3300] bg-[rgba(255,51,0,0.1)] px-4 py-3 font-mono text-sm text-[#FF3300]">
              <span className="font-bold">REEL_ERROR:</span> {error}
            </div>
          ) : null}

          <form className="mt-12 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A]/60 p-3 backdrop-blur-[10px] transition-colors hover:border-[#333333]" onSubmit={handleSubmit}>
            <div className="grid gap-3">
              <label className="flex min-w-0 items-center gap-3 rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 transition-colors hover:border-[#333333] focus-within:border-[#333333]">
                <span className="shrink-0 font-mono text-[#444444]">❯</span>
                <input className="min-w-0 flex-1 bg-transparent font-mono text-[0.9rem] text-white outline-none placeholder:text-[#444444]" disabled={isStarting || isProcessing} onChange={(e) => setScript(e.target.value)} placeholder="Write your script here... min 5 words." value={script} />
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              {SOURCE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = sourceType === opt.value;
                return <button key={opt.value} type="button" onClick={() => setSourceType(opt.value as "url" | "previous-assets")} disabled={isStarting || isProcessing}
                  className={`inline-flex items-center gap-2 rounded px-3 py-2 font-mono text-[0.75rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isActive ? "border border-[#333333] bg-[#1A1A1A] text-white" : "border border-[#1A1A1A] bg-[#0A0A0A] text-[#888888] hover:border-[#333333] hover:text-white"}`}>
                  <Icon className="h-3.5 w-3.5" /> {opt.label}
                </button>;
              })}
            </div>

            {sourceType === "url" ? (
              <div className="mt-3">
                <label className="flex min-w-0 items-center gap-3 rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 transition-colors hover:border-[#333333] focus-within:border-[#333333]">
                  <span className="shrink-0 font-mono text-[#444444]">🔗</span>
                  <input className="min-w-0 flex-1 bg-transparent font-mono text-[0.9rem] text-white outline-none placeholder:text-[#444444]" disabled={isStarting || isProcessing} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Paste a YouTube URL..." value={sourceUrl} />
                </label>
              </div>
            ) : sourceType === "previous-assets" ? (
              <div className="mt-3 rounded border border-[#1A1A1A] bg-[#0A0A0A]/40 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Previous Assets</div>
                {cachedAssets.length > 0 ? (
                  <select aria-label="Previous source asset" className="w-full cursor-pointer rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 font-mono text-[0.75rem] text-[#888888] outline-none transition-colors hover:border-[#333333] hover:text-white" disabled={isStarting || isProcessing} onChange={(e) => setSelectedAssetId(e.target.value)} value={selectedAssetId}>
                    {cachedAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {Math.round(asset.durationSec)}s</option>)}
                  </select>
                ) : <p className="font-mono text-[0.75rem] text-[#666666]">No cached URL assets yet.</p>}
              </div>
            ) : null}

            <div className="mt-3 rounded border border-[#1A1A1A] bg-[#0A0A0A]/40 p-3">
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Story Card Options</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Title</div>
                    <input className="w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-[0.75rem] text-white outline-none transition-colors hover:border-[#333333] focus:border-[#333333]" disabled={isStarting || isProcessing} onChange={(e) => setStoryTitle(e.target.value)} placeholder="Story title..." value={storyTitle} />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Subreddit</div>
                    <input className="w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-[0.75rem] text-white outline-none transition-colors hover:border-[#333333] focus:border-[#333333]" disabled={isStarting || isProcessing} onChange={(e) => setStorySubreddit(e.target.value)} placeholder="r/AskReddit" value={storySubreddit} />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Username</div>
                    <input className="w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-[0.75rem] text-white outline-none transition-colors hover:border-[#333333] focus:border-[#333333]" disabled={isStarting || isProcessing} onChange={(e) => setStoryUsername(e.target.value)} placeholder="u/storyteller" value={storyUsername} />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Theme</div>
                    <select className="w-full cursor-pointer rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-[0.75rem] text-[#888888] outline-none transition-colors hover:border-[#333333] hover:text-white" disabled={isStarting || isProcessing} onChange={(e) => setStoryTheme(e.target.value)} value={storyTheme}>
                      {STORY_THEME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Transition</div>
                    <select className="w-full cursor-pointer rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-[0.75rem] text-[#888888] outline-none transition-colors hover:border-[#333333] hover:text-white" disabled={isStarting || isProcessing} onChange={(e) => setStoryTransition(e.target.value)} value={storyTransition}>
                      {STORY_TRANSITION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">
                      <span>Words per card</span>
                      <span className="text-[#888888]">{storyWordsPerCard}</span>
                    </div>
                    <input className="w-full cursor-pointer" disabled={isStarting || isProcessing} max={40} min={12} onChange={(e) => setStoryWordsPerCard(Number(e.target.value))} type="range" value={storyWordsPerCard} />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">
                      <span>Background dim</span>
                      <span className="text-[#888888]">{storyBackgroundDim.toFixed(2)}</span>
                    </div>
                    <input className="w-full cursor-pointer" disabled={isStarting || isProcessing} max={0.4} min={0} onChange={(e) => setStoryBackgroundDim(Number(e.target.value))} step={0.01} type="range" value={storyBackgroundDim} />
                  </div>
                </div>
              </div>

            <div className="mt-3 grid gap-3">
              <div className="w-full">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-[#444444]">Voice</div>
                <select aria-label="Voice" className="w-full cursor-pointer rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2.5 font-mono text-[0.75rem] text-[#888888] outline-none transition-colors hover:border-[#333333] hover:text-white" disabled={isStarting || isProcessing} onChange={(e) => setVoiceId(e.target.value)} value={voiceId}>
                  {VOICE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <button className="w-full cursor-pointer rounded border-none bg-white px-6 py-3 font-mono text-[0.85rem] font-medium text-black transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" disabled={isStarting || isProcessing || !script.trim() || (sourceType === "url" && !sourceUrl.trim()) || (sourceType === "previous-assets" && !selectedAssetId)} type="submit">
                {isStarting ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Starting</span>
                : isProcessing ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Generating</span>
                : "Generate"}
              </button>
            </div>
          </form>

          {isDone ? (
            <button className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A]/60 px-4 py-3 font-mono text-[0.85rem] text-[#888888] backdrop-blur-[10px] transition-colors hover:border-[#333333] hover:text-white" onClick={() => { reset(); setScript(""); setSourceUrl(""); setStoryTitle(""); setStorySubreddit("r/AskReddit"); setStoryUsername("u/storyteller"); setStoryTheme("reddit-light"); setStoryWordsPerCard(20); setStoryBackgroundDim(0.16); setStoryTransition("scale-fade"); }} type="button">
              <RotateCcw className="h-3.5 w-3.5" /> New
            </button>
          ) : null}

          <p className="mt-3 max-w-[600px] font-mono text-[0.75rem] text-[#444444]">
            Paste a script, pick a source, and generate a reel with TTS and subtitles.
            {script.trim() ? <span className="ml-2 text-[#888888]">{script.trim().split(/\s+/).filter(Boolean).length} words · ~{Math.ceil((script.trim().split(/\s+/).filter(Boolean).length / 150) * 60)}s</span> : null}
          </p>
        </header>

        {showProgress ? (
          <section className="mb-16">
            <div className="mb-8 max-w-[600px]">
              <h2 className="mb-2 text-2xl font-medium tracking-tight text-white">Reel Generation</h2>
              <div className="flex items-center gap-2 font-mono text-[0.85rem] text-[#888888]">
                <span>{completedStepCount}/{steps.length} steps</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className={isDone ? "text-emerald-400" : "text-amber-400"}>{isDone ? "Complete" : "Processing"}</span>
              </div>
            </div>
            <div className="mb-8 max-w-[600px]"><ReelProgressBar steps={steps} /></div>
            <div className="grid max-w-[600px] grid-cols-1 gap-1 sm:grid-cols-2">
              {steps.map((step) => <ReelStepIndicator key={step.step} step={step} />)}
            </div>
            {isDone && job?.error ? <div className="mt-6 max-w-[600px] rounded border border-[#FF3300]/30 bg-[rgba(255,51,0,0.05)] px-4 py-3 font-mono text-[0.85rem] text-[#FF3300]/80">Error: {job.error}</div> : null}
          </section>
        ) : null}

        {videoUrl ? (
          <section className="relative py-8">
            <span className="mb-6 block font-mono text-xs uppercase tracking-[0.1em] text-[#FF3300]">02 // Generated Reel</span>
            <div className="mx-auto max-w-[360px] overflow-hidden rounded-lg border border-[#1A1A1A] bg-[rgba(5,5,5,0.9)] backdrop-blur-[10px]">
              <div className="relative aspect-[9/16] bg-[#0A0A0A]">
                <video className="h-full w-full object-cover" controls playsInline preload="metadata" src={videoUrl} />
              </div>
              {job?.durationMs ? <div className="p-4"><p className="font-mono text-[0.75rem] text-[#888888]">Duration: {Math.round(job.durationMs / 1000)}s</p></div> : null}
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <a className="inline-flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A]/60 px-4 py-3 font-mono text-[0.85rem] text-[#888888] backdrop-blur-[10px] transition-colors hover:border-[#333333] hover:text-white" download href={videoUrl}>Download MP4</a>
            </div>
          </section>
        ) : null}

        {reelHistory.length > 0 ? (
          <section className="relative py-8">
            <span className="mb-6 block font-mono text-xs uppercase tracking-[0.1em] text-[#FF3300]">{videoUrl ? "03" : "02"} {/* Previous Reels */}</span>
            <h2 className="mb-2 text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.1] tracking-[-0.04em]">Previously generated</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reelHistory.map((entry) => (
                <div key={entry.id} className="group relative overflow-hidden rounded-lg border border-[#1A1A1A] bg-[rgba(5,5,5,0.9)] backdrop-blur-[10px] transition-colors hover:border-[#333333] hover:bg-[rgba(15,15,15,0.9)]">
                  {entry.videoPath && entry.status === "completed" ? (
                    <div className="flex justify-center bg-[#0A0A0A] p-2">
                      <div className="relative aspect-[9/16] w-full max-w-[270px] overflow-hidden rounded-md">
                        <video className="h-full w-full object-cover" controls playsInline preload="metadata" src={`/api/reels/${entry.id}/video`} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center bg-[#0A0A0A] p-2">
                      <div className="relative flex aspect-[9/16] w-full max-w-[270px] items-center justify-center overflow-hidden rounded-md">
                        <div className="text-center font-mono text-[0.7rem] uppercase text-[#444444]">
                          {entry.status === "running" ? <span className="inline-flex items-center gap-2 text-amber-400"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Generating</span>
                          : entry.status === "failed" ? <span className="text-rose-400">Failed</span> : <span>Pending</span>}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="line-clamp-2 font-medium text-white">{entry.script.slice(0, 60)}{entry.script.length > 60 ? "..." : ""}</p>
                    <div className="mt-2 flex items-center gap-3 font-mono text-[0.7rem] uppercase text-[#444444]">
                      <span className={entry.status === "completed" ? "text-emerald-400" : entry.status === "failed" ? "text-rose-400" : entry.status === "running" ? "text-amber-400" : "text-[#888888]"}>{entry.status}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#444444]" />
                      <span className="text-[#888888]">{getSourceLabel(entry)}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#444444]" />
                      <span className="text-[#888888]">{getRenderStyleLabel()}</span>
                      {entry.durationMs ? <><span className="h-1.5 w-1.5 rounded-full bg-white/80" /><span className="text-[#888888]">{Math.round(entry.durationMs / 1000)}s</span></> : null}
                    </div>
                    <div className="mt-1 font-mono text-[0.6rem] text-[#666666]">{formatTimestamp(entry.timestamp)}</div>
                    {entry.videoPath && entry.status === "completed" ? (
                      <a className="mt-3 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase text-[#888888] transition-colors hover:text-white" download href={`/api/reels/${entry.id}/video`}>Download MP4</a>
                    ) : null}
                  </div>
                  <button className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[#888888] opacity-0 backdrop-blur-sm transition-all hover:bg-rose-500/80 hover:text-white group-hover:opacity-100 disabled:opacity-50" disabled={deletingId === entry.id} onClick={(e) => void handleDeleteReel(e, entry.id)} type="button" aria-label="Delete reel">
                    {deletingId === entry.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="mx-auto flex max-w-[1040px] items-center justify-between border-t border-[#1A1A1A] px-6 py-16 text-[0.85rem] text-[#444444]">
        <div>Powered by <span className="text-[#888888]">Kokoro-82M TTS</span>, <span className="text-[#888888]">Whisper Local</span>, and <span className="text-[#888888]">FFmpeg</span></div>
        <div className="flex items-center gap-2">raw-reddit</div>
      </footer>
    </>
  );
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) {return "just now";}
  if (diffMin < 60) {return `${diffMin}m ago`;}
  if (diffHr < 24) {return `${diffHr}h ago`;}
  if (diffDay < 7) {return `${diffDay}d ago`;}
  return date.toLocaleDateString();
}
