/**
 * Minimal WAV (RIFF) encoder for 16-bit PCM audio.
 *
 * Kokoro emits raw Float32 mono samples; the rest of the pipeline (ffmpeg,
 * whisper) consumes standard WAV files, so we serialize the merged samples
 * into a canonical little-endian PCM WAV container here rather than pulling in
 * a heavier audio dependency.
 */

const BYTES_PER_SAMPLE = 2; // 16-bit PCM
const WAV_HEADER_SIZE = 44;

/**
 * Encodes mono Float32 PCM samples (range [-1, 1]) into a 16-bit PCM WAV buffer.
 *
 * @param samples Interleaved mono audio samples.
 * @param sampleRate Sampling rate in Hz (Kokoro outputs 24000).
 * @returns A `Uint8Array` containing a complete WAV file.
 */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(WAV_HEADER_SIZE + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i++) {view.setUint8(offset + i, value.charCodeAt(i));}
  };

  // RIFF chunk descriptor
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format: 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * BYTES_PER_SAMPLE, true); // byte rate
  view.setUint16(32, numChannels * BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true); // bits per sample

  // data sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = WAV_HEADER_SIZE;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, value, true);
    offset += BYTES_PER_SAMPLE;
  }

  return new Uint8Array(buffer);
}

/**
 * Concatenates a list of Float32 PCM chunks into a single contiguous buffer.
 *
 * @param chunks Audio chunks emitted in order by a streaming TTS run.
 * @returns A single `Float32Array` containing every chunk back-to-back.
 */
export function concatFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
