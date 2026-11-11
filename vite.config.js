import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  server: { host: "0.0.0.0", allowedHosts: [".e2b.app"] },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app"] },
  // djvu-rs resolves its selected WASM binary relative to its ESM module URL.
  // Keep it outside optimizeDeps so the dev server preserves that asset URL.
  optimizeDeps: { exclude: ["djvu-rs"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ["pdfjs-dist/legacy/build/pdf.mjs"],
          pdflib: ["pdf-lib"],
          fontkit: ["@pdf-lib/fontkit"],
        },
      },
    },
  },
  plugins: [
    {
      name: "offline-shell",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url, "http://localhost").pathname;
          const match = path.match(
            /^\/(standard_fonts|cmaps)\/([A-Za-z0-9_.-]+)$/,
          );
          if (!match || match[2] === "..") return next();
          try {
            const data = readFileSync(
              "node_modules/pdfjs-dist/" + match[1] + "/" + match[2],
            );
            res.setHeader("Content-Type", "application/octet-stream");
            res.end(data);
          } catch {
            next();
          }
        });
      },
      generateBundle(_, bundle) {
        const resources = [];
        for (const dir of ["standard_fonts", "cmaps"])
          for (const name of readdirSync("node_modules/pdfjs-dist/" + dir)) {
            const fileName = dir + "/" + name;
            this.emitFile({
              type: "asset",
              fileName,
              source: readFileSync("node_modules/pdfjs-dist/" + fileName),
            });
            resources.push(fileName);
          }
        const files = Object.keys(bundle).filter((x) => !x.endsWith(".map"));
        const version = files.join("|");
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='flipvault-${createHash("sha256").update(version).digest("hex").slice(0, 16)}';const FILES=${JSON.stringify(["./", "./icon.svg", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest", ...[...new Set([...files, ...resources])].filter((f) => !f.startsWith("dictionary/")).map((f) => "./" + f)])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('flipvault-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(c=>c||fetch(e.request).then(r=>{if(r.ok)return caches.open(CACHE).then(cc=>{cc.put(e.request,r.clone());return r});return r}).catch(()=>e.request.mode==='navigate'?caches.match('./'):Response.error())));});`,
        });
      },
    },
  ],
});
