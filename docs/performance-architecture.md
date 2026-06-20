# Performance Architecture

This project now has a fast path and a quality path.

## Fast path

The fast path is the default. It is designed to produce the first usable short-form clip quickly:

1. Download source media at a capped height (`DOWNLOAD_MAX_HEIGHT`, default `720`).
2. Transcribe once using the per-run provider stored in SQLite.
3. Identify clip candidates with OpenRouter.
4. Keep the first clip by default when `FAST_MODE=true` and no explicit `topK` is supplied.
5. Run a small per-clip Whisper caption pass to get accurate word timing.
6. Generate ASS captions from those per-clip word timings, with explicit two-line wrapping and safe horizontal margins.
7. Render directly from the downloaded source into the final reel with one FFmpeg command.

This avoids the old hot-path costs:

- Remotion VP9 alpha caption overlays
- separate clip extraction transcodes
- default silence-removal transcodes
- multiple FFmpeg passes before final output

## Quality path

Set `FAST_MODE=false` when you want the older multi-stage behavior. Optional knobs:

- `CAPTION_RENDERER=remotion` for Remotion caption overlays
- `REMOVE_SILENCE=true` for silence removal
- higher `DOWNLOAD_MAX_HEIGHT` for source quality
- higher `topK` for more rendered clips per run

## Practical target

For sub-5-minute iteration, use:

```env
FAST_MODE=true
CAPTION_RENDERER=ffmpeg
CAPTION_WHISPER_MODEL=base
REMOVE_SILENCE=false
DOWNLOAD_MAX_HEIGHT=720
TRANSCRIPTION_PROVIDER=local
```

Then request one clip first. If it is good, raise `topK` or run a quality rerender later.
