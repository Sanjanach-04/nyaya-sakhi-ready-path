// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Public (browser-safe) Lovable Cloud client values. Used only when no .env file for the
// current build mode provides them, so every build (preview, dev, publish) can reach auth.
const PUBLIC_CLOUD_FALLBACK: Record<string, string> = {
  VITE_SUPABASE_URL: "https://crgxzexupuxdbjvusxfz.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_EI7dULD3JiCtt5r6LQkqIQ_iqfBRWnL",
  VITE_SUPABASE_PROJECT_ID: "crgxzexupuxdbjvusxfz",
};

function cloudFallbackDefine(): Record<string, string> {
  const mode = process.env["NODE_ENV"] === "production" ? "production" : "development";
  const loaded = {
    ...loadEnv("production", process.cwd(), "VITE_"),
    ...loadEnv("development", process.cwd(), "VITE_"),
    ...loadEnv(mode, process.cwd(), "VITE_"),
  };
  const define: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(PUBLIC_CLOUD_FALLBACK)) {
    const value = loaded[key] || process.env[key] || fallback;
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }
  return define;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: cloudFallbackDefine(),
  },
});
