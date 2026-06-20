# clip-farm Reel Pipeline — Complete Technical Deep Dive

Automated content factory for short-form vertical videos. This document exhaustively details the reel generation pipeline — the **standard reel path**, the **karaoke caption path**, and the **Reddit story card path** — covering every module, type, algorithm, FFmpeg filter graph, Remotion composition, SSE streaming architecture, and state machine.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Type System](#2-type-system)
3. [Configuration (Zod Schema)](#3-configuration-zod-schema)
4. [Standard Reel Pipeline](#4-standard-reel-pipeline)
5. [Story Card Pipeline (Reddit Story Cards)](#5-story-card-pipeline-reddit-story-cards)
6. [Asset Selection System](#6-asset-selection-system)
7. [Text-to-Speech (Local Kokoro-82M)](#7-text-to-speech-local-kokoro-82m)
8. [Subtitle Generation (Whisper)](#8-subtitle-generation-whisper)
9. [Video Composition (FFmpeg)](#9-video-composition-ffmpeg)
10. [Remotion Rendering Engine](#10-remotion-rendering-engine)
11. [Error Handling & Retry System](#11-error-handling--retry-system)
12. [Queue & Concurrency](#12-queue--concurrency)
13. [Job History & Persistence](#13-job-history--persistence)
14. [Web UI (Next.js) & SSE](#14-web-ui-nextjs--sse)
15. [API Routes](#15-api-routes)
16. [Cleanup & Resource Management](#16-cleanup--resource-management)

---

## 1. Architecture Overview

The reel pipeline lives in `src/reel/` (1174 lines across 17 files + 443 lines across 10 files in `src/reel/story-card/`) and is orchestrated by the `ReelOrchestrator` class. It processes text scripts into short-form vertical videos through four distinct rendering styles:

```
┌──────────────────────────────────────────────────────────────────┐
│                        ReelOrchestrator                          │
│                                                                  │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Asset   │→ │ TTS      │→ │Subtitle  │→ │ Compositor      │  │
│  │ Select  │  │Kokoro-82M│  │Whisper   │  │ FFmpeg/Remotion │  │
│  └─────────┘  └──────────┘  └──────────┘  └─────────────────┘  │
│                                                   │              │
│  ┌───────────────────── Story Card Path ──────────┤              │
│  │  ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────┐  │              │
│  │  │Script  │→│Chunk │→│Timeline│→│ Remotion  │  │              │
│  │  │Norm    │ │Story │ │Build   │ │ Overlay   │  │              │
│  │  └────────┘ └──────┘ └────────┘ └──────────┘  │              │
│  │                                          │      │              │
│  │  ┌───────────────────────────────────────┘      │              │
│  │  │ FFmpeg Composite (overlay + audio)           │              │
│  └─────────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

### Three Render Styles

1. **`standard`** — Background video (game clip or URL) + TTS narration + SRT subtitles burned in via ASS.
2. **`karaoke`** — Same background + TTS, but subtitles rendered as karaoke (word-by-word highlighting) using ASS `\k` timing codes.
3. **`reddit-story-cards`** — Background video + TTS narration + Remotion-rendered text cards that look like Reddit posts (title card, body cards with Reddit themes, transitions).

---

## 2. Type System

All types are defined in `src/reel/types.ts` and `src/reel/story-card/types.ts`.

### Core Pipeline Types

```typescript
type TTSProvider = "kokoro";
type ReelJobStatus = "queued" | "running" | "completed" | "failed";
```

### Source Configuration

A single URL source variant, discriminated by `type`:

- **`ReelSourceUrl`**: `{ type: "url", url: string, platform?: "youtube" }`

The `url` may be a remote video URL (downloaded via yt-dlp) or a previously-cached local file path (used directly). No bundled footage is shipped.

### Pipeline I/O Types

- **`ReelScriptInput`** — The external API input carrying `text`, `voiceId`, `tone`, `source`, `quality`, `ttsProvider`, `ttsModel`, and `storyCard?`.
- **`ReelTTSOutput`** — `{ audioPath, durationMs, format }` — path to the generated WAV, duration in milliseconds, format string (`"wav"`).
- **`ReelSubtitleSegment`** — `{ index, startMs, endMs, text }` — a single subtitle cue with millisecond precision.
- **`ReelSubtitleOutput`** — `{ segments, srtPath, format }` — the full subtitle payload.
- **`ReelPipelineOutput`** — The final result: `{ videoPath, audioPath, subtitlePath, durationMs, segments, metadata }`.
- **`ReelPipelineMetadata`** — Render metadata: `totalDuration`, `assetUsed`, `voiceId`, `modelId`, `renderTimeMs`, `steps` (array of `ReelStepResult`), `storyCard?`.

### Job Type

`ReelJob` is the persisted job document stored in memory and optionally written to `data/reel-history.json`. It mirrors `ReelScriptInput` plus runtime fields (`status`, `videoPath`, `audioPath`, `subtitlePath`, `durationMs`, `error`, `steps`, timestamps).

### Story Card Types

```typescript
type StoryCardThemeId = "reddit-light" | "reddit-dark" | "reddit-orange" | "minimal-white" | "glass-dark" | "custom";
type StoryCardTimingMode = "estimated" | "word-aligned" | "sentence-aligned";
type StoryCardLayoutMode = "center-card" | "top-card" | "comment-stack" | "post-and-comments";
type StoryCardTransition = "none" | "fade" | "slide-up" | "scale-fade";
type StoryCardPosition = "top" | "center" | "lower";
```

**`StoryCardOptions`** — 28 optional fields controlling every aspect of card generation: title, subreddit, username, themeId, layoutMode, timingMode, wordsPerCard, maxLinesPerCard, maxCharsPerLine, cardPosition, cardWidthRatio, showHeader/showMetadata/showProgress/showUpvotes/showComments, fakeUpvotes/fakeComments, transition, transitionDurationMs, introCardMs/outroCardMs, backgroundDim/backgroundBlur, useActualRedditAsset, customCardAssetPath.

**`NormalizedStoryScript`** — Output of the normalizer: `{ title, body, subreddit?, username?, sourceUrl?, paragraphs[], wordCount, estimatedReadSeconds }`.

**`StoryTextChunk`** — A single chunk destined for one card: `{ id, index, text, words[], wordStartIndex, wordEndIndex, charCount, lineEstimate, isTitleCard?, isOutroCard? }`.

**`StoryCardTimelineItem`** — A timed card on the timeline: `{ id, index, text, title?, subreddit?, username?, startMs, endMs, durationMs, progress, isTitleCard?, isOutroCard?, visual: { themeId, layoutMode, transition, position } }`.

**`StoryCardTimeline`** — The complete timeline document: `{ version: 1, audioDurationMs, videoDurationMs, width, height, fps, items[], metadata }`.

**`StoryCardTheme`** — Color definitions for each theme: `{ id, cardBg, cardText, mutedText, accent, border, shadow, backdropBlur? }`.

---

## 3. Configuration (Zod Schema)

`src/config.ts` defines a Zod schema that validates environment variables. Relevant reel config:

| Env Var | Default | Description |
|---------|---------|-------------|
| `KOKORO_MODEL_ID` | `onnx-community/Kokoro-82M-v1.0-ONNX` | Hugging Face model id for the local Kokoro TTS weights |
| `KOKORO_DTYPE` | `q8` | ONNX quantization (`fp32`/`fp16`/`q8`/`q4`/`q4f16`) |
| `KOKORO_DEFAULT_VOICE` | `af_heart` | Default Kokoro voice |
| `KOKORO_SPEED` | `1.0` | Speaking speed multiplier (0.5–2.0) |
| `OUTPUT_WIDTH` | `1080` | Vertical video width |
| `OUTPUT_HEIGHT` | `1920` | Vertical video height |
| `WHISPER_MODEL` | `medium` | Local Whisper model size |

The config object uses path aliases for runtime data:
- `paths.data` → `./data`
- `paths.output` → `./output`

---

## 4. Standard Reel Pipeline

`ReelOrchestrator.runJob(jobId)` — the main execution path.

### Step Sequence

1. **Select Asset** — Call `selectSourceAsset(source)` which calls `downloadSourceVideo()` for the URL source. The URL may be remote (downloaded via yt-dlp and cached under `data/reels/source-cache/`) or a previously-cached local file path (used directly). Returns a `DownloadedSourceClip` containing `{ path, originalUrl, platform, durationSec, width, height }`.
2. **Text-to-Speech** — `generateSpeechKokoro()` synthesizes narration locally with the Kokoro-82M ONNX model. Returns `ReelTTSOutput`.
3. **Generate Subtitles** — `generateSubtitles()` runs local Whisper CLI (or fast-mode approximation). Returns `ReelSubtitleOutput`.
4. **Render Video** — Based on `captionStyle`:
   - `standard` → `composeVideo()` (FFmpeg: scale+crop background, burn ASS subtitles, mux TTS audio, audio fades, loudnorm)
   - `karaoke` → `renderWithKaraoke()` (FFmpeg: scale+crop background, burn ASS with `\k` timing codes, mux TTS audio)

### Step 4: `composeVideo()` — FFmpeg Filter Graph

This is the video composition function in `src/reel/compositor.ts`. Here's the exact FFmpeg pipeline:

```
Input 0 (video):  [raw game clip]
Input 1 (audio): [TTS narration.wav]

For each input stream:
  stream_loop = ceil(audioDuration / videoDuration) - 1

Video filter chain:
  scale=1080:1920:force_original_aspect_ratio=increase
  → crop=1080:1920
  → ass=subtitles.ass
  → fade=t=in:st=0:d=<fadeDuration>
  → fade=t=out:st=<audioDuration-fadeDuration>:d=<fadeDuration>

Audio filter chain:
  afade=t=in:st=0:d=<fadeDuration/2>
  → afade=t=out:st=<audioDuration - fadeDuration/2>:d=<fadeDuration/2>
  → loudnorm=I=-16:LRA=11:TP=-1.5

Map:
  -map 0:v (video from first input)
  -map 1:a (audio from second input)

Codec:
  -c:v libx264 -preset [quality.preset] -crf [quality.crf]
  -c:a aac -b:a [quality.audioBitrate]
  -t [audioDuration] -shortest -movflags +faststart
```

### Quality Presets

```typescript
QUALITY_PRESETS = {
  draft:     { crf: 28, preset: "ultrafast", audioBitrate: "128k", resolution: { w: 720, h: 1280 } },
  standard:  { crf: 23, preset: "fast",      audioBitrate: "192k", resolution: { w: 1080, h: 1920 } },
  high:      { crf: 18, preset: "medium",    audioBitrate: "256k", resolution: { w: 1080, h: 1920 } },
}
```

### SRT → ASS Conversion

SRT files cannot be burned directly because libass interprets font sizes relative to a default 288px script height, causing 48pt text to balloon to ~320px on a 1080×1920 frame. The solution in `srtToAssFile()`:

1. Parse SRT → `ParsedSrtCue[]` — regex-based extraction of `startMs`, `endMs`, `text` from the SRT block format.
2. Generate an ASS file with `PlayResX` and `PlayResY` set to the actual output dimensions (1080×1920). This makes font sizes work in real pixels.
3. Font size computed as `max(28, height * 0.036)` (~69px at 1920).
4. Outline: `max(2, height * 0.0025)` — 4.8px stroke for legibility.
5. Shadow: `max(1, height * 0.0012)` — 2.3px drop shadow.
6. Margin V: `height * 0.12` (230px) — keeps text off edges.
7. Alignment mapped from position: bottom → 2, top → 8, middle → 5.

The ASS `[Events]` section contains `Dialogue:` lines with `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`.

### Step 4: `renderWithKaraoke()` — Karaoke ASS Generation

`generateKaraokeASS()` produces ASS subtitles with Karaoke timing:

```ass
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.20,0:00:03.50,Default,,0,0,0,,{\k12}This {\k8}is {\k15}a {\k10}sentence
```

Each word gets a `\k` tag with centiseconds duration. The word duration is computed as `(segmentEndMs - segmentStartMs) / words.length / 10`. The ASS karaoke style uses yellow (`&H00FFFF00`) for highlighted (active) text and white (`&H00FFFFFF`) for non-active text, with `&H80000000` semi-transparent black background.

---

## 5. Story Card Pipeline (Reddit Story Cards)

`ReelOrchestrator.runStoryCardReel(jobId)` — a 10-step pipeline for generating Reddit-style story card videos.

### Complete Step Sequence

```
Step 1:  Validate Story Input   → validateStoryCardOptions()
Step 2:  Normalize Script        → normalizeStoryScript()
Step 3:  Select Asset            → selectSourceAsset() (same as standard)
Step 4:  TTS                     → generateSpeechKokoro() (same as standard)
Step 5:  Generate Subtitles      → generateSubtitles() (only if timingMode="word-aligned")
Step 6:  Chunk Story             → chunkStoryText()
Step 7:  Build Timeline          → buildCardTimeline()
Step 8:  Prepare Background      → prepareBackgroundVideo() (scale+crop+loop+dim/blur)
Step 9:  Render Card Overlay     → renderStoryCardOverlay() [Remotion]
Step 10: Composite Video         → composeStoryCardReel() [FFmpeg mux]
```

### Step 1: Input Validation

`validateStoryCardOptions()` validates script length (20–1000 words, max 5000 chars), theme ID, layout mode, and every numeric parameter:
- `wordsPerCard`: 8–50
- `maxLinesPerCard`: 1–6
- `cardWidthRatio`: 0.6–0.96
- `backgroundDim`: 0–0.6
- `backgroundBlur`: 0–30
- `transitionDurationMs`: 0–1000
- Custom asset path security: rejects absolute paths and `..` traversal

### Step 2: Script Normalization

`normalizeStoryScript()` in `src/reel/story-card/script-normalizer.ts` transforms raw text into a `NormalizedStoryScript`:

1. **Subreddit detection** — Regex `^r/\w+` at start of text.
2. **Username detection** — Regex `^u/\w+` after subreddit.
3. **Title detection** — Checks for `Title:` prefix or markdown `# Heading`.
4. **Markdown removal** — Strips `#{1,6}` headings.
5. **Smart quote normalization** — Maps 16 Unicode smart quote characters to ASCII equivalents via `SMART_QUOTE_MAP`.
6. **Blank line collapsing** — `\n{3,}` → `\n\n`.
7. **Numbered prefix removal** — Strips `1.` style prefixes at line starts and after sentence endings.
8. **Duplicate title removal** — If the first line of body matches the title (normalized), it's removed.
9. **Paragraph building** — Splits on `\n`, filters empties, joins with `\n\n`.

### Step 3: Asset Selection

Identical to standard path — see Section 6.

### Step 4: TTS

Identical to standard path — see Section 7.

### Step 5: Word-Aligned Subtitles (Conditional)

Only run when `timingMode === "word-aligned"`. Uses standard Whisper transcription to get word-level timestamps, which are then passed to the timeline builder for frame-accurate card transitions.

### Step 6: Story Chunking

`chunkStoryText()` in `src/reel/story-card/script-chunker.ts` splits the normalized body into `StoryTextChunk[]`:

**Sentence Splitting**: Regex `/[^.!?]+[.!?]+["')]*|.+$/g` splits text into sentences. If the regex fails, the whole text is treated as one sentence.

**Chunking Algorithm**:

```
for each sentence:
  tokenize sentence into words
  
  if sentence is too long (words > maxWords OR chars > maxCharsPerLine * maxLines):
    flush current chunk
    splitLongSentence(sentence, maxWords, maxCharsPerLine, maxLines)
    → splits at word boundaries respecting maxWords AND maxCharsPerLine * maxLines
  
  else if adding sentence to current chunk would exceed maxWords OR maxLines:
    flush current chunk
    start new chunk with this sentence
  
  else:
    append sentence to current chunk
```

**`splitLongSentence()`** — Handles sentences that exceed maxWords/maxChars by splitting at word boundaries. If a single word is too long, it becomes its own chunk.

**Rebalancing**: After initial chunking, `rebalanceChunks()` merges the last chunk with the previous one if the last chunk has fewer than `maxWords/3` words and the merged result fits within `maxWords`.

**Title Card Injection**: If a title exists, it becomes chunk 0 with `isTitleCard: true`, and all body chunks are re-indexed starting from index 1.

### Step 7: Timeline Building

`buildCardTimeline()` in `src/reel/story-card/timing.ts` creates the `StoryCardTimeline` — a sequence of `StoryCardTimelineItem[]` with millisecond-precise timing.

**Estimated Timing Mode** (`buildEstimatedTimeline`):

1. Compute `wordsDuration = audioDurationMs / totalWords` — average time per word.
2. For each chunk, raw duration = `chunk.wordCount * wordsDuration`.
3. Reserve `introCardMs` (default 600ms) at start and `outroCardMs` (default 500ms) at end.
4. `smoothDurations()` scales raw durations to fit available time, then clamps each between `MIN_CARD_DURATION_MS` (1200ms) and `MAX_CARD_DURATION_MS` (5500ms):
   - If total clamped < available: distributes remaining proportionally to cards under max.
   - If total clamped > available: subtracts proportionally from cards over min.
5. Items are positioned sequentially: `startMs = introMs + sum(previous durations)`.
6. Last item is adjusted to end exactly at `audioDurationMs - outroMs`.

**Word-Aligned Timing Mode** (`buildWordAlignedTimeline`):

1. Uses word timestamps from Whisper (passed as `wordTimestamps: Array<{ start: number; end: number }>`).
2. For each chunk, start time = `wordTimestamps[chunk.wordStartIndex].start * 1000 + introMs`.
3. End time = `wordTimestamps[chunk.wordEndIndex].end * 1000 + introMs`.
4. Ensures minimum duration of `MIN_CARD_DURATION_MS`.
5. Clamps to audio duration boundaries.
6. Post-process: prevents overlapping items by adjusting start times forward.

Each `StoryCardTimelineItem` carries its visual configuration: `themeId`, `layoutMode`, `transition`, `position` — all from the user's `StoryCardOptions`.

### Step 8: Background Video Preparation

`prepareBackgroundVideo()` in the orchestrator:

1. `ffprobe` the source clip to get its duration.
2. If video duration ≥ requested duration: trim with `-t`.
3. If video duration < requested duration: loop with `-stream_loop N`.
4. Apply video filter: `scale=W:H:force_original_aspect_ratio=increase,crop=W:H`.
5. Optionally apply brightness dim: `,eq=brightness=-dim/100` (if `backgroundDim > 0`).
6. Optionally apply box blur: `,boxblur=blur:1` (if `backgroundBlur > 0`, clamped to 30).
7. Output: `-c:v libx264 -preset ultrafast -an -pix_fmt yuv420p`.

This produces a background video that exactly matches the TTS audio duration with proper scaling and optional darkening/blur.

### Step 9: Remotion Card Overlay Rendering

`renderStoryCardOverlay()` in `src/reel/story-card/renderer-remotion.ts`:

1. **Bundle Remotion**: `@remotion/bundler.bundle()` compiles the Remotion entry point (`src/remotion/index.tsx`) into a Webpack bundle. The bundle is cached globally (`bundlePromise`) across calls.
2. **Select Composition**: `selectComposition()` finds the `StoryCardOverlay` composition registered in `RemotionRoot`.
3. **Render Media**: `renderMedia()` renders the overlay video with:
   - Codec: `h264`
   - Image format: `png`
   - Pixel format: `yuv420p`
   - Input props: `{ timeline, width, height, fps, backgroundVideoUrl }`
4. **Concurrency**: A global `Semaphore(1)` serializes all Remotion renders (one at a time) to prevent resource exhaustion.

Output: `story-card-overlay-{jobId}.mp4` — a video with a transparent background (alpha channel) showing only the animated cards, which will be composited over the background in step 10.

**Render Progress**: Every 10% progress is logged.

### Step 10: Final Composite

`composeStoryCardReel()` in `src/reel/story-card/compositor.ts` — a simple FFmpeg mux:

```
ffmpeg -y -i overlay.mp4 -i tts_audio.wav
  -t <durationSec>
  -map 0:v -map 1:a
  -c:v copy              (no re-encode — overlay already has final frames)
  -c:a aac -b:a <audioBitrate> -ar 48000
  -af afade=t=in:st=0:d=0.5,afade=t=out:st=<end-0.5>:d=0.5,loudnorm=I=-16:LRA=11:TP=-1.5
  -shortest -movflags +faststart
  output.mp4
```

Quality presets: `draft` → crf 24/veryfast/160k, `standard` → crf 19/medium/192k, `high` → crf 17/slow/256k.

---

## 6. Asset Selection System

`src/reel/source-url.ts` — URL-based background video acquisition. No
footage is bundled with the project; the background is always supplied as a
URL (downloaded via yt-dlp) or as a previously-cached local file path.

### Local File Path Shortcut

`downloadSourceVideo()` first resolves `source.url` against the filesystem.
If the path exists on disk, it is used directly (this is how the "Previous
Assets" mode reuses cached clips). Duration is probed with `ffprobe`; width
and height default to 1080×1920.

### URL Download & Cache

Cache directory: `data/reels/source-cache/` (gitignored).

1. Cache key = `Buffer.from(source.url).toString("base64").slice(0, 32)` with
   `/`, `+`, `=` replaced by `_` → cache file `${urlHash}.mp4`.
2. If the cached file exists, it is reused and probed for duration.
3. Otherwise `yt-dlp` downloads the best ≤1080p stream + audio, merged to MP4,
   written to the cache path (300s timeout).
4. The downloaded file is probed for duration and returned.

`listCachedSourceAssets(config)` enumerates the `.mp4` files in the cache
directory (probing each for duration) and exposes them to the dashboard's
"Previous Assets" picker.

**URL Platform Detection**:
`detectPlatformFromUrl()` uses keyword matching (case-insensitive):
- YouTube: `youtube.com`, `youtu.be`, `m.youtube.com`

---

## 7. Text-to-Speech (Local Kokoro-82M)

`src/reel/tts-kokoro.ts` — local, open-weight TTS via the `kokoro-js`
(ONNX) library. Runs fully offline on CPU; no API key or network call is
required once the model weights are cached.

### Generation Flow

1. **Model load (cached)**: `KokoroTTS.from_pretrained(modelId, { dtype, device: "cpu" })`.
   The instance is memoized per `modelId:dtype` for the lifetime of the
   process so the model is loaded only once.
2. **Streaming synthesis**: a `TextSplitterStream` feeds the script to
   `tts.stream(splitter, { voice, speed })`, which yields one `RawAudio`
   chunk per sentence — keeping each utterance within Kokoro's token limit.
3. **Sample assembly**: each chunk's `Float32Array` samples are concatenated
   (`concatFloat32`) into one contiguous buffer.
4. **WAV encoding**: `encodeWavPcm16` serializes the samples into a 16-bit
   PCM WAV at Kokoro's 24 kHz sampling rate.
5. **File write**: writes to `data/reels/audio/narration_kokoro_{timestamp}.wav`.
6. **Duration**: computed directly from sample count / sampling rate (no
   `ffprobe` round-trip).

### TTS Constants (src/reel/constants.ts)

```typescript
KOKORO_DEFAULT_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
KOKORO_DEFAULT_VOICE = "af_heart";
KOKORO_TTS_VOICES = [
  { value: "af_heart", label: "Heart (US Female · warm)" },
  { value: "am_michael", label: "Michael (US Male · steady)" },
  { value: "bf_emma", label: "Emma (UK Female · calm)" },
  // …see source for the full list
];
```

### Tone → Speed Mapping

Kokoro has no free-text style prompt, so narration tone is expressed through
the speaking-speed multiplier in `ttsSpeedForTone()`: `dramatic` → ≤0.95,
otherwise the configured `KOKORO_SPEED` base.

---

## 8. Subtitle Generation (Whisper)

`src/reel/subtitle.ts` — two modes.

### Fast Mode (Approximate Segments)

When `config.fastMode === true` (default), no Whisper transcription is run. Instead:

```typescript
generateApproximateSegments(text, totalDurationMs):
  words = text.split(/\s+/)
  avgWordDuration = totalDurationMs / words.length
  segments = []
  for each group of 3-7 words:
    startMs = wordIndex * avgWordDuration
    endMs = (wordIndex + wordCount) * avgWordDuration
```

### Quality Mode (Local Whisper CLI)

`transcribeWithWhisper()`:

1. **Audio conversion**: FFmpeg converts the narration audio → 16kHz mono WAV (`-ar 16000 -ac 1 -f wav`).
2. **Whisper invocation**: Spawns `whisper-cli` via `node:child_process.spawn` (not Bun.spawn — for Next.js compatibility):
   ```
   whisper-cli -m <modelPath> [-ng] -f <wavPath> -l en -oj --output-json-full -of <jsonBase> -np
   ```
   - `-ng` flag added on macOS (no GPU acceleration flag for whisper.cpp).
   - `-oj` = output JSON.
   - `--output-json-full` = full JSON with token-level timestamps.
   - `-np` = no progress bars.
3. **JSON parsing**: Reads the output JSON, extracts token-level `text`, `offsets.from`, `offsets.to` (in milliseconds).
4. **Segment normalization** (`normalizeReelSubtitleSegments()`):
   - If timestamps seem offset (start > 1s and end > audioDuration + 10%), subtracts the offset.
   - Corrects negative timestamps by shifting forward.
   - Clamps each segment to `[0, audioDurationMs]`.
   - Enforces minimum segment duration of 50ms.
   - Ensures monotonically increasing start times (fixes overlaps).
5. **Fallback**: If Whisper produces < 2 segments, falls back to approximate mode.

### SRT Formatting

`segmentsToSRT()` formats segments as:
```
1
00:00:01,200 --> 00:00:03,500
This is the first caption

2
00:00:03,600 --> 00:00:05,800
This is the second caption
```

Time format: `HH:MM:SS,mmm` using `pad()` with zero-padding.

---

## 9. Video Composition (FFmpeg)

`src/reel/compositor.ts` — the video rendering workhorse.

### `composeVideo()` — Standard Caption Rendering

The FFmpeg command built:

```bash
ffmpeg -y \
  -stream_loop <loopCount> -i <videoPath> \
  -i <audioPath> \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,ass=<assPath>,fade=t=in:st=0:d=<fade>,fade=t=out:st=<end>:d=<fade>" \
  -map 0:v -map 1:a \
  -af "afade=t=in:st=0:d=<fade/2>,afade=t=out:st=<end-fade/2>:d=<fade/2>,loudnorm=I=-16:LRA=11:TP=-1.5" \
  -c:v libx264 -preset <preset> -crf <crf> \
  -c:a aac -b:a <bitrate> \
  -t <audioDuration> -shortest -movflags +faststart \
  output.mp4
```

Key details:
- **Looping**: `loopCount = ceil(audioDuration / videoDuration) - 1`. If `loopCount` negative, the video is trimmed.
- **Fade**: `fadeDuration = min(1, audioDuration / 4)` — subtle in/out fades.
- **Audio normalization**: `loudnorm=I=-16:LRA=11:TP=-1.5` (EBU R128 standard: -16 LUFS integrated, 11 LU loudness range, -1.5 dBTP true peak).
- `-movflags +faststart` enables streaming (moov atom at beginning).

### `renderWithKaraoke()` — Karaoke Caption Rendering

Simpler FFmpeg command — just burns the karaoke ASS and muxes audio:

```bash
ffmpeg -y \
  -i <videoPath> -i <audioPath> \
  -map 0:v -map 1:a \
  -vf "ass=<karaokeAssPath>" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 192k \
  -shortest -movflags +faststart \
  output.mp4
```

No scaling/cropping here — the karaoke path expects the background video to be pre-scaled by the orchestrator's `prepareBackgroundVideo()`.

---

## 10. Remotion Rendering Engine

### Entry Point (`src/remotion/index.tsx`)

```typescript
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```

### Root Compositions (`src/remotion/Root.tsx`)

Registers two compositions:
- **`CaptionOverlay`**: Used by the clip pipeline for animated captions (not the reel pipeline).
- **`StoryCardOverlay`**: Used by the reel pipeline for story card rendering.

Both use `calculateMetadata` to dynamically set `durationInFrames` from input props at render time.

### StoryCardOverlay Component (`src/remotion/story-card/StoryCardOverlay.tsx`)

This is the Remotion composition that renders the animated card overlays.

**Frame to Time**: `currentMs = (frame / fps) * 1000`

**Active Item Lookup**:
```typescript
function getActiveItem(items, currentMs): item | undefined
// Returns the first item where startMs <= currentMs < endMs
```

**Transition State Machine** (`getTransitionState`):

The component computes `opacity`, `scale`, and `translateY` for smooth card transitions:

| Phase | Condition | Opacity | Scale | TranslateY |
|-------|-----------|---------|-------|------------|
| Before entry | `currentMs < startMs` | 0 | 0.96 | 12px |
| Fade in | `startMs → startMs + 180ms` | 0→1 (ease out) | 0.96→1 (ease out) | 12px→0 (ease out) |
| Hold | middle of duration | 1 | 1 | 0 |
| Fade out | `endMs - 150ms → endMs` | 1→0 (ease in) | 1→0.985 (ease in) | 0→-6px (ease in) |

Transition easing uses `Easing.out(Easing.ease)` for entrance and `Easing.in(Easing.ease)` for exit.

**Render Tree**:
```
<div style={{ position: "absolute" }}>
  <!-- Background video layer -->
  {backgroundVideoUrl && (
    <div style={{ position: "absolute", zIndex: 0 }}>
      <OffthreadVideo src={backgroundVideoUrl} muted volume={0} />
    </div>
  )}
  
  <!-- Card overlay layer -->
  {activeItem && (
    <div style={{
      zIndex: 1,
      opacity: transitionState.opacity,
      transform: `scale(${ts.scale}) translateY(${ts.translateY}px)`,
    }}>
      <RedditStoryCard ... />
    </div>
  )}
</div>
```

`OffthreadVideo` is used for the background — it renders the video in a separate thread (not on the main compositing thread), preventing decode bottlenecks.

### RedditStoryCard Component (`src/remotion/story-card/RedditStoryCard.tsx`)

A 334-line component that renders a photorealistic Reddit post card. Layout:

```
┌───────────────────────────────────────────┐
│  [Avatar] r/AskReddit ✓                   │
│           u/storyteller · 2h ago          │
│                                           │
│  🥇🥈🥉💎🔥👍                             │
│                                           │
│  The story text goes here in              │
│  bold font with line clamping up          │
│  to maxLinesPerCard lines...              │
│                                           │
│  ───────────────────────────────────────── │
│  ▲ 12.8k          💬 1.1k                 │
└───────────────────────────────────────────┘
```

**Positioning**: Centered vertically and horizontally within the frame. Card width = `width * cardWidthRatio` (default 0.9 = 972px), capped at 960px max.

**Typography**:
- Body: fontSize 32 (or 40 if title card), fontWeight 700 (800 for title), lineHeight 1.22.
- Subreddit name: 22px, bold, with verified badge SVG.
- Username + timestamp: 16px, muted color.
- Metadata (upvotes/comments): `metadataFontSize` (default 22).

**Theme Engine**: 6 themes defined inline in `THEME_MAP` with cardBg, cardText, mutedText, accent, border, shadow colors. Each theme is a self-contained color ramp.

**SVG Elements** (all inline, no external assets):
- **VerifiedBadge**: Blue circle with checkmark (18×18).
- **UpvoteIcon**: Orange upward-pointing triangle (20×20).
- **CommentIcon**: Orange speech bubble (20×20).
- **AvatarIcon**: Custom snoo-like avatar — white circle with accent-colored eyes, smile, antenna ears.

---

## 11. Error Handling & Retry System

### ReelError Class (`src/reel/errors.ts`)

```typescript
class ReelError extends Error {
  code: string;       // See REEL_ERROR_CODES below
  step?: string;      // Which pipeline step failed
  retryable: boolean; // Can the operation be retried?
}
```

### Error Codes

```
REEL_ASSET_NOT_FOUND    → No game clips available
REEL_TTS_FAILED         → Local Kokoro TTS error
REEL_SUBTITLE_FAILED    → Whisper/subtitle generation error
REEL_RENDER_FAILED      → FFmpeg/Remotion compositing error
REEL_VALIDATION_FAILED  → Input validation failure
REEL_JOB_NOT_FOUND      → Non-existent job ID
REEL_JOB_RUNNING        → Conflict on running job
REEL_TIMEOUT            → Pipeline timeout
REEL_URL_DOWNLOAD_FAILED→ URL download failure
REEL_INVALID_URL        → Unsupported URL format
```

### Retry System (`src/reel/retry.ts`)

`withRetry(fn, options?)` implements exponential backoff:

```typescript
RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}
// Delay = min(1000 * 2^attempt, 30000)
```

### Error Propagation

In `runJob()` and `runStoryCardReel()`, each step is wrapped in the `measure()` helper which catches errors and returns a `ReelStepResult` with `status: "failed"` and the error message. After `measure()`, if the step failed, the orchestrator throws immediately:

```typescript
if (assetStep.status === "failed") {
  throw new Error(assetStep.error ?? "Asset selection failed");
}
```

The outer try/catch in both `runJob()` and `runStoryCardReel()`:
1. Sets `job.status = "failed"` and `job.error = message`.
2. Records all step results (including partial successes).
3. Re-throws the error.

---

## 12. Queue & Concurrency

### ReelQueue (`src/reel/queue.ts`)

A priority queue for reel jobs:

- `maxConcurrent` (default: 1) — limits parallel execution.
- `enqueue(id, script, priority)` → adds entry, sorts by priority descending.
- `dequeue()` → finds first `"queued"` entry, marks `"running"`, increments counter.
- `complete(id)` / `fail(id)` → marks entry, decrements counter.
- Queue entries sorted by priority (higher first).

### In-Memory Job Store

The `ReelOrchestrator` maintains `jobs: Map<string, ReelJob>`. Jobs are not persisted in memory across server restarts — they fall back to history on request.

### Remotion Render Serialization

A global `Semaphore(1)` in `renderer-remotion.ts` ensures only one Remotion render runs at a time. This is critical because:
- Remotion bundles the entire project (CPU/memory intensive).
- Multiple simultaneous renders would cause resource contention.
- The semaphore uses a promise-based queue: if the lock is held, callers wait in line.

### Global Service Singleton

`getReelService()` in `src/server/reel-service.ts`:
```typescript
declare global {
  var clipFarmReelService: ReelService | undefined;
  var clipFarmReelServiceVersion: number | undefined;
}
```
Uses a global singleton pattern (lives on `globalThis`) with a version counter (`serviceVersion = 3`). If the module is hot-reloaded, a new service is created.

---

## 13. Job History & Persistence

### File-Based History (`src/reel/history.ts`)

History stored at `data/reel-history.json` as an array of `ReelHistoryEntry` objects.

**Key functions**:
- `saveReelToHistory(job)` → prepends entry to history array, writes file. Called in the background (`void saveReelToHistory(...)`).
- `loadReelHistory()` → reads and parses `reel-history.json`, handles missing/malformed files gracefully.
- `getHistoryEntryById(id)` → linear search through history array.
- `removeFromHistory(jobId)` → filters out entry, rewrites file.
- `clearReelHistory()` → writes `"[]"`.

**History Entry**: Truncates script to 200 chars. Stores all relevant job fields plus `renderTimeMs` (sum of step durations) and `assetUsed` (boolean "used" string for now).

**Fallback Pattern**: API routes for `GET /api/reels/[jobId]` and video serving first check the in-memory orchestrator, then fall back to `history.json`. This prevents losing access to completed jobs after server restart.

---

## 14. Web UI (Next.js) & SSE

### Hook: `useReelExtractor` (`src/hooks/use-reel-extractor.ts`)

State machine:

```
IDLE → SUBMITTING → STREAMING → { COMPLETED | FAILED }
```

**Flow**:
1. `submitScript(text, options)` → POST `/api/reels` → receives `{ job }` with status "queued".
2. Sets `jobId`, opens `EventSource` to `/api/reels/{jobId}/stream`.
3. SSE events of type `reel-job` carry the updated `ReelJob` with current `steps[]` and `status`.
4. `Effect` cleanup closes EventSource on unmount or jobId change.

**Step Mapping**: `mapJobToSteps()` dynamically builds the step list based on `renderStyle`. For story cards, 9 steps; for standard, 4 steps. Labels mapped from `STEP_LABELS`.

**Status Derivation**:
- `isProcessing = jobId !== null && job.status !== "completed" && job.status !== "failed"`
- `isDone = jobId !== null && (job.status === "completed" || job.status === "failed")`

### UI Component: `ReelShell` (`src/components/dashboard/reel-shell.tsx`)

980 lines of React — the complete reel generation interface.

**State** (useState hooks):
- Script text, source type (url/previous-assets), source URL, selected cached asset
- Voice, tone
- Story card options: title, subreddit, username, theme, wordsPerCard, backgroundDim, transition
- UI state: reel history, cached assets, deletingId

**Preset System**: 6 presets from `REEL_PRESETS` that configure all options at once:
- Short Story, Motivational, Educational, Action Packed, Reddit Story Short, Dark Story Cards

**Sub rendering patterns**:
- `ReelStepIndicator` — Icon per step: Check (completed), Spinner (in_progress), X (failed), Circle (pending).
- `ReelProgressBar` — Animated progress bar (emerald when 100%, amber otherwise).

### SSE Stream Implementation (`src/server/snapshot-stream.ts`)

Referenced but source not read — it likely creates a `ReadableStream` that polls the job state at intervals and pushes events. The `reel-job` event name is used for all reel SSE updates. Client side uses `source.addEventListener("reel-job", handler)`.

### Video Streaming (`/api/reels/[jobId]/video`)

Implements HTTP range requests for video seeking:
- Reads `Range` header.
- Creates `ReadableStream` from `fs.createReadStream()` with start/end byte offsets.
- Returns `206 Partial Content` with `Content-Range` header.
- Full request returns `200 OK` with complete file.

---

## 15. API Routes

### Route Tree

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/reels` | List all in-memory jobs |
| POST | `/api/reels` | Create and start a new reel job |
| GET | `/api/reels/[jobId]` | Get job status (with history fallback) |
| GET | `/api/reels/[jobId]/stream` | SSE stream for live updates |
| GET | `/api/reels/[jobId]/video` | Stream/download video (range requests) |
| DELETE | `/api/reels/[jobId]/delete` | Delete job and artifacts |
| GET | `/api/reels/history` | List all history entries |
| GET | `/api/reels/assets` | List cached URL source assets |
| GET | `/api/reels/status` | Check if TTS is configured |

### POST Body Schema

`sourceUrl` is **required** (the pipeline no longer ships bundled footage):

`{ text, sourceUrl, voiceId?, tone?, quality?, ttsProvider?, ttsModel?, storyCard? }`

→ Validates the URL against `isValidVideoUrl()` (or accepts an existing local file path) and detects the platform.

**Validation**: Zod schemas enforce:
- Text: 1–1000 words, non-empty
- `sourceUrl`: required, non-empty
- `storyCard`: optional nested schema with range constraints

### Error Responses

All error responses use `ApiErrorResponse` type: `{ error: string }`. Status codes: 400 (validation), 404 (not found), 409 (conflict — running job deletion), 500 (internal).

---

## 16. Cleanup & Resource Management

### Temp File Cleanup (`src/reel/cleanup.ts`)

Two cleanup functions:

**`cleanupReelTempFiles(dataDir)`**:
- `data/reels/temp/` — Removes files older than 1 hour.
- `data/reels/url-sources/` — Removes downloaded source videos older than 2 hours.
- Returns count of removed files.

**`cleanupReelOutputFiles(outputDir, maxAgeMs)`**:
- `output/reels/` — Removes files older than `maxAgeMs` (default 24 hours).
- Returns count of removed files.

### Artifact Deletion

The `DELETE /api/reels/[jobId]/delete` handler:
1. Deletes video file from disk (`unlinkSync`).
2. Deletes audio file from disk.
3. Deletes subtitle file from disk.
4. Removes job from in-memory store.
5. Removes entry from history file.

### Intermediate File Cleanup

- `composeVideo()` cleans up sanitized SRT and ASS files after successful render:
  ```typescript
  await unlink(sanitizedSrt).catch(() => {});
  await unlink(assPath).catch(() => {});
  ```
- `renderWithKaraoke()` cleans up the karaoke ASS file:
  ```typescript
  await unlink(assPath).catch(() => {});
  ```
- All cleanup uses `.catch(() => {})` — failures are non-fatal.

### URL Source Cache

The source cache manifest (`data/reels/url-sources/manifest.json`) is pruned when files are missing from disk. This prevents stale manifest entries from accumulating.

---

## Constants Reference

### Story Card Constants (`src/reel/story-card/constants.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_WORDS_PER_CARD` | 8 | Minimum words per card chunk |
| `MAX_WORDS_PER_CARD` | 50 | Maximum words per card chunk |
| `MIN_LINES_PER_CARD` | 1 | Minimum display lines |
| `MAX_LINES_PER_CARD` | 6 | Maximum display lines |
| `MIN_CARD_WIDTH_RATIO` | 0.6 | Minimum card width relative to frame |
| `MAX_CARD_WIDTH_RATIO` | 0.96 | Maximum card width relative to frame |
| `MIN_BACKGROUND_DIM` | 0 | No dimming |
| `MAX_BACKGROUND_DIM` | 0.6 | 60% brightness reduction |
| `MIN_BACKGROUND_BLUR` | 0 | No blur |
| `MAX_BACKGROUND_BLUR` | 30 | Maximum box blur radius |
| `MIN_TRANSITION_DURATION_MS` | 0 | Instant transition |
| `MAX_TRANSITION_DURATION_MS` | 1000 | 1-second transition |
| `MIN_CARD_DURATION_MS` | 1200 | Minimum card display time |
| `MAX_CARD_DURATION_MS` | 5500 | Maximum card display time |
| `MIN_SCRIPT_WORDS` | 20 | Minimum words for story card mode |
| `MAX_SCRIPT_WORDS` | 1000 | Maximum words for story card mode |
| `MAX_SCRIPT_CHARS` | 5000 | Maximum characters for story card mode |

### Reel Pipeline Constants (`src/reel/constants.ts`)

```typescript
REEL_PIPELINE_STEPS = ["Select Asset", "Text-to-Speech", "Generate Subtitles", "Render Video"]
REEL_API = {
  MAX_SCRIPT_LENGTH: 5000,
  MAX_SCRIPT_WORDS: 1000,
  MIN_SCRIPT_WORDS: 5,
}
REEL_VIDEO_DEFAULTS = {
  width: 1080, height: 1920, fps: 30, subtitleFontSize: 48,
}
```

### Theme Colors

Six theme definitions, each with 6 color properties:

| Theme | bg | text | muted | accent | border | shadow |
|-------|----|------|-------|--------|--------|--------|
| reddit-light | `#FFFFFF` | `#1C1C1C` | `#787C7E` | `#FF4500` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.26)` |
| reddit-dark | `#1A1A1B` | `#F2F2F2` | `#A8A8A8` | `#FF4500` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.35)` |
| reddit-orange | `#FF4500` | `#FFFFFF` | `#FFD8CC` | `#FFFFFF` | `rgba(255,255,255,0.20)` | `rgba(0,0,0,0.30)` |
| minimal-white | `#FFFFFF` | `#111111` | `#888888` | `#111111` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.15)` |
| glass-dark | `rgba(18,18,18,0.72)` | `#FFFFFF` | `#BDBDBD` | `#FF4500` | `rgba(255,255,255,0.16)` | `rgba(0,0,0,0.40)` |
| custom | same as reddit-light | — | — | — | — | — |

Glass-dark uses `backdropBlur: 18` for a frosted glass effect.

---

## File Inventory

### Reel Pipeline Core (17 files, 1174 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `src/reel/types.ts` | 117 | All type definitions |
| `src/reel/orchestrator.ts` | 740 | Main orchestrator (story card pipeline) |
| `src/reel/source-url.ts` | 134 | URL source download + cache, platform detection |
| `src/reel/tts-kokoro.ts` | 125 | Local Kokoro-82M TTS (ONNX) |
| `src/reel/wav.ts` | 75 | 16-bit PCM WAV encoder for Kokoro output |
| `src/reel/subtitle.ts` | 288 | Whisper transcription and subtitle generation |
| `src/reel/compositor.ts` | 374 | FFmpeg video composition |
| `src/reel/constants.ts` | 63 | Reel constants |
| `src/reel/presets.ts` | 118 | 7 reel presets |
| `src/reel/validation.ts` | 56 | Script validation |
| `src/reel/history.ts` | 162 | History persistence |
| `src/reel/metrics.ts` | 47 | Performance metrics |
| `src/reel/queue.ts` | 79 | Job queue |
| `src/reel/retry.ts` | 52 | Exponential backoff retry |
| `src/reel/cleanup.ts` | 87 | Temp file cleanup |
| `src/reel/index.ts` | 87 | Barrel exports |
| `src/reel/errors.ts` | 36 | Error types |
| `src/reel/source-url.ts` | 310 | URL download and caching |

### Story Card Submodule (10 files, 443 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `src/reel/story-card/types.ts` | 176 | Story card type definitions |
| `src/reel/story-card/constants.ts` | 180 | Theme colors, quality presets, validation bounds |
| `src/reel/story-card/validation.ts` | 184 | Input validation |
| `src/reel/story-card/script-normalizer.ts` | 195 | Text normalization pipeline |
| `src/reel/story-card/script-chunker.ts` | 254 | Sentence splitting and card chunking |
| `src/reel/story-card/timing.ts` | 274 | Timeline building (estimated + word-aligned) |
| `src/reel/story-card/card-timeline.ts` | 48 | Timeline save/query utilities |
| `src/reel/story-card/renderer-remotion.ts` | 133 | Remotion render orchestration |
| `src/reel/story-card/compositor.ts` | 122 | Final FFmpeg composite |
| `src/reel/story-card/index.ts` | 63 | Barrel exports |

### Remotion Components (5 files + 3 story-card files)

| File | Lines | Purpose |
|------|-------|---------|
| `src/remotion/index.tsx` | 5 | Root registration |
| `src/remotion/Root.tsx` | 82 | Composition registration |
| `src/remotion/story-card/StoryCardOverlay.tsx` | 162 | Frame-by-frame card rendering with transitions |
| `src/remotion/story-card/RedditStoryCard.tsx` | 334 | Full Reddit post card UI |
| `src/remotion/story-card/types.ts` | 33 | Remotion-specific type definitions |

### API Routes (6 route files)

| File | Purpose |
|------|---------|
| `src/app/api/reels/route.ts` | POST (create) + GET (list) |
| `src/app/api/reels/[jobId]/route.ts` | GET single job |
| `src/app/api/reels/[jobId]/stream/route.ts` | SSE stream |
| `src/app/api/reels/[jobId]/video/route.ts` | Video serving with range support |
| `src/app/api/reels/[jobId]/delete/route.ts` | DELETE with artifact cleanup |
| `src/app/api/reels/history/route.ts` | History listing |
| `src/app/api/reels/assets/route.ts` | Cached assets listing |
| `src/app/api/reels/status/route.ts` | Health/status check |

### Dependencies

- **`kokoro-js`** — local Kokoro-82M TTS (ONNX runtime, CPU; streaming sentence synthesis)
- **`@remotion/bundler`** — Webpack bundle of Remotion components
- **`@remotion/renderer`** — Server-side rendering of Remotion compositions
- **`ffmpeg`/`ffprobe`** — All video/audio processing (subprocess)
- **`whisper-cli`** — Local speech-to-text (subprocess, whisper.cpp binary)
- **`lucide-react`** — UI icons (Gamepad2, Globe, etc.)

---

*This document covers clip-farm reel pipeline v3 as of the current codebase. Every module, type, algorithm, FFmpeg filter graph, Remotion composition, SSE streaming detail, and state transition is documented above.*
