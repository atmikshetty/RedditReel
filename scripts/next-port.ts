import { spawn } from "node:child_process";
import { Socket } from "node:net";

const host = process.env.HOST ?? "127.0.0.1";
const mode = process.argv[2];

if (mode !== "dev" && mode !== "start") {
  throw new Error("Usage: bun run scripts/next-port.ts <dev|start>");
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = new Socket();

    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();

      if (error.code === "ECONNREFUSED") {
        resolve(true);
        return;
      }

      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found between ${startPort} and ${startPort + 19}`);
}

const requestedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const startPort = Number.isNaN(requestedPort) ? 3000 : requestedPort;
const port = await findAvailablePort(startPort);

if (port !== startPort) {
  console.warn(`Port ${startPort} is busy, using ${port} instead.`);
}

const child = spawn("next", [mode, "--hostname", host, "--port", String(port)], {
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
