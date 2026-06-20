/** ANSI color map for log levels. */
const COLORS: Record<string, (s: string) => string> = {
  DEBUG: (s) => `\x1b[90m${s}\x1b[0m`,
  INFO: (s) => `\x1b[34m${s}\x1b[0m`,
  WARN: (s) => `\x1b[33m${s}\x1b[0m`,
  ERROR: (s) => `\x1b[31m${s}\x1b[0m`,
};

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function log(level: string, module: string, message: string, ...args: unknown[]) {
  const color = COLORS[level] ?? ((s: string) => s);
  const prefix = `${timestamp()} [${level}] [${module}]`;
  console.log(`${prefix} ${message}`, ...args);
}

/**
 * Creates a namespaced logger with debug, info, warn, and error methods.
 */
export function createLogger(module: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => log("DEBUG", module, msg, ...args),
    info: (msg: string, ...args: unknown[]) => log("INFO", module, msg, ...args),
    warn: (msg: string, ...args: unknown[]) => log("WARN", module, msg, ...args),
    error: (msg: string, ...args: unknown[]) => log("ERROR", module, msg, ...args),
  };
}
