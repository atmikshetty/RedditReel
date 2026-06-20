import { closeController, enqueueChunk } from "./stream-controller";

interface SnapshotStreamOptions<T> {
  event: string;
  intervalMs?: number;
  serialize?: (snapshot: T) => string;
  snapshot: () => T;
}

const defaultIntervalMs = 1500;

/**
 * Creates an SSE (Server-Sent Events) stream that periodically emits snapshots.
 * Deduplicates payloads to avoid sending identical data.
 */
export function createSnapshotStream<T>(request: Request, options: SnapshotStreamOptions<T>): Response {
  const encoder = new TextEncoder();
  const serialize = options.serialize ?? ((snapshot: T) => JSON.stringify(snapshot));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastPayload = "";
      let eventId = 0;
      let interval: ReturnType<typeof setInterval> | null = null;

      const enqueue = (chunk: string): void => {
        if (closed) {return;}
        if (!enqueueChunk(controller, encoder.encode(chunk))) {close();}
      };

      const close = (): void => {
        if (closed) {return;}
        closed = true;
        if (interval) {clearInterval(interval);}
        closeController(controller);
      };

      const emitSnapshot = (force = false): void => {
        const snapshot = options.snapshot();
        const payload = serialize(snapshot);
        if (!force && payload === lastPayload) {return;}
        lastPayload = payload;
        eventId += 1;
        enqueue(`id: ${eventId}\nevent: ${options.event}\ndata: ${payload}\n\n`);
      };

      enqueue("retry: 1000\n\n");
      emitSnapshot(true);
      interval = setInterval(() => { emitSnapshot(); }, options.intervalMs ?? defaultIntervalMs);
      request.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform", Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8", "X-Accel-Buffering": "no",
    },
  });
}
