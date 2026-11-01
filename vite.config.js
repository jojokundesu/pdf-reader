import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  server: { host: "0.0.0.0", allowedHosts: [".e2b.app"] },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ["pdfjs-dist/legacy/build/pdf.mjs"],
          pdflib: ["pdf-lib"],
        },
      },
    },
  },
  plugins: [
    {
      name: "offline-shell",
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
          source: `const CACHE='flipvault-${createHash("sha256").update(version).digest("hex").slice(0, 16)}';const FILES=${JSON.stringify(["./", "./icon.svg", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest", ...[...new Set([...files, ...resources])].map((f) => "./" + f)])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('flipvault-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(c=>c||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('./'):Response.error())));});`,
        });
      },
    },
  ],
});
