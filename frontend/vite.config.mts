import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

function serviceWorkerPlugin(): Plugin {
  return {
    name: "edusphere-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const shellChunks = new Set<string>();
      const addShellChunk = (fileName: string) => {
        if (shellChunks.has(fileName)) return;
        const output = bundle[fileName];
        if (output?.type !== "chunk") return;
        shellChunks.add(fileName);
        output.imports.forEach(addShellChunk);
      };
      Object.entries(bundle).forEach(([fileName, output]) => {
        if (output.type === "chunk" && output.isEntry) addShellChunk(fileName);
      });

      const precacheEntries = Object.entries(bundle).filter(
        ([fileName, output]) =>
          fileName !== "service-worker.js" &&
          ((output.type === "chunk" && shellChunks.has(fileName)) ||
            (output.type === "asset" &&
              /\.(?:html|css|svg|png|jpe?g|gif|webp|ico|woff2?)$/i.test(fileName))),
      );
      const hash = createHash("sha256");

      for (const [fileName, output] of precacheEntries) {
        hash.update(fileName);
        hash.update(output.type === "chunk" ? output.code : output.source);
      }

      const cacheName = `edusphere-shell-${hash.digest("hex").slice(0, 12)}`;
      const precacheUrls = JSON.stringify([
        "./",
        ...precacheEntries.map(([fileName]) => `./${fileName}`),
      ]);
      const workerTemplate = readFileSync(
        resolve(process.cwd(), "src/service-worker.js"),
        "utf8",
      );
      const worker = workerTemplate
        .replace('"__CACHE_NAME__"', JSON.stringify(cacheName))
        .replace("const PRECACHE_URLS = [];", `const PRECACHE_URLS = ${precacheUrls};`);

      this.emitFile({
        type: "asset",
        fileName: "service-worker.js",
        source: worker,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8080";

  return {
    plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
    define: {
      "import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID": JSON.stringify(
        env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      ),
    },
    resolve: {
      alias: [
        { find: /^@\//, replacement: `${resolve(process.cwd(), "src")}/` },
      ],
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
