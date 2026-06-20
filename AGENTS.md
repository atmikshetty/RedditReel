<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RedditReel

Reddit story card reel creation pipeline. Local TTS, subtitles, and video compositing.

## Project structure
- `src/app/` - Next.js App Router pages and API routes
- `src/reel/` - Core reel pipeline (orchestrator, TTS, subtitles)
- `src/reel/story-card/` - Reddit story card creation module
- `src/remotion/` - Remotion components for video rendering
- `src/server/` - Server services (reel service, SSE streaming, local access guard)
- `src/hooks/` - React hooks
- `src/components/` - UI components (dashboard)
- `src/lib/` - Library utilities
- `src/utils/` - Utility functions
- `data/` - Runtime data (history, temp files) — gitignored
- `output/` - Generated reel videos — gitignored
- `tests/` - Test files
- `docs/` - Architecture deep-dive

The background video source is URL-only: a YouTube URL
(downloaded via yt-dlp) or a previously-cached local file path.
No game footage is bundled.

## Commands
- `bun run dev` - Start dev server
- `bun run build` - Build for production
- `bun run lint` - Run ESLint
- `bun test` - Run tests
