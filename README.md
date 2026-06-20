# RedditReel

Turn a script into a short-form Reddit story card reel — narrated with local
text-to-speech, captioned, and composited over a video background you supply
via URL. Everything runs locally: no API keys, no cloud services.

TTS uses the open-weight **Kokoro-82M** model (via `kokoro-js`/ONNX),
transcription uses local **Whisper**, and compositing uses **FFmpeg** +
**Remotion**.

---

## Demo

<video src="https://github.com/atmikshetty/RedditReel/raw/main/public/demo-reel.mp4" controls width="320"></video>

> **Note:** The background gameplay footage in this demo is from
> [this YouTube video](https://youtu.be/pyV68KvUwlw). RedditReel does not own
> this footage — credit belongs to the original creator. See
> [Choosing a background video](#choosing-a-background-video) for details.

---

## Table of contents

- [Demo](#demo)
- [What it does](#what-it-does)
- [Prerequisites](#prerequisites)
  - [macOS setup](#macos-setup)
  - [Windows setup](#windows-setup)
  - [Linux setup](#linux-setup)
- [Quick start](#quick-start)
- [Commands](#commands)
- [How the pipeline works](#how-the-pipeline-works)
- [Configuration reference](#configuration-reference)
  - [Environment variables](#environment-variables)
  - [TTS voices](#tts-voices)
  - [Story card themes](#story-card-themes)
  - [Story card options](#story-card-options)
  - [Layout modes](#layout-modes)
  - [Timing modes](#timing-modes)
  - [Transitions](#transitions)
  - [Card positions](#card-positions)
  - [Quality presets](#quality-presets)
  - [Reel presets](#reel-presets)
- [Supported source URLs](#supported-source-urls)
  - [Choosing a background video](#choosing-a-background-video)
- [Output files](#output-files)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## What it does

Paste a script, pick a background video (any YouTube URL, or a
previously-downloaded clip), and generate a vertical 1080x1920 reel with:

- Kokoro-82M narration (11 voices, adjustable speed/tone)
- Reddit-style story cards synced to the narration
- Optional word-level captions from Whisper
- Game/footage background, dimmed and blurred to taste

Everything runs on your machine. The only network call is the first-time
download of the Kokoro model weights (~100 MB) and any source video you
fetch via URL.

---

## Prerequisites

### System requirements

- **CPU:** 4+ cores recommended (TTS and Remotion rendering are CPU-intensive)
- **RAM:** 4 GB minimum, 8 GB+ recommended (the Kokoro ONNX model uses ~1 GB)
- **Disk:** ~500 MB for dependencies + model weights + source cache
- **OS:** macOS, Windows, or Linux

### Required software

| Dependency | Purpose | Required? |
|------------|---------|-----------|
| [Bun](https://bun.sh) >= 1.2 | JS runtime + package manager | Yes |
| [FFmpeg](https://ffmpeg.org) (with `ffprobe`) | Video processing, compositing | Yes |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Downloading URL-based source videos | Yes (if using URLs) |
| [Whisper](https://github.com/openai/whisper) CLI | Word-aligned caption timing | Optional |

### macOS setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install system dependencies
brew install ffmpeg yt-dlp

# Optional: Whisper for word-aligned captions
pipx install openai-whisper
```

### Windows setup

> **First-time Windows users:** native Node dependencies (`onnxruntime-node`,
> `sharp`) require the
> [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe).
> Install it **before** running `bun install` — if you see DLL errors during
> install or the first TTS run, this is the fix.

```powershell
# Install Bun
powershell -c "irm bun.sh/install.ps1 | iex"

# Install system dependencies via winget
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp

# Optional: Whisper for word-aligned captions
pipx install openai-whisper
```

After installing FFmpeg via winget, ensure `ffmpeg` and `ffprobe` are on your
`PATH`. The Gyan FFmpeg package installs to
`C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\…` — winget usually
adds it automatically, but if `ffmpeg --version` fails in a new terminal,
add that path manually.

For Whisper, install [Python](https://www.python.org/) first (winget:
`winget install Python.Python.3.12`), then:

```powershell
pip install openai-whisper
```

If you prefer not to install Whisper, the pipeline falls back to estimated
timing automatically — you just lose per-word caption precision.

### Linux setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Debian/Ubuntu
sudo apt update
sudo apt install -y ffmpeg
pipx install yt-dlp openai-whisper

# Arch
sudo pacman -S ffmpeg yt-dlp
pipx install openai-whisper
```

---

## Quick start

```bash
git clone https://github.com/atmikshetty/RedditReel.git
cd RedditReel
bun install
cp .env.example .env.local    # optional — defaults work out of the box
bun run dev
```

Open <http://localhost:3000>. Write a script (min 5 words, max 1000 words),
paste a video URL, and hit **Generate**.

> **First run** downloads the Kokoro-82M ONNX weights (~100 MB) from
> the Hugging Face Hub and caches them locally. Subsequent runs are fully
> offline. If you're behind a firewall or want to pre-cache, set
> `HF_HUB_OFFLINE=1` after the first successful download.

---

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start the development server (http://localhost:3000) |
| `bun run build` | Build for production |
| `bun run start` | Start the production server |
| `bun run lint` | Run ESLint |
| `bun test` | Run the test suite |
| `bun run format` | Format code with oxfmt |
| `bun run format:check` | Check formatting without writing |

---

## How the pipeline works

When you submit a script, the orchestrator runs a 10-stage pipeline. Each
stage's progress is published in real time to the dashboard via SSE
(Server-Sent Events).

```
Script text
    |
    v
+---------------------+
| 1. Validate Input    |  Checks script length, story card options
+---------------------+
| 2. Normalize Script  |  Detects title/subreddit/username, strips markdown
+---------------------+
| 3. Select Asset      |  Downloads via yt-dlp or reuses cached file
+---------------------+
| 4. Text-to-Speech    |  Kokoro-82M generates narration WAV (local, offline)
+---------------------+
| 5. Generate Subtitles|  Whisper transcribes audio -> word timestamps
|                      |  (only if timingMode = "word-aligned")
+---------------------+
| 6. Chunk Story       |  Splits body into ~20-word display chunks
+---------------------+
| 7. Build Timeline    |  Assigns start/end times to each card
+---------------------+
| 8. Prepare BG Video  |  FFmpeg: scale, crop, loop, dim, blur background
+---------------------+
| 9. Render Overlay    |  Remotion renders transparent ProRes 4444 card overlay
+---------------------+
| 10. Composite Video  |  FFmpeg muxes background + overlay + TTS audio -> MP4
+---------------------+
    |
    v
output/reels/{jobId}.mp4
```

See [`docs/reel-pipeline-deep-dive.md`](docs/reel-pipeline-deep-dive.md) for
the full architecture.

---

## Configuration reference

All configuration is optional with sensible defaults. There are two layers:

1. **Environment variables** (`.env.local`) — global settings like TTS model,
   Whisper model, output dimensions, server access
2. **Per-request story card options** — theme, layout, timing, transitions,
   etc. (passed via the API or set in the dashboard UI)

### Environment variables

Copy `.env.example` to `.env.local` and adjust as needed. Every variable is
optional — the defaults work out of the box.

#### Text-to-Speech (Kokoro-82M)

| Variable | Default | Description |
|----------|---------|-------------|
| `KOKORO_MODEL_ID` | `onnx-community/Kokoro-82M-v1.0-ONNX` | Hugging Face Hub model id for Kokoro |
| `KOKORO_DTYPE` | `q8` | ONNX quantization: `fp32`, `fp16`, `q8`, `q4`, `q4f16` |
| `KOKORO_DEFAULT_VOICE` | `af_heart` | Default narration voice (see [TTS voices](#tts-voices)) |
| `KOKORO_SPEED` | `1.0` | Speaking speed multiplier (0.5 - 2.0) |
| `KOKORO_CONCURRENCY` | `4` | Number of sentences synthesized in parallel (1 - 16). TTS runs sentence-by-sentence; synthesizing a few in parallel overlaps phonemization with inference. Set to 1 for sequential output. |

**Quantization guide:**

| Dtype | Size | Speed | Quality | When to use |
|-------|------|-------|---------|-------------|
| `fp32` | ~320 MB | Slow | Best | Quality-critical, fast CPU |
| `fp16` | ~160 MB | Medium | Very good | Good balance on Apple Silicon |
| `q8` | ~85 MB | Fast | Good | **Default** — best speed/quality tradeoff |
| `q4` | ~45 MB | Fastest | Fair | Quick drafts, low-end hardware |
| `q4f16` | ~50 MB | Fast | Decent | Low memory + decent quality |

#### Transcription (Whisper)

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSCRIPTION_PROVIDER` | `local` | Transcription provider (only `local` supported) |
| `WHISPER_MODEL` | `medium` | Whisper model for full transcripts: `tiny`, `base`, `small`, `medium`, `large` |
| `CAPTION_WHISPER_MODEL` | `base` | Whisper model for caption word-timestamps (smaller = faster) |

**Whisper model guide:**

| Model | Size | Speed | Accuracy | When to use |
|-------|------|-------|----------|-------------|
| `tiny` | ~75 MB | Fastest | Low | Quick tests |
| `base` | ~145 MB | Fast | OK | **Default for captions** |
| `small` | ~480 MB | Medium | Good | Better caption precision |
| `medium` | ~1.5 GB | Slow | Very good | **Default for transcripts** |
| `large` | ~3 GB | Slowest | Best | Production quality |

> Whisper is only invoked when `timingMode` is set to `word-aligned`. If
> Whisper is not installed, the pipeline silently falls back to estimated
> timing.

#### Rendering

| Variable | Default | Description |
|----------|---------|-------------|
| `REMOTION_CONCURRENCY` | ~80% of CPU cores | Number of parallel Chrome workers Remotion uses to rasterize overlay frames (1 - 64). This is the main lever for render speed. Lower it if your machine runs out of memory. |
| `OUTPUT_WIDTH` | `1080` | Output video width in pixels |
| `OUTPUT_HEIGHT` | `1920` | Output video height in pixels |

#### Captions / subtitles

| Variable | Default | Description |
|----------|---------|-------------|
| `CAPTION_RENDERER` | `ffmpeg` | Renderer for burned-in captions: `ffmpeg` or `remotion` |
| `CAPTION_ANIMATE` | `true` | Animate caption word highlights (karaoke effect) |
| `CAPTION_FONT_SIZE` | `52` | Caption font size in pixels (24 - 96) |
| `CAPTION_PRIMARY_COLOR` | `#FFFFFF` | Caption text color (CSS color) |
| `CAPTION_HIGHLIGHT_COLOR` | `#FFD700` | Highlighted (active) word color |
| `CAPTION_POSITION` | `bottom` | Caption vertical placement: `bottom`, `top`, `middle` |
| `CAPTION_BACKGROUND_OPACITY` | `0.8` | Caption background opacity (0 - 1) |
| `CAPTION_UPPER_CASE` | `true` | Uppercase all caption text |
| `CAPTION_FONT_FAMILY` | `Arial, Helvetica, sans-serif` | Caption font-family stack |
| `CAPTION_SHOW_BACKGROUND` | `true` | Show a caption background box |

#### Server access

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_ALLOWED_HOSTS` | `127.0.0.1,localhost,[::1]` | Comma-separated hosts the dashboard accepts. This is the only auth layer — the app is localhost-only by default. |

#### Pipeline (clip-farm legacy, mostly unused for story card reels)

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_PARALLEL_CLIPS` | `3` | Max clips processed in parallel (1 - 10) |
| `FAST_MODE` | `true` | Skip slow paths when true |
| `REMOVE_SILENCE` | `false` | Remove silent stretches from source video |
| `MAX_CLIPS` | `0` | Max clips per run (0 = unlimited) |
| `CLIP_SPEED` | `1.2` | Speed multiplier for background footage (1.0 - 2.0) |
| `CLIP_NICHE` | `auto` | Niche/keyword hint for clip selection |
| `CLIP_MIN_DURATION` | `30` | Minimum clip duration in seconds (5 - 600) |
| `CLIP_MAX_DURATION` | `90` | Maximum clip duration in seconds (5 - 600) |
| `CLIP_TWO_PASS` | `true` | Run a second pass to refine clip scoring |
| `CLIP_MIN_SCORE` | `0` | Minimum clip relevance score (0 - 100) |
| `CLIP_DEDUPE_OVERLAP` | `0.4` | Overlap fraction for duplicate detection (0 - 1) |
| `MAX_TOP_K` | `10` | Max top-K candidate clips considered (1 - 50) |
| `PREFER_YOUTUBE_TRANSCRIPTS` | `true` | Prefer YouTube-provided transcripts |
| `SILENCE_THRESHOLD_DB` | `-35` | Threshold (dB) for silence detection |
| `SILENCE_MIN_DURATION` | `0.8` | Minimum silence duration before removal (seconds) |

### TTS voices

Kokoro-82M provides 11 curated voices. Voice ids follow Kokoro's
`<accent><gender>_<name>` convention (a = American, b = British;
f = female, m = male).

| Voice ID | Label | Gender | Accent | Character |
|----------|-------|--------|--------|-----------|
| `af_heart` | Heart | Female | US | Warm (default) |
| `af_bella` | Bella | Female | US | Expressive |
| `af_nicole` | Nicole | Female | US | Soft |
| `af_sky` | Sky | Female | US | Bright |
| `am_michael` | Michael | Male | US | Steady |
| `am_onyx` | Onyx | Male | US | Deep |
| `am_adam` | Adam | Male | US | Bold |
| `bf_emma` | Emma | Female | UK | Calm |
| `bf_isabella` | Isabella | Female | UK | Refined |
| `bm_george` | George | Male | UK | Narrator |
| `bm_lewis` | Lewis | Male | UK | Gravelly |

Set the default voice via `KOKORO_DEFAULT_VOICE`, or override per-request with
the `voiceId` field in the API.

### Story card themes

Six built-in visual themes control the card's background, text, accent, and
border colors. Set via the `themeId` option.

| Theme ID | Card BG | Text | Accent | Look |
|----------|---------|------|--------|------|
| `reddit-light` | `#FFFFFF` | `#1C1C1C` | `#FF4500` | Classic Reddit white card (default) |
| `reddit-dark` | `#1A1A1B` | `#F2F2F2` | `#FF4500` | Reddit dark mode |
| `reddit-orange` | `#FF4500` | `#FFFFFF` | `#FFFFFF` | Bold orange-filled card |
| `minimal-white` | `#FFFFFF` | `#111111` | `#111111` | Minimalist, black accent |
| `glass-dark` | `rgba(18,18,18,0.72)` | `#FFFFFF` | `#FF4500` | Frosted glass (backdrop blur) |
| `custom` | `#FFFFFF` | `#1C1C1C` | `#FF4500` | Same as reddit-light; placeholder for user customization |

### Story card options

These are passed per-request in the `storyCard` object (via the API or set in
the dashboard UI). All have defaults — you only need to set the ones you want
to change.

| Option | Type | Default | Range / options | Description |
|--------|------|---------|-----------------|-------------|
| `enabled` | boolean | `false` | — | Enable story card overlay |
| `themeId` | string | `reddit-light` | See [themes](#story-card-themes) | Visual theme |
| `layoutMode` | string | `center-card` | See [layout modes](#layout-modes) | How cards are arranged |
| `timingMode` | string | `estimated` | See [timing modes](#timing-modes) | How card timing is calculated |
| `transition` | string | `scale-fade` | See [transitions](#transitions) | Animation between cards |
| `transitionDurationMs` | number | `220` | 0 - 1000 | Transition duration in ms |
| `wordsPerCard` | number | `20` | 8 - 50 | Max words displayed per card |
| `maxLinesPerCard` | number | `5` | 1 - 6 | Max text lines per card |
| `maxCharsPerLine` | number | `40` | — | Max characters per line |
| `cardPosition` | string | `center` | See [card positions](#card-positions) | Vertical position on screen |
| `cardWidthRatio` | number | `0.86` | 0.6 - 0.96 | Card width as fraction of screen |
| `backgroundDim` | number | `0.16` | 0 - 0.6 | Background darkening amount |
| `backgroundBlur` | number | `0` | 0 - 30 | Background blur radius (px) |
| `showHeader` | boolean | `true` | — | Show subreddit/username header |
| `showMetadata` | boolean | `true` | — | Show post metadata |
| `showProgress` | boolean | `true` | — | Show progress bar |
| `showUpvotes` | boolean | `true` | — | Show fake upvote count |
| `showComments` | boolean | `true` | — | Show fake comment count |
| `fakeUpvotes` | string | `12.8k` | — | Upvote count text |
| `fakeComments` | string | `1.1k` | — | Comment count text |
| `introCardMs` | number | `600` | — | Intro card display time (ms) |
| `outroCardMs` | number | `500` | — | Outro card display time (ms) |
| `syncLeadMs` | number | `150` | 0 - 1000 | How far ahead of audio each card appears (ms). Text slightly before voice reads as synced; absorbs alignment lag. |
| `title` | string | `""` | — | Override the detected title |
| `subreddit` | string | `r/AskReddit` | — | Subreddit label |
| `username` | string | `u/storyteller` | — | Username label |
| `sourceType` | string | `manual` | `manual`, `reddit-post`, `ai-generated` | Source type label |
| `useActualRedditAsset` | boolean | `false` | — | Use actual Reddit post screenshot |
| `customCardAssetPath` | string | `""` | relative path (png/jpg/webp/gif) | Custom card background image |

### Layout modes

Controls how story cards are arranged on screen.

| Mode | Description |
|------|-------------|
| `center-card` | Single card centered on screen (default — classic Reddit story) |
| `top-card` | Card positioned at the top, leaving room for visuals below |
| `comment-stack` | Cards stacked vertically like Reddit comment threads |
| `post-and-comments` | Original post at top, comments scroll below |

### Timing modes

Controls how card display times are calculated from the narration audio.

| Mode | Description | Requires Whisper? |
|------|-------------|-------------------|
| `estimated` | Distributes time across cards based on word count and speaking rate | No |
| `word-aligned` | Uses Whisper word-level timestamps for precise card-to-audio sync | **Yes** |
| `sentence-aligned` | Aligns cards to detected sentence boundaries in the audio | No |

### Transitions

Animation effect when transitioning between story cards.

| Transition | Description |
|------------|-------------|
| `none` | No animation — instant cut |
| `fade` | Cross-fade between cards |
| `slide-up` | New card slides up from below |
| `scale-fade` | Card scales + fades in/out (default) |

### Card positions

Vertical position of the story card on the 1080x1920 screen.

| Position | Description |
|----------|-------------|
| `top` | Card near the top (~20% from top) |
| `center` | Card vertically centered (default) |
| `lower` | Card in the lower third (~65% from top) |

### Quality presets

Controls the FFmpeg encoding settings for the final composited video. Higher
quality = slower encoding + larger file.

| Quality | FFmpeg preset | CRF | Audio bitrate | When to use |
|---------|---------------|-----|---------------|-------------|
| `draft` | `veryfast` | 24 | 160k | Quick previews, testing |
| `standard` | `medium` | 19 | 192k | Default — good quality/size balance |
| `high` | `slow` | 17 | 256k | Final production output |

### Reel presets

Named presets that bundle common config combinations. Apply via the dashboard
or the `applyReelPreset()` function.

| Preset ID | Label | Description | Key settings |
|-----------|-------|-------------|--------------|
| `story-short` | Short Story | 30-60s storytelling reel | Defaults |
| `motivational` | Motivational | Dramatic motivational speech | Defaults |
| `educational` | Educational | Neutral educational content | Defaults |
| `action-packed` | Action Packed | Fast-paced dramatic delivery | `quality: "high"` |
| `reddit-story-short` | Reddit Story Short | Reddit-style text cards | `reddit-light`, `center-card`, `estimated`, 24 words/card |
| `reddit-story-dark` | Dark Story Cards | Dark-themed Reddit cards | `reddit-dark`, 22 words/card, dim 0.2 |

---

## Supported source URLs

The background video can come from YouTube (downloaded via yt-dlp) or a
local file path:

| Platform | Example URL |
|----------|-------------|
| YouTube | `https://youtube.com/watch?v=...` or `https://youtu.be/...` |
| Local file | `/path/to/video.mp4` (absolute path on disk) |

Source videos are downloaded at best quality up to 1080p, merged to MP4, and
cached in `data/reels/source-cache/` keyed by a base64 hash of the URL.
Subsequent runs with the same URL reuse the cached file instantly.

### Choosing a background video

You can use **any YouTube URL** as a background — gameplay footage, nature
clips, sports highlights, city timelapses, anything that fits your script's
vibe.

For the classic "Reddit story reel" look, **gameplay footage works best** —
it provides visual motion behind the story cards without distracting from
the text. A good example:

> `https://youtu.be/pyV68KvUwlw`

Paste the URL into the dashboard, set a `backgroundDim` of `0.16`–`0.2` so
the gameplay is visible but not overpowering, and pick a `backgroundBlur`
of `0` for crispness or `8`–`12` if you want the text to pop more.

> **Credit disclaimer:** RedditReel does not own, host, or distribute any of
> the background videos downloaded via yt-dlp. All video content belongs to
> its respective creators. When publishing reels publicly, credit the
> original video owner and ensure your use complies with the source
> platform's terms of service and applicable copyright law.

---

## Output files

| Artifact | Path | Purpose |
|----------|------|---------|
| **Final reel video** | `output/reels/{jobId}.mp4` | The finished MP4 |
| Card overlay (intermediate) | `output/reels/story-card-overlay-{jobId}.mov` | Transparent ProRes 4444 |
| Timeline JSON | `output/reels/{jobId}/story-card-timeline.json` | Card timing data |
| TTS narration | `data/reels/audio/narration_kokoro_{timestamp}.wav` | Raw TTS audio |
| Subtitles (SRT) | `data/reels/subtitles/subs_{timestamp}.srt` | Whisper-generated |
| Source video cache | `data/reels/source-cache/{urlHash}.mp4` | Downloaded source |
| Prepared background | `data/reels/temp/bg_{timestamp}.mp4` | Scaled/cropped/looped |
| Job history | `data/reel-history.json` | Completed job records |

`output/` and `data/` are gitignored.

---

## Project structure

```
src/
  app/               Next.js App Router pages and API routes
  reel/              Core reel pipeline
    orchestrator.ts  10-stage pipeline coordinator
    tts-kokoro.ts    Kokoro-82M TTS (local ONNX)
    subtitle.ts      Whisper transcription + SRT
    source-url.ts    yt-dlp download + cache
    presets.ts       Named reel presets
    constants.ts     Voices, pipeline steps, API limits
    story-card/      Reddit story card module
      constants.ts   Themes, quality presets, validation bounds
      types.ts       Story card type definitions
      script-normalizer.ts  Text normalization
      script-chunker.ts     Story splitting into display chunks
      timing.ts             Card timeline building
      renderer-remotion.ts  Remotion overlay rendering
      compositor.ts         FFmpeg final composition
  remotion/          Remotion components
    story-card/      RedditStoryCard, StoryCardOverlay
  server/            Server services
    reel-service.ts  Singleton orchestrator wrapper
    local-access.ts  Localhost-only access guard
    snapshot-stream.ts  SSE progress streaming
  components/        UI components (dashboard)
  hooks/             React hooks (use-reel-extractor)
  lib/               Library utilities
  utils/             Utility functions (URL parser, logger)
data/                Runtime data (audio, temp, cache) -- gitignored
output/              Generated reel videos -- gitignored
tests/               Test files
docs/                Architecture deep-dives
```

---

## API reference

All routes are localhost-only (enforced by `LOCAL_ALLOWED_HOSTS`). All return
JSON unless noted.

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/reels` | Start a reel job. Body: `{ text, sourceUrl, voiceId?, tone?, quality?, storyCard? }` -> `202 { job }` |
| `GET` | `/api/reels` | List all active jobs |
| `GET` | `/api/reels/[jobId]` | Get a single job by id |
| `GET` | `/api/reels/[jobId]/stream` | SSE stream of job progress (`reel-job` events) |
| `GET` | `/api/reels/[jobId]/video` | Stream the rendered MP4 (supports HTTP range requests) |
| `DELETE` | `/api/reels/[jobId]/delete` | Delete a job and its files (409 if still running) |
| `GET` | `/api/reels/assets` | List previously-cached source assets |
| `GET` | `/api/reels/history` | List completed reels from history |
| `GET` | `/api/reels/status` | Service health check |

### Example: create a reel

```bash
curl -X POST http://localhost:3000/api/reels \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Title: My Reddit Story\nr/AskReddit\nThis is a sample narration script with at least twenty words so it passes validation and becomes a proper story card reel.",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "voiceId": "af_heart",
    "tone": "storytelling",
    "quality": "standard",
    "storyCard": {
      "enabled": true,
      "themeId": "reddit-light",
      "layoutMode": "center-card",
      "timingMode": "estimated",
      "wordsPerCard": 24,
      "transition": "scale-fade",
      "backgroundDim": 0.16,
      "showHeader": true,
      "showMetadata": true,
      "showUpvotes": true,
      "showComments": true
    }
  }'
```

Returns `202 Accepted` with the job object. Poll `GET /api/reels/{jobId}` or
subscribe to the SSE stream at `/api/reels/{jobId}/stream` for progress.

### Request body fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `text` | string | yes | — | Script text (5 - 1000 words, max 5000 chars) |
| `sourceUrl` | string | yes | — | YouTube video URL or local file path |
| `voiceId` | string | no | `af_heart` | Kokoro voice (see [TTS voices](#tts-voices)) |
| `tone` | string | no | `storytelling` | `dramatic`, `neutral`, or `storytelling` |
| `quality` | string | no | `standard` | `draft`, `standard`, or `high` |
| `ttsProvider` | string | no | `kokoro` | TTS provider (only `kokoro` supported) |
| `ttsModel` | string | no | `onnx-community/Kokoro-82M-v1.0-ONNX` | TTS model id |
| `storyCard` | object | no | `undefined` | Story card options (see [above](#story-card-options)) |

**Tone behavior:** `dramatic` clamps the TTS speed to <= 0.95x (slower, more
deliberate). `neutral` and `storytelling` use the configured `KOKORO_SPEED`.

---

## Testing

```bash
bun test
```

Tests cover the orchestrator lifecycle, story card chunking/timing,
compositor FFmpeg arguments building, validation, and presets.

---

## Troubleshooting

### DLL errors on Windows (onnxruntime-node / sharp)

Install the
[Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe),
then re-run `bun install`.

### `ffmpeg` or `ffprobe` not found

Ensure FFmpeg is installed and on your `PATH`:

```bash
ffmpeg -version
ffprobe -version
```

On Windows, if winget installed FFmpeg but it's not found, add the install
path to your `PATH` environment variable.

### `yt-dlp` fails to download

yt-dlp updates frequently to keep up with platform changes. Update it:

```bash
yt-dlp -U    # self-update
# or
brew upgrade yt-dlp      # macOS
pipx upgrade yt-dlp      # cross-platform
```

### Whisper not found -- captions use estimated timing

If `whisper-cli` is not installed, the pipeline silently falls back to
estimated timing. Install Whisper if you need word-aligned captions:

```bash
pipx install openai-whisper
```

### First TTS run is slow / downloads model

The first run downloads the Kokoro-82M ONNX weights (~100 MB) from
Hugging Face. Set `TRANSFORMERS_OFFLINE=1` and `HF_HUB_OFFLINE=1` after the
first successful download to force offline mode.

### Remotion render timeout

If the Remotion overlay render times out (e.g., on a very slow machine or
very long script), the per-frame timeout can be adjusted in
`src/reel/story-card/renderer-remotion.ts`. The default is 120 seconds per
frame. Reducing `REMOTION_CONCURRENCY` can also help if the machine is
running out of memory.

### Running out of memory during render

Lower `REMOTION_CONCURRENCY` (number of parallel Chrome workers) in
`.env.local`:

```bash
REMOTION_CONCURRENCY=2
```

### Dashboard shows "access denied"

The dashboard is localhost-only by default. If you need to access it from
another host on your network, add it to `LOCAL_ALLOWED_HOSTS`:

```bash
LOCAL_ALLOWED_HOSTS=127.0.0.1,localhost,[::1],192.168.0.100
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Install dependencies: `bun install`
4. Make your changes — follow existing code style (enforced by ESLint + oxfmt)
5. Run tests: `bun test`
6. Run lint: `bun run lint`
7. Commit with conventional commit messages (e.g., `feat:`, `fix:`, `docs:`, `test:`, `chore:`)
8. Push and open a pull request

### Development notes

- The project uses **Bun** as its runtime and package manager
- **TypeScript** with strict mode — no `any` without explicit annotation
- **Zod** for runtime validation (config + API input)
- **ESLint** with `eslint-config-next` — run `bun run lint` before committing
- **oxfmt** for formatting — run `bun run format` to auto-format
- Tests use **bun:test** with **happy-dom** for DOM-dependent tests
- The `@/` path alias maps to `src/` (configured in `tsconfig.json`)
- `.env.local` is gitignored — copy `.env.example` as a starting point
- `data/` and `output/` are gitignored — created at runtime

### Architecture docs

For a complete technical deep-dive of the pipeline, see:
- [`docs/reel-pipeline-deep-dive.md`](docs/reel-pipeline-deep-dive.md) — every module, type, algorithm, FFmpeg filter graph, and Remotion composition
- [`docs/performance-architecture.md`](docs/performance-architecture.md) — fast vs. quality path tuning

---

## License

[MIT](LICENSE)
