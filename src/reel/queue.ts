/** An entry in the reel processing queue. */
export interface ReelQueueEntry {
  id: string;
  addedAt: string;
  status: "queued" | "running";
}

/**
 * A simple concurrent queue for managing reel job execution.
 * Ensures a configurable maximum number of jobs run simultaneously.
 */
export class ReelQueue {
  private entries: ReelQueueEntry[] = [];
  private running: Set<string> = new Set();
  private maxConcurrent: number;

  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(id: string): void {
    this.entries.push({ id, addedAt: new Date().toISOString(), status: "queued" });
  }

  dequeue(): string | null {
    if (this.running.size >= this.maxConcurrent) {return null;}
    const entry = this.entries.find((e) => e.status === "queued");
    if (!entry) {return null;}
    entry.status = "running";
    this.running.add(entry.id);
    return entry.id;
  }

  complete(id: string): void {
    this.running.delete(id);
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  get length(): number {
    return this.entries.length;
  }

  get runningCount(): number {
    return this.running.size;
  }
}
