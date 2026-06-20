function isClosedControllerError(err: unknown): boolean {
  return err instanceof TypeError && err.message.includes("Controller is already closed");
}

/** Safely enqueues a chunk to a stream controller, returning false if closed. */
export function enqueueChunk(controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array): boolean {
  try { controller.enqueue(chunk); return true; }
  catch (err) { if (isClosedControllerError(err)) {return false;} throw err; }
}

/** Safely closes a stream controller, ignoring already-closed errors. */
export function closeController(controller: ReadableStreamDefaultController<Uint8Array>): void {
  try { controller.close(); } catch (err) { if (!isClosedControllerError(err)) {throw err;} }
}

/** Safely errors a stream controller, ignoring already-closed errors. */
export function errorController(controller: ReadableStreamDefaultController<Uint8Array>, err: unknown): void {
  try { controller.error(err); } catch (controllerError) { if (!isClosedControllerError(controllerError)) {throw controllerError;} }
}
