import { chromium } from "@playwright/test";
import Chromium from "@sparticuz/chromium";
import { brotliDecompressSync } from "node:zlib";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
export async function launch() {
  const dir = "/tmp/flipvault-browser-libs";
  if (process.platform === "linux") {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      dir + "/libs.tar",
      brotliDecompressSync(
        readFileSync(
          new URL(
            "../node_modules/@sparticuz/chromium/bin/al2023.tar.br",
            import.meta.url,
          ),
        ),
      ),
    );
    execFileSync("tar", ["xf", dir + "/libs.tar", "-C", dir]);
  }
  return chromium.launch({
    executablePath:
      process.env.CHROME_PATH || (await Chromium.executablePath()),
    args: Chromium.args,
    headless: true,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: dir + "/lib:" + (process.env.LD_LIBRARY_PATH || ""),
    },
  });
}
