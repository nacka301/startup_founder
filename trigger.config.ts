import { defineConfig } from "@trigger.dev/sdk";
import { esbuildPlugin } from "@trigger.dev/core/v3/build";

/**
 * `server-only` is a build-time marker package that Next.js resolves virtually —
 * it is not physically installed in node_modules. The task bundle transitively
 * imports it through shared lib code (e.g. supabase/service.ts), so esbuild would
 * fail to resolve it. This plugin resolves it to an empty module for the task
 * build only; Next's own bundling is unaffected.
 */
// Minimal shape of the esbuild plugin API we use (esbuild's own types are not
// hoisted to the project root, so annotate the pieces we touch).
type EsbuildPluginBuild = {
  onResolve(
    options: { filter: RegExp },
    callback: () => { path: string; namespace: string },
  ): void;
  onLoad(
    options: { filter: RegExp; namespace: string },
    callback: () => { contents: string; loader: "js" },
  ): void;
};

const stubServerOnly = esbuildPlugin({
  name: "stub-server-only",
  setup(build: EsbuildPluginBuild) {
    build.onResolve({ filter: /^server-only$/ }, () => ({
      path: "server-only",
      namespace: "stub-server-only",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub-server-only" }, () => ({
      contents: "",
      loader: "js",
    }));
  },
});

/**
 * Trigger.dev configuration. Tasks live in `src/trigger/`. The analysis job can
 * run several minutes (LLM calls + polite ≤1 req/sec Reddit fetching), so the
 * per-run ceiling is generous. Retries are disabled in local dev so a forced
 * failure surfaces immediately instead of looping; in deployed environments the
 * per-task `retry` config (initial + 2) applies.
 */
export default defineConfig({
  project: "proj_imsbxwdbfavtolyjovnc",
  dirs: ["./src/trigger"],
  maxDuration: 900,
  build: {
    extensions: [stubServerOnly],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
});
