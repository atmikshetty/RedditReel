import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "esbuild",
    "@remotion/renderer",
    "@remotion/bundler",
    "remotion",
    // Kokoro TTS resolves voice .bin files relative to its own __dirname and
    // loads the native ONNX runtime; bundling it breaks both, so keep these
    // external and require()'d from node_modules at runtime.
    "kokoro-js",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
